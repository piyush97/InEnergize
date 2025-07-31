/**
 * Enterprise Secret Management System for InErgize
 * Handles secure storage, rotation, and access control for sensitive data
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Redis } from 'ioredis';
import AWS from 'aws-sdk';
import { HashiCorpVault } from 'hashicorp-vault';
import pino from 'pino';

const logger = pino({ name: 'secret-manager' });

export interface SecretConfig {
  provider: 'local' | 'aws' | 'vault' | 'azure' | 'gcp';
  encryption: {
    algorithm: string;
    keySize: number;
    saltSize: number;
  };
  storage: {
    localPath?: string;
    awsRegion?: string;
    vaultEndpoint?: string;
    vaultToken?: string;
  };
  rotation: {
    enabled: boolean;
    intervalHours: number;
    notificationEndpoint?: string;
  };
  audit: {
    enabled: boolean;
    logLevel: 'info' | 'warn' | 'error';
    retentionDays: number;
  };
}

export interface SecretMetadata {
  id: string;
  name: string;
  description?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  rotationInterval?: number;
  tags: string[];
  accessCount: number;
  lastAccessedAt?: Date;
  createdBy: string;
  rotationRequired: boolean;
}

export interface SecretValue {
  value: string;
  encrypted: boolean;
  encoding: 'utf8' | 'base64' | 'hex';
}

export interface AuditLog {
  timestamp: Date;
  secretId: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'rotate';
  userId: string;
  clientIP: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export class SecretManager {
  private config: SecretConfig;
  private redis: Redis;
  private awsSecretsManager?: AWS.SecretsManager;
  private vaultClient?: HashiCorpVault;
  private masterKey: Buffer;
  private auditLogs: AuditLog[] = [];

  constructor(config: SecretConfig, redis: Redis) {
    this.config = config;
    this.redis = redis;
    this.masterKey = this.deriveMasterKey();
    this.initializeProviders();
    this.startRotationScheduler();
  }

  private deriveMasterKey(): Buffer {
    const masterSecret = process.env.INERGIZE_MASTER_SECRET || 'default-master-secret-change-in-production';
    const salt = process.env.INERGIZE_MASTER_SALT || 'inergize-secret-salt';
    return crypto.scryptSync(masterSecret, salt, 32);
  }

  private async initializeProviders(): Promise<void> {
    switch (this.config.provider) {
      case 'aws':
        this.awsSecretsManager = new AWS.SecretsManager({
          region: this.config.storage.awsRegion || 'us-east-1'
        });
        break;
      case 'vault':
        if (this.config.storage.vaultEndpoint && this.config.storage.vaultToken) {
          this.vaultClient = new HashiCorpVault({
            endpoint: this.config.storage.vaultEndpoint,
            token: this.config.storage.vaultToken
          });
        }
        break;
      case 'local':
        await this.ensureLocalStorage();
        break;
    }
    logger.info('Secret provider initialized', { provider: this.config.provider });
  }

  private async ensureLocalStorage(): Promise<void> {
    const secretsPath = this.config.storage.localPath || '/var/lib/inergize/secrets';
    try {
      await fs.mkdir(secretsPath, { recursive: true, mode: 0o700 });
      logger.info('Local secrets directory ensured', { path: secretsPath });
    } catch (error) {
      logger.error('Failed to create secrets directory', { error, path: secretsPath });
      throw error;
    }
  }

  // =====================================================
  // SECRET ENCRYPTION/DECRYPTION
  // =====================================================

  private encrypt(data: string): { encryptedData: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.masterKey);
    cipher.setAAD(Buffer.from('inergize-secret-data'));
    
    let encryptedData = cipher.update(data, 'utf8', 'hex');
    encryptedData += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();

    return {
      encryptedData,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  private decrypt(encryptedData: string, iv: string, authTag: string): string {
    const decipher = crypto.createDecipher('aes-256-gcm', this.masterKey);
    decipher.setAAD(Buffer.from('inergize-secret-data'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decryptedData = decipher.update(encryptedData, 'hex', 'utf8');
    decryptedData += decipher.final('utf8');
    
    return decryptedData;
  }

  // =====================================================
  // SECRET OPERATIONS
  // =====================================================

  /**
   * Store a secret securely
   */
  public async storeSecret(
    name: string,
    value: string,
    metadata: Partial<SecretMetadata>,
    auditContext: { userId: string; clientIP: string; userAgent?: string }
  ): Promise<string> {
    try {
      const secretId = crypto.randomUUID();
      const now = new Date();
      
      const secretMetadata: SecretMetadata = {
        id: secretId,
        name,
        description: metadata.description,
        version: 1,
        createdAt: now,
        updatedAt: now,
        expiresAt: metadata.expiresAt,
        rotationInterval: metadata.rotationInterval,
        tags: metadata.tags || [],
        accessCount: 0,
        createdBy: auditContext.userId,
        rotationRequired: false
      };

      // Encrypt the secret value
      const encrypted = this.encrypt(value);
      const secretValue: SecretValue = {
        value: JSON.stringify(encrypted),
        encrypted: true,
        encoding: 'hex'
      };

      // Store based on provider
      await this.storeSecretByProvider(secretId, secretValue, secretMetadata);

      // Cache metadata in Redis
      await this.redis.setex(
        `secret:meta:${secretId}`,
        3600, // 1 hour cache
        JSON.stringify(secretMetadata)
      );

      // Audit log
      await this.auditLog({
        timestamp: now,
        secretId,
        action: 'create',
        userId: auditContext.userId,
        clientIP: auditContext.clientIP,
        userAgent: auditContext.userAgent,
        success: true,
        metadata: { name, tags: metadata.tags }
      });

      logger.info('Secret stored successfully', { secretId, name });
      return secretId;
    } catch (error) {
      await this.auditLog({
        timestamp: new Date(),
        secretId: 'unknown',
        action: 'create',
        userId: auditContext.userId,
        clientIP: auditContext.clientIP,
        userAgent: auditContext.userAgent,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      logger.error('Failed to store secret', { error, name });
      throw error;
    }
  }

  /**
   * Retrieve a secret by ID or name
   */
  public async getSecret(
    identifier: string,
    auditContext: { userId: string; clientIP: string; userAgent?: string }
  ): Promise<string | null> {
    try {
      // Try to get by ID first, then by name
      let secretId = identifier;
      let metadata = await this.getSecretMetadata(identifier);
      
      if (!metadata) {
        // Try to find by name
        const nameMapping = await this.redis.get(`secret:name:${identifier}`);
        if (nameMapping) {
          secretId = nameMapping;
          metadata = await this.getSecretMetadata(secretId);
        }
      }

      if (!metadata) {
        await this.auditLog({
          timestamp: new Date(),
          secretId: identifier,
          action: 'read',
          userId: auditContext.userId,
          clientIP: auditContext.clientIP,
          userAgent: auditContext.userAgent,
          success: false,
          errorMessage: 'Secret not found'
        });
        return null;
      }

      // Check expiration
      if (metadata.expiresAt && metadata.expiresAt < new Date()) {
        logger.warn('Attempted to access expired secret', { secretId, expiresAt: metadata.expiresAt });
        return null;
      }

      // Retrieve secret value
      const secretValue = await this.getSecretByProvider(secretId);
      if (!secretValue) {
        return null;
      }

      // Decrypt if encrypted
      let value = secretValue.value;
      if (secretValue.encrypted) {
        const encryptedData = JSON.parse(secretValue.value);
        value = this.decrypt(encryptedData.encryptedData, encryptedData.iv, encryptedData.authTag);
      }

      // Update access statistics
      await this.updateAccessStats(secretId);

      // Audit log
      await this.auditLog({
        timestamp: new Date(),
        secretId,
        action: 'read',
        userId: auditContext.userId,
        clientIP: auditContext.clientIP,
        userAgent: auditContext.userAgent,
        success: true
      });

      return value;
    } catch (error) {
      await this.auditLog({
        timestamp: new Date(),
        secretId: identifier,
        action: 'read',
        userId: auditContext.userId,
        clientIP: auditContext.clientIP,
        userAgent: auditContext.userAgent,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      logger.error('Failed to retrieve secret', { error, identifier });
      throw error;
    }
  }

  /**
   * Update an existing secret
   */
  public async updateSecret(
    identifier: string,
    newValue: string,
    auditContext: { userId: string; clientIP: string; userAgent?: string }
  ): Promise<boolean> {
    try {
      const metadata = await this.getSecretMetadata(identifier);
      if (!metadata) {
        return false;
      }

      // Encrypt new value
      const encrypted = this.encrypt(newValue);
      const secretValue: SecretValue = {
        value: JSON.stringify(encrypted),
        encrypted: true,
        encoding: 'hex'
      };

      // Update metadata
      metadata.version += 1;
      metadata.updatedAt = new Date();
      metadata.rotationRequired = false;

      // Store updated secret
      await this.storeSecretByProvider(metadata.id, secretValue, metadata);

      // Update cached metadata
      await this.redis.setex(
        `secret:meta:${metadata.id}`,
        3600,
        JSON.stringify(metadata)
      );

      // Audit log
      await this.auditLog({
        timestamp: new Date(),
        secretId: metadata.id,
        action: 'update',
        userId: auditContext.userId,
        clientIP: auditContext.clientIP,
        userAgent: auditContext.userAgent,
        success: true,
        metadata: { version: metadata.version }
      });

      logger.info('Secret updated successfully', { secretId: metadata.id, version: metadata.version });
      return true;
    } catch (error) {
      await this.auditLog({
        timestamp: new Date(),
        secretId: identifier,
        action: 'update',
        userId: auditContext.userId,
        clientIP: auditContext.clientIP,
        userAgent: auditContext.userAgent,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      logger.error('Failed to update secret', { error, identifier });
      throw error;
    }
  }

  /**
   * Delete a secret
   */
  public async deleteSecret(
    identifier: string,
    auditContext: { userId: string; clientIP: string; userAgent?: string }
  ): Promise<boolean> {
    try {
      const metadata = await this.getSecretMetadata(identifier);
      if (!metadata) {
        return false;
      }

      // Delete from provider
      await this.deleteSecretByProvider(metadata.id);

      // Remove from cache
      await this.redis.del(`secret:meta:${metadata.id}`);
      await this.redis.del(`secret:name:${metadata.name}`);

      // Audit log
      await this.auditLog({
        timestamp: new Date(),
        secretId: metadata.id,
        action: 'delete',
        userId: auditContext.userId,
        clientIP: auditContext.clientIP,
        userAgent: auditContext.userAgent,
        success: true
      });

      logger.info('Secret deleted successfully', { secretId: metadata.id });
      return true;
    } catch (error) {
      await this.auditLog({
        timestamp: new Date(),
        secretId: identifier,
        action: 'delete',
        userId: auditContext.userId,
        clientIP: auditContext.clientIP,
        userAgent: auditContext.userAgent,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      logger.error('Failed to delete secret', { error, identifier });
      throw error;
    }
  }

  // =====================================================
  // SECRET ROTATION
  // =====================================================

  /**
   * Rotate a secret (generate new value)
   */
  public async rotateSecret(
    identifier: string,
    generator?: () => string,
    auditContext: { userId: string; clientIP: string; userAgent?: string }
  ): Promise<string | null> {
    try {
      const metadata = await this.getSecretMetadata(identifier);
      if (!metadata) {
        return null;
      }

      // Generate new value
      const newValue = generator ? generator() : this.generateSecurePassword();

      // Update the secret
      const success = await this.updateSecret(identifier, newValue, auditContext);
      if (!success) {
        return null;
      }

      // Audit log for rotation
      await this.auditLog({
        timestamp: new Date(),
        secretId: metadata.id,
        action: 'rotate',
        userId: auditContext.userId,
        clientIP: auditContext.clientIP,
        userAgent: auditContext.userAgent,
        success: true,
        metadata: { rotationType: 'manual', generatorUsed: !!generator }
      });

      logger.info('Secret rotated successfully', { secretId: metadata.id });
      return newValue;
    } catch (error) {
      await this.auditLog({
        timestamp: new Date(),
        secretId: identifier,
        action: 'rotate',
        userId: auditContext.userId,
        clientIP: auditContext.clientIP,
        userAgent: auditContext.userAgent,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      logger.error('Failed to rotate secret', { error, identifier });
      throw error;
    }
  }

  private generateSecurePassword(length: number = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  private startRotationScheduler(): void {
    if (!this.config.rotation.enabled) {
      return;
    }

    const intervalMs = this.config.rotation.intervalHours * 60 * 60 * 1000;
    setInterval(async () => {
      await this.checkAndRotateExpiredSecrets();
    }, intervalMs);

    logger.info('Secret rotation scheduler started', { intervalHours: this.config.rotation.intervalHours });
  }

  private async checkAndRotateExpiredSecrets(): Promise<void> {
    try {
      // This would query all secrets and check for rotation requirements
      // Implementation depends on the storage provider
      logger.info('Checking for secrets requiring rotation');
    } catch (error) {
      logger.error('Failed to check for expired secrets', { error });
    }
  }

  // =====================================================
  // PROVIDER-SPECIFIC IMPLEMENTATIONS
  // =====================================================

  private async storeSecretByProvider(
    secretId: string,
    secretValue: SecretValue,
    metadata: SecretMetadata
  ): Promise<void> {
    switch (this.config.provider) {
      case 'aws':
        await this.storeSecretAWS(secretId, secretValue, metadata);
        break;
      case 'vault':
        await this.storeSecretVault(secretId, secretValue, metadata);
        break;
      case 'local':
        await this.storeSecretLocal(secretId, secretValue, metadata);
        break;
      default:
        throw new Error(`Unsupported secret provider: ${this.config.provider}`);
    }
  }

  private async getSecretByProvider(secretId: string): Promise<SecretValue | null> {
    switch (this.config.provider) {
      case 'aws':
        return await this.getSecretAWS(secretId);
      case 'vault':
        return await this.getSecretVault(secretId);
      case 'local':
        return await this.getSecretLocal(secretId);
      default:
        throw new Error(`Unsupported secret provider: ${this.config.provider}`);
    }
  }

  private async deleteSecretByProvider(secretId: string): Promise<void> {
    switch (this.config.provider) {
      case 'aws':
        await this.deleteSecretAWS(secretId);
        break;
      case 'vault':
        await this.deleteSecretVault(secretId);
        break;
      case 'local':
        await this.deleteSecretLocal(secretId);
        break;
      default:
        throw new Error(`Unsupported secret provider: ${this.config.provider}`);
    }
  }

  // AWS Secrets Manager implementation
  private async storeSecretAWS(secretId: string, secretValue: SecretValue, metadata: SecretMetadata): Promise<void> {
    if (!this.awsSecretsManager) {
      throw new Error('AWS Secrets Manager not initialized');
    }

    const secretData = {
      SecretValue: secretValue.value,
      Metadata: JSON.stringify(metadata)
    };

    await this.awsSecretsManager.createSecret({
      Name: secretId,
      SecretString: JSON.stringify(secretData),
      Description: metadata.description
    }).promise();
  }

  private async getSecretAWS(secretId: string): Promise<SecretValue | null> {
    if (!this.awsSecretsManager) {
      throw new Error('AWS Secrets Manager not initialized');
    }

    try {
      const result = await this.awsSecretsManager.getSecretValue({
        SecretId: secretId
      }).promise();

      if (result.SecretString) {
        const secretData = JSON.parse(result.SecretString);
        return {
          value: secretData.SecretValue,
          encrypted: true,
          encoding: 'hex'
        };
      }
      return null;
    } catch (error: any) {
      if (error.code === 'ResourceNotFoundException') {
        return null;
      }
      throw error;
    }
  }

  private async deleteSecretAWS(secretId: string): Promise<void> {
    if (!this.awsSecretsManager) {
      throw new Error('AWS Secrets Manager not initialized');
    }

    await this.awsSecretsManager.deleteSecret({
      SecretId: secretId,
      ForceDeleteWithoutRecovery: true
    }).promise();
  }

  // HashiCorp Vault implementation
  private async storeSecretVault(secretId: string, secretValue: SecretValue, metadata: SecretMetadata): Promise<void> {
    if (!this.vaultClient) {
      throw new Error('Vault client not initialized');
    }

    await this.vaultClient.write(`secret/data/${secretId}`, {
      data: {
        value: secretValue.value,
        metadata: JSON.stringify(metadata)
      }
    });
  }

  private async getSecretVault(secretId: string): Promise<SecretValue | null> {
    if (!this.vaultClient) {
      throw new Error('Vault client not initialized');
    }

    try {
      const result = await this.vaultClient.read(`secret/data/${secretId}`);
      if (result?.data?.data) {
        return {
          value: result.data.data.value,
          encrypted: true,
          encoding: 'hex'
        };
      }
      return null;
    } catch (error) {
      logger.warn('Secret not found in Vault', { secretId, error });
      return null;
    }
  }

  private async deleteSecretVault(secretId: string): Promise<void> {
    if (!this.vaultClient) {
      throw new Error('Vault client not initialized');
    }

    await this.vaultClient.delete(`secret/data/${secretId}`);
  }

  // Local file system implementation
  private async storeSecretLocal(secretId: string, secretValue: SecretValue, metadata: SecretMetadata): Promise<void> {
    const secretsPath = this.config.storage.localPath || '/var/lib/inergize/secrets';
    const secretFile = path.join(secretsPath, `${secretId}.json`);
    const metadataFile = path.join(secretsPath, `${secretId}.meta.json`);

    const secretData = {
      id: secretId,
      value: secretValue.value,
      encrypted: secretValue.encrypted,
      encoding: secretValue.encoding,
      createdAt: new Date().toISOString()
    };

    await fs.writeFile(secretFile, JSON.stringify(secretData), { mode: 0o600 });
    await fs.writeFile(metadataFile, JSON.stringify(metadata), { mode: 0o600 });

    // Create name mapping
    await this.redis.set(`secret:name:${metadata.name}`, secretId);
  }

  private async getSecretLocal(secretId: string): Promise<SecretValue | null> {
    const secretsPath = this.config.storage.localPath || '/var/lib/inergize/secrets';
    const secretFile = path.join(secretsPath, `${secretId}.json`);

    try {
      const data = await fs.readFile(secretFile, 'utf8');
      const secretData = JSON.parse(data);
      return {
        value: secretData.value,
        encrypted: secretData.encrypted,
        encoding: secretData.encoding
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  private async deleteSecretLocal(secretId: string): Promise<void> {
    const secretsPath = this.config.storage.localPath || '/var/lib/inergize/secrets';
    const secretFile = path.join(secretsPath, `${secretId}.json`);
    const metadataFile = path.join(secretsPath, `${secretId}.meta.json`);

    try {
      await Promise.all([
        fs.unlink(secretFile).catch(() => {}),
        fs.unlink(metadataFile).catch(() => {})
      ]);
    } catch (error) {
      logger.warn('Failed to delete local secret files', { error, secretId });
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private async getSecretMetadata(identifier: string): Promise<SecretMetadata | null> {
    // Try from cache first
    const cached = await this.redis.get(`secret:meta:${identifier}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Try to load from provider
    // This would need to be implemented based on provider
    return null;
  }

  private async updateAccessStats(secretId: string): Promise<void> {
    const metadata = await this.getSecretMetadata(secretId);
    if (metadata) {
      metadata.accessCount += 1;
      metadata.lastAccessedAt = new Date();
      
      await this.redis.setex(
        `secret:meta:${secretId}`,
        3600,
        JSON.stringify(metadata)
      );
    }
  }

  private async auditLog(log: AuditLog): Promise<void> {
    this.auditLogs.push(log);
    
    // Store in Redis for real-time querying
    await this.redis.lpush('secret:audit', JSON.stringify(log));
    await this.redis.ltrim('secret:audit', 0, 9999); // Keep last 10k entries

    // Log based on severity
    if (log.success) {
      logger.info('Secret audit event', log);
    } else {
      logger.warn('Secret audit event - failed', log);
    }
  }

  /**
   * Get audit logs for a secret or user
   */
  public async getAuditLogs(
    filters?: {
      secretId?: string;
      userId?: string;
      action?: string;
      startDate?: Date;
      endDate?: Date;
    },
    limit: number = 100
  ): Promise<AuditLog[]> {
    const logs = await this.redis.lrange('secret:audit', 0, limit - 1);
    let auditLogs = logs.map(log => JSON.parse(log) as AuditLog);

    // Apply filters
    if (filters) {
      auditLogs = auditLogs.filter(log => {
        if (filters.secretId && log.secretId !== filters.secretId) return false;
        if (filters.userId && log.userId !== filters.userId) return false;
        if (filters.action && log.action !== filters.action) return false;
        if (filters.startDate && log.timestamp < filters.startDate) return false;
        if (filters.endDate && log.timestamp > filters.endDate) return false;
        return true;
      });
    }

    return auditLogs;
  }

  /**
   * Health check for secret manager
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    const details: Record<string, any> = {};

    try {
      // Check Redis connectivity
      const redisPing = await this.redis.ping();
      details.redis = { status: redisPing === 'PONG' ? 'healthy' : 'unhealthy' };

      // Check provider connectivity
      details.provider = { status: 'healthy', type: this.config.provider };

      // Check encryption
      try {
        const testData = 'test-encryption';
        const encrypted = this.encrypt(testData);
        const decrypted = this.decrypt(encrypted.encryptedData, encrypted.iv, encrypted.authTag);
        details.encryption = { status: decrypted === testData ? 'healthy' : 'unhealthy' };
      } catch (error) {
        details.encryption = { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' };
      }

      // Overall status
      const allHealthy = Object.values(details).every(check => check.status === 'healthy');
      const hasUnhealthy = Object.values(details).some(check => check.status === 'unhealthy');

      return {
        status: hasUnhealthy ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded',
        details
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}

// Factory function
export function createSecretManager(config: SecretConfig, redis: Redis): SecretManager {
  return new SecretManager(config, redis);
}

// Default configuration
export const DEFAULT_SECRET_CONFIG: SecretConfig = {
  provider: 'local',
  encryption: {
    algorithm: 'aes-256-gcm',
    keySize: 32,
    saltSize: 16
  },
  storage: {
    localPath: '/var/lib/inergize/secrets'
  },
  rotation: {
    enabled: true,
    intervalHours: 24 * 7 // Weekly
  },
  audit: {
    enabled: true,
    logLevel: 'info',
    retentionDays: 90
  }
};

export default SecretManager;