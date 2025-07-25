// Password Service for secure password handling

import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export class PasswordService {
  private saltRounds: number;
  private minPasswordLength: number;

  constructor() {
    this.saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
    this.minPasswordLength = parseInt(process.env.MIN_PASSWORD_LENGTH || '8');
  }

  /**
   * Hash password with salt
   */
  async hashPassword(password: string): Promise<string> {
    if (!this.isValidPassword(password)) {
      throw new Error('Password does not meet security requirements');
    }

    return await bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Compare password with hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate password strength
   */
  isValidPassword(password: string): boolean {
    if (!password || password.length < this.minPasswordLength) {
      return false;
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      return false;
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      return false;
    }

    // Check for at least one digit
    if (!/\d/.test(password)) {
      return false;
    }

    // Check for at least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return false;
    }

    return true;
  }

  /**
   * Get password strength score (0-4)
   */
  getPasswordStrength(password: string): { score: number; feedback: string[] } {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length >= this.minPasswordLength) {
      score++;
    } else {
      feedback.push(`Password must be at least ${this.minPasswordLength} characters long`);
    }

    // Character variety checks
    if (/[a-z]/.test(password)) {
      score++;
    } else {
      feedback.push('Add lowercase letters');
    }

    if (/[A-Z]/.test(password)) {
      score++;
    } else {
      feedback.push('Add uppercase letters');
    }

    if (/\d/.test(password)) {
      score++;
    } else {
      feedback.push('Add numbers');
    }

    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      score++;
    } else {
      feedback.push('Add special characters');
    }

    // Additional length bonus
    if (password.length >= 12) {
      score = Math.min(score + 1, 5);
    }

    // Check for common patterns
    if (this.hasCommonPatterns(password)) {
      score = Math.max(score - 1, 0);
      feedback.push('Avoid common patterns and sequences');
    }

    return { score, feedback };
  }

  /**
   * Generate secure random password
   */
  generateSecurePassword(length: number = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const allChars = lowercase + uppercase + numbers + symbols;
    
    // Ensure at least one character from each category
    let password = '';
    password += this.getRandomChar(lowercase);
    password += this.getRandomChar(uppercase);
    password += this.getRandomChar(numbers);
    password += this.getRandomChar(symbols);
    
    // Fill remaining length with random characters
    for (let i = 4; i < length; i++) {
      password += this.getRandomChar(allChars);
    }
    
    // Shuffle the password to avoid predictable patterns
    return this.shuffleString(password);
  }

  /**
   * Generate password reset token
   */
  generateResetToken(): { token: string; hash: string; expiresAt: Date } {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    return { token, hash, expiresAt };
  }

  /**
   * Verify password reset token
   */
  verifyResetToken(token: string, hash: string): boolean {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    return this.secureCompare(tokenHash, hash);
  }

  /**
   * Check if password has been compromised (basic implementation)
   */
  async isPasswordCompromised(password: string): Promise<boolean> {
    // In a real implementation, you would check against Have I Been Pwned API
    // or maintain a local database of compromised passwords
    
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ];

    const lowerPassword = password.toLowerCase();
    return commonPasswords.some(common => lowerPassword.includes(common));
  }

  /**
   * Generate password hash for verification emails
   */
  generateEmailVerificationToken(): { token: string; hash: string; expiresAt: Date } {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    return { token, hash, expiresAt };
  }

  /**
   * Private helper methods
   */
  private hasCommonPatterns(password: string): boolean {
    // Check for keyboard patterns
    const keyboardPatterns = ['qwerty', 'asdf', '1234', 'abcd'];
    const lowerPassword = password.toLowerCase();
    
    return keyboardPatterns.some(pattern => lowerPassword.includes(pattern));
  }

  private getRandomChar(chars: string): string {
    const randomIndex = crypto.randomInt(0, chars.length);
    return chars[randomIndex];
  }

  private shuffleString(str: string): string {
    const array = str.split('');
    for (let i = array.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array.join('');
  }

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
   * Get password requirements for frontend display
   */
  getPasswordRequirements(): {
    minLength: number;
    requiresLowercase: boolean;
    requiresUppercase: boolean;
    requiresNumbers: boolean;
    requiresSpecialChars: boolean;
  } {
    return {
      minLength: this.minPasswordLength,
      requiresLowercase: true,
      requiresUppercase: true,
      requiresNumbers: true,
      requiresSpecialChars: true,
    };
  }
}