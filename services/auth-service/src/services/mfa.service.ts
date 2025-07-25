// Multi-Factor Authentication Service

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { MFASetupResponse } from '../types/auth';

export class MFAService {
  private appName: string;
  private issuer: string;

  constructor() {
    this.appName = process.env.MFA_APP_NAME || 'InErgize';
    this.issuer = process.env.MFA_ISSUER || 'InErgize LinkedIn Optimizer';
  }

  /**
   * Generate MFA secret and QR code for user setup
   */
  async generateMFASetup(userEmail: string): Promise<MFASetupResponse> {
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `${this.appName} (${userEmail})`,
      issuer: this.issuer,
      length: 32,
    });

    // Generate QR code URL
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    return {
      secret: secret.base32,
      qrCodeUrl,
      backupCodes,
    };
  }

  /**
   * Verify MFA token
   */
  verifyMFAToken(secret: string, token: string, window: number = 2): boolean {
    try {
      return speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window, // Allow some time drift (2 * 30s = 1 minute window)
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * Verify backup code
   */
  verifyBackupCode(userBackupCodes: string[], providedCode: string): { valid: boolean; remainingCodes: string[] } {
    const codeIndex = userBackupCodes.findIndex(code => 
      this.secureCompare(code, providedCode)
    );

    if (codeIndex === -1) {
      return { valid: false, remainingCodes: userBackupCodes };
    }

    // Remove used backup code
    const remainingCodes = [...userBackupCodes];
    remainingCodes.splice(codeIndex, 1);

    return { valid: true, remainingCodes };
  }

  /**
   * Generate backup codes for account recovery
   */
  generateBackupCodes(count: number = 8): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < count; i++) {
      // Generate 8-digit backup code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      // Format as XXXX-XXXX for better readability
      const formattedCode = `${code.substring(0, 4)}-${code.substring(4, 8)}`;
      codes.push(formattedCode);
    }

    return codes;
  }

  /**
   * Generate recovery codes for MFA reset
   */
  generateRecoveryCode(): string {
    // Generate a longer recovery code for MFA reset
    return crypto.randomBytes(16).toString('hex').toUpperCase();
  }

  /**
   * Validate recovery code format
   */
  isValidRecoveryCode(code: string): boolean {
    // Recovery codes should be 32 hex characters
    const recoveryCodeRegex = /^[A-F0-9]{32}$/;
    return recoveryCodeRegex.test(code.toUpperCase());
  }

  /**
   * Validate backup code format
   */
  isValidBackupCode(code: string): boolean {
    // Backup codes should be in format XXXX-XXXX
    const backupCodeRegex = /^[A-F0-9]{4}-[A-F0-9]{4}$/;
    return backupCodeRegex.test(code.toUpperCase());
  }

  /**
   * Validate TOTP token format
   */
  isValidTOTPToken(token: string): boolean {
    // TOTP tokens should be 6 digits
    const totpRegex = /^\d{6}$/;
    return totpRegex.test(token);
  }

  /**
   * Get current TOTP token for testing purposes (development only)
   */
  getCurrentToken(secret: string): string {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('getCurrentToken should not be used in production');
    }
    
    return speakeasy.totp({
      secret,
      encoding: 'base32',
    });
  }

  /**
   * Secure string comparison to prevent timing attacks
   */
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Hash backup codes for secure storage
   */
  hashBackupCodes(codes: string[]): string[] {
    return codes.map(code => {
      const hash = crypto.createHash('sha256');
      hash.update(code + process.env.MFA_BACKUP_SALT || 'default-salt');
      return hash.digest('hex');
    });
  }

  /**
   * Verify hashed backup code
   */
  verifyHashedBackupCode(hashedCodes: string[], providedCode: string): { valid: boolean; codeIndex: number } {
    const providedHash = crypto.createHash('sha256');
    providedHash.update(providedCode + (process.env.MFA_BACKUP_SALT || 'default-salt'));
    const providedHashHex = providedHash.digest('hex');

    const codeIndex = hashedCodes.findIndex(hashedCode => 
      this.secureCompare(hashedCode, providedHashHex)
    );

    return { valid: codeIndex !== -1, codeIndex };
  }

  /**
   * Generate time-based one-time password
   */
  generateTOTP(secret: string): string {
    return speakeasy.totp({
      secret,
      encoding: 'base32',
    });
  }

  /**
   * Get time remaining until next TOTP token
   */
  getTimeRemaining(): number {
    const now = Math.floor(Date.now() / 1000);
    const epoch = Math.floor(now / 30);
    const nextEpoch = (epoch + 1) * 30;
    return nextEpoch - now;
  }
}