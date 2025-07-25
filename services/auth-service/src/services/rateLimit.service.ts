// Rate Limiting Service for authentication security

import Redis from 'ioredis';
import { LoginAttempt } from '../types/auth';

export class RateLimitService {
  private redis: Redis;
  private maxLoginAttempts: number;
  private lockoutDuration: number; // in minutes
  private attemptWindow: number; // in minutes

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    });

    this.maxLoginAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
    this.lockoutDuration = parseInt(process.env.LOCKOUT_DURATION_MINUTES || '15');
    this.attemptWindow = parseInt(process.env.ATTEMPT_WINDOW_MINUTES || '15');
  }

  /**
   * Check if IP or email is rate limited
   */
  async isRateLimited(identifier: string, type: 'ip' | 'email' = 'ip'): Promise<{
    isLimited: boolean;
    remainingAttempts: number;
    resetTime?: Date;
  }> {
    const key = `rate_limit:${type}:${identifier}`;
    const lockoutKey = `lockout:${type}:${identifier}`;

    // Check if currently locked out
    const lockoutExpiry = await this.redis.get(lockoutKey);
    if (lockoutExpiry) {
      return {
        isLimited: true,
        remainingAttempts: 0,
        resetTime: new Date(parseInt(lockoutExpiry)),
      };
    }

    // Get current attempt count
    const attempts = await this.redis.get(key);
    const attemptCount = attempts ? parseInt(attempts) : 0;

    const remainingAttempts = Math.max(0, this.maxLoginAttempts - attemptCount);
    const isLimited = attemptCount >= this.maxLoginAttempts;

    if (isLimited) {
      // Set lockout
      const lockoutExpiry = Date.now() + (this.lockoutDuration * 60 * 1000);
      await this.redis.setex(lockoutKey, this.lockoutDuration * 60, lockoutExpiry.toString());
      
      return {
        isLimited: true,
        remainingAttempts: 0,
        resetTime: new Date(lockoutExpiry),
      };
    }

    return {
      isLimited: false,
      remainingAttempts,
    };
  }

  /**
   * Record login attempt
   */
  async recordLoginAttempt(
    email: string,
    ipAddress: string,
    userAgent: string,
    success: boolean
  ): Promise<void> {
    const timestamp = Date.now();
    
    // Record attempt in database/logs for analytics
    const attempt: LoginAttempt = {
      email,
      ipAddress,
      userAgent,
      success,
      timestamp: new Date(timestamp),
    };

    // Store in Redis for quick access (optional - for detailed analytics)
    await this.redis.lpush(
      'login_attempts',
      JSON.stringify(attempt)
    );

    // Keep only last 1000 attempts
    await this.redis.ltrim('login_attempts', 0, 999);

    if (!success) {
      // Increment failure counters
      await this.incrementFailureCount(email, 'email');
      await this.incrementFailureCount(ipAddress, 'ip');
    } else {
      // Reset counters on successful login
      await this.resetFailureCount(email, 'email');
      await this.resetFailureCount(ipAddress, 'ip');
    }
  }

  /**
   * Increment failure count for identifier
   */
  private async incrementFailureCount(identifier: string, type: 'ip' | 'email'): Promise<void> {
    const key = `rate_limit:${type}:${identifier}`;
    
    const current = await this.redis.incr(key);
    
    // Set expiry on first attempt
    if (current === 1) {
      await this.redis.expire(key, this.attemptWindow * 60);
    }
  }

  /**
   * Reset failure count for identifier
   */
  async resetFailureCount(identifier: string, type: 'ip' | 'email'): Promise<void> {
    const key = `rate_limit:${type}:${identifier}`;
    const lockoutKey = `lockout:${type}:${identifier}`;
    
    await Promise.all([
      this.redis.del(key),
      this.redis.del(lockoutKey)
    ]);
  }

  /**
   * Get current attempt count
   */
  async getAttemptCount(identifier: string, type: 'ip' | 'email' = 'ip'): Promise<number> {
    const key = `rate_limit:${type}:${identifier}`;
    const attempts = await this.redis.get(key);
    return attempts ? parseInt(attempts) : 0;
  }

  /**
   * Check if specific action is rate limited (e.g., password reset)
   */
  async isActionRateLimited(
    identifier: string,
    action: string,
    maxAttempts: number = 3,
    windowMinutes: number = 60
  ): Promise<{
    isLimited: boolean;
    remainingAttempts: number;
    resetTime?: Date;
  }> {
    const key = `action_limit:${action}:${identifier}`;
    
    const attempts = await this.redis.get(key);
    const attemptCount = attempts ? parseInt(attempts) : 0;
    
    const remainingAttempts = Math.max(0, maxAttempts - attemptCount);
    const isLimited = attemptCount >= maxAttempts;
    
    let resetTime: Date | undefined;
    if (isLimited) {
      const ttl = await this.redis.ttl(key);
      if (ttl > 0) {
        resetTime = new Date(Date.now() + (ttl * 1000));
      }
    }

    return {
      isLimited,
      remainingAttempts,
      resetTime,
    };
  }

  /**
   * Record action attempt (e.g., password reset, email verification)
   */
  async recordActionAttempt(
    identifier: string,
    action: string,
    maxAttempts: number = 3,
    windowMinutes: number = 60
  ): Promise<void> {
    const key = `action_limit:${action}:${identifier}`;
    
    const current = await this.redis.incr(key);
    
    // Set expiry on first attempt
    if (current === 1) {
      await this.redis.expire(key, windowMinutes * 60);
    }
  }

  /**
   * Get login attempts for analysis
   */
  async getRecentLoginAttempts(limit: number = 100): Promise<LoginAttempt[]> {
    const attempts = await this.redis.lrange('login_attempts', 0, limit - 1);
    return attempts.map(attempt => JSON.parse(attempt));
  }

  /**
   * Get suspicious IP activities
   */
  async getSuspiciousIPs(threshold: number = 10): Promise<{
    ip: string;
    attemptCount: number;
    isLocked: boolean;
  }[]> {
    const pattern = 'rate_limit:ip:*';
    const keys = await this.redis.keys(pattern);
    const suspicious: { ip: string; attemptCount: number; isLocked: boolean; }[] = [];

    for (const key of keys) {
      const ip = key.replace('rate_limit:ip:', '');
      const attempts = await this.redis.get(key);
      const attemptCount = attempts ? parseInt(attempts) : 0;
      
      if (attemptCount >= threshold) {
        const lockoutKey = `lockout:ip:${ip}`;
        const isLocked = await this.redis.exists(lockoutKey) > 0;
        
        suspicious.push({
          ip,
          attemptCount,
          isLocked,
        });
      }
    }

    return suspicious.sort((a, b) => b.attemptCount - a.attemptCount);
  }

  /**
   * Block IP address manually
   */
  async blockIP(ipAddress: string, durationMinutes: number = 60): Promise<void> {
    const lockoutKey = `lockout:ip:${ipAddress}`;
    const lockoutExpiry = Date.now() + (durationMinutes * 60 * 1000);
    
    await this.redis.setex(lockoutKey, durationMinutes * 60, lockoutExpiry.toString());
  }

  /**
   * Unblock IP address
   */
  async unblockIP(ipAddress: string): Promise<void> {
    await this.resetFailureCount(ipAddress, 'ip');
  }

  /**
   * Check if request is from suspicious location
   */
  async checkSuspiciousActivity(
    email: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{
    isSuspicious: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];
    let isSuspicious = false;

    // Check for rapid attempts from different IPs for same email
    const emailKey = `recent_ips:${email}`;
    const recentIps = await this.redis.smembers(emailKey);
    
    if (recentIps.length > 3) {
      reasons.push('Multiple IP addresses used recently');
      isSuspicious = true;
    }

    // Add current IP to recent IPs set
    await this.redis.sadd(emailKey, ipAddress);
    await this.redis.expire(emailKey, 60 * 60); // 1 hour

    // Check for unusual user agent patterns
    if (this.isUnusualUserAgent(userAgent)) {
      reasons.push('Unusual user agent detected');
      isSuspicious = true;
    }

    // Check if IP has failed many times across different emails
    const ipAttempts = await this.getAttemptCount(ipAddress, 'ip');
    if (ipAttempts > 20) {
      reasons.push('High failure rate from IP address');
      isSuspicious = true;
    }

    return { isSuspicious, reasons };
  }

  /**
   * Check for unusual user agent patterns
   */
  private isUnusualUserAgent(userAgent: string): boolean {
    if (!userAgent || userAgent.length < 20) {
      return true;
    }

    // Check for bot-like patterns
    const botPatterns = [
      'bot', 'crawler', 'spider', 'scraper', 'wget', 'curl',
      'python-requests', 'postman', 'insomnia'
    ];

    const lowerUA = userAgent.toLowerCase();
    return botPatterns.some(pattern => lowerUA.includes(pattern));
  }

  /**
   * Get rate limit status for multiple identifiers
   */
  async getRateLimitStatus(identifiers: { value: string; type: 'ip' | 'email' }[]): Promise<Map<string, {
    isLimited: boolean;
    remainingAttempts: number;
    resetTime?: Date;
  }>> {
    const results = new Map();

    for (const { value, type } of identifiers) {
      const status = await this.isRateLimited(value, type);
      results.set(`${type}:${value}`, status);
    }

    return results;
  }

  /**
   * Close Redis connection  
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}