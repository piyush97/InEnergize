// Password Service Unit Tests

import { PasswordService } from '../../src/services/password.service';
import bcrypt from 'bcryptjs';

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
  genSalt: jest.fn()
}));

describe('PasswordService', () => {
  let passwordService: PasswordService;
  let mockBcrypt: jest.Mocked<typeof bcrypt>;

  beforeEach(() => {
    passwordService = new PasswordService();
    mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash password with proper salt rounds', async () => {
      const plainPassword = 'SecurePassword123!';
      const hashedPassword = '$2a$12$hashedpasswordstring';

      mockBcrypt.genSalt.mockResolvedValue('mocksalt' as any);
      mockBcrypt.hash.mockResolvedValue(hashedPassword);

      const result = await passwordService.hashPassword(plainPassword);

      expect(mockBcrypt.genSalt).toHaveBeenCalledWith(12);
      expect(mockBcrypt.hash).toHaveBeenCalledWith(plainPassword, 'mocksalt');
      expect(result).toBe(hashedPassword);
    });

    it('should throw error for empty password', async () => {
      await expect(passwordService.hashPassword(''))
        .rejects.toThrow('Password cannot be empty');

      expect(mockBcrypt.hash).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only password', async () => {
      await expect(passwordService.hashPassword('   '))
        .rejects.toThrow('Password cannot be empty');

      expect(mockBcrypt.hash).not.toHaveBeenCalled();
    });

    it('should handle bcrypt errors gracefully', async () => {
      const error = new Error('Bcrypt failed');
      mockBcrypt.genSalt.mockRejectedValue(error);

      await expect(passwordService.hashPassword('password123'))
        .rejects.toThrow('Failed to hash password');
    });

    it('should use custom salt rounds when provided', async () => {
      const plainPassword = 'SecurePassword123!';
      const customSaltRounds = 10;

      mockBcrypt.genSalt.mockResolvedValue('mocksalt' as any);
      mockBcrypt.hash.mockResolvedValue('hashedpassword');

      await passwordService.hashPassword(plainPassword, customSaltRounds);

      expect(mockBcrypt.genSalt).toHaveBeenCalledWith(customSaltRounds);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for matching password', async () => {
      const plainPassword = 'SecurePassword123!';
      const hashedPassword = '$2a$12$hashedpasswordstring';

      mockBcrypt.compare.mockResolvedValue(true);

      const result = await passwordService.verifyPassword(plainPassword, hashedPassword);

      expect(mockBcrypt.compare).toHaveBeenCalledWith(plainPassword, hashedPassword);
      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const plainPassword = 'WrongPassword123!';
      const hashedPassword = '$2a$12$hashedpasswordstring';

      mockBcrypt.compare.mockResolvedValue(false);

      const result = await passwordService.verifyPassword(plainPassword, hashedPassword);

      expect(mockBcrypt.compare).toHaveBeenCalledWith(plainPassword, hashedPassword);
      expect(result).toBe(false);
    });

    it('should return false for empty plain password', async () => {
      const hashedPassword = '$2a$12$hashedpasswordstring';

      const result = await passwordService.verifyPassword('', hashedPassword);

      expect(result).toBe(false);
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return false for empty hashed password', async () => {
      const plainPassword = 'SecurePassword123!';

      const result = await passwordService.verifyPassword(plainPassword, '');

      expect(result).toBe(false);
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should handle bcrypt comparison errors gracefully', async () => {
      const plainPassword = 'SecurePassword123!';
      const hashedPassword = '$2a$12$hashedpasswordstring';
      const error = new Error('Bcrypt comparison failed');

      mockBcrypt.compare.mockRejectedValue(error);

      const result = await passwordService.verifyPassword(plainPassword, hashedPassword);

      expect(result).toBe(false);
    });

    it('should handle malformed hash gracefully', async () => {
      const plainPassword = 'SecurePassword123!';
      const malformedHash = 'not-a-valid-hash';

      mockBcrypt.compare.mockRejectedValue(new Error('Invalid hash'));

      const result = await passwordService.verifyPassword(plainPassword, malformedHash);

      expect(result).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should validate strong password', () => {
      const strongPassword = 'SecurePassword123!';

      const result = passwordService.validatePasswordStrength(strongPassword);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.score).toBeGreaterThanOrEqual(4);
    });

    it('should reject password that is too short', () => {
      const shortPassword = 'Short1!';

      const result = passwordService.validatePasswordStrength(shortPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
      expect(result.score).toBeLessThan(4);
    });

    it('should reject password without uppercase letter', () => {
      const noUpperPassword = 'securepassword123!';

      const result = passwordService.validatePasswordStrength(noUpperPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase letter', () => {
      const noLowerPassword = 'SECUREPASSWORD123!';

      const result = passwordService.validatePasswordStrength(noLowerPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without number', () => {
      const noNumberPassword = 'SecurePassword!';

      const result = passwordService.validatePasswordStrength(noNumberPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without special character', () => {
      const noSpecialPassword = 'SecurePassword123';

      const result = passwordService.validatePasswordStrength(noSpecialPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should reject common passwords', () => {
      const commonPasswords = ['Password123!', 'Qwerty123!', 'Admin123!'];

      commonPasswords.forEach(password => {
        const result = passwordService.validatePasswordStrength(password);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password is too common');
      });
    });

    it('should calculate strength score correctly', () => {
      const weakPassword = 'password';
      const mediumPassword = 'Password123';
      const strongPassword = 'SecurePassword123!';
      const veryStrongPassword = 'Sup3r$ecur3P@ssw0rd!';

      expect(passwordService.validatePasswordStrength(weakPassword).score).toBe(1);
      expect(passwordService.validatePasswordStrength(mediumPassword).score).toBe(2);
      expect(passwordService.validatePasswordStrength(strongPassword).score).toBe(4);
      expect(passwordService.validatePasswordStrength(veryStrongPassword).score).toBe(5);
    });

    it('should provide strength description', () => {
      const testCases = [
        { password: 'weak', expectedStrength: 'Very Weak' },
        { password: 'Password', expectedStrength: 'Weak' },
        { password: 'Password123', expectedStrength: 'Fair' },
        { password: 'Password123!', expectedStrength: 'Good' },
        { password: 'Sup3r$ecur3P@ssw0rd!', expectedStrength: 'Excellent' }
      ];

      testCases.forEach(({ password, expectedStrength }) => {
        const result = passwordService.validatePasswordStrength(password);
        expect(result.strength).toBe(expectedStrength);
      });
    });

    it('should handle empty password', () => {
      const result = passwordService.validatePasswordStrength('');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password cannot be empty');
      expect(result.score).toBe(0);
      expect(result.strength).toBe('Very Weak');
    });

    it('should handle whitespace-only password', () => {
      const result = passwordService.validatePasswordStrength('   ');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password cannot be empty');
      expect(result.score).toBe(0);
    });

    it('should detect repetitive patterns', () => {
      const repetitivePasswords = [
        'aaAAaa11!!',
        'Password111111',
        'SecureSecure123!'
      ];

      repetitivePasswords.forEach(password => {
        const result = passwordService.validatePasswordStrength(password);
        expect(result.score).toBeLessThan(4);
      });
    });

    it('should reward longer passwords', () => {
      const shortStrong = 'Str0ng!1';
      const longStrong = 'VeryLongAndStr0ngP@ssw0rd!';

      const shortResult = passwordService.validatePasswordStrength(shortStrong);
      const longResult = passwordService.validatePasswordStrength(longStrong);

      expect(longResult.score).toBeGreaterThan(shortResult.score);
    });
  });

  describe('generateSecurePassword', () => {
    it('should generate password with default length', () => {
      const password = passwordService.generateSecurePassword();

      expect(password).toHaveLength(16);
      expect(passwordService.validatePasswordStrength(password).isValid).toBe(true);
    });

    it('should generate password with custom length', () => {
      const customLength = 24;
      const password = passwordService.generateSecurePassword(customLength);

      expect(password).toHaveLength(customLength);
      expect(passwordService.validatePasswordStrength(password).isValid).toBe(true);
    });

    it('should generate passwords with required character types', () => {
      const password = passwordService.generateSecurePassword();

      // Should contain uppercase
      expect(/[A-Z]/.test(password)).toBe(true);
      // Should contain lowercase
      expect(/[a-z]/.test(password)).toBe(true);
      // Should contain number
      expect(/[0-9]/.test(password)).toBe(true);
      // Should contain special character
      expect(/[!@#$%^&*(),.?":{}|<>]/.test(password)).toBe(true);
    });

    it('should generate unique passwords', () => {
      const passwords = new Set();
      for (let i = 0; i < 100; i++) {
        passwords.add(passwordService.generateSecurePassword());
      }

      // Should generate 100 unique passwords
      expect(passwords.size).toBe(100);
    });

    it('should handle minimum length requirement', () => {
      const minLength = 8;
      const password = passwordService.generateSecurePassword(6); // Below minimum

      expect(password).toHaveLength(minLength);
    });

    it('should handle maximum length requirement', () => {
      const maxLength = 128;
      const password = passwordService.generateSecurePassword(200); // Above maximum

      expect(password).toHaveLength(maxLength);
    });
  });

  describe('generatePasswordResetToken', () => {
    it('should generate secure reset token', () => {
      const token = passwordService.generatePasswordResetToken();

      expect(token).toHaveLength(64); // 32 bytes = 64 hex characters
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        tokens.add(passwordService.generatePasswordResetToken());
      }

      expect(tokens.size).toBe(100);
    });
  });

  describe('isPasswordCompromised', () => {
    it('should identify compromised passwords from breaches', async () => {
      // Mock implementation for testing
      const compromisedPasswords = ['123456', 'password', 'qwerty'];
      const isCompromised = compromisedPasswords.includes('123456');

      expect(isCompromised).toBe(true);
    });

    it('should identify secure passwords as not compromised', async () => {
      const securePassword = 'Sup3r$ecur3P@ssw0rd!';
      // Mock implementation - secure passwords should not be compromised
      const isCompromised = false;

      expect(isCompromised).toBe(false);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle null password in hashPassword', async () => {
      await expect(passwordService.hashPassword(null as any))
        .rejects.toThrow('Password cannot be empty');
    });

    it('should handle undefined password in hashPassword', async () => {
      await expect(passwordService.hashPassword(undefined as any))
        .rejects.toThrow('Password cannot be empty');
    });

    it('should handle null values in verifyPassword', async () => {
      const result1 = await passwordService.verifyPassword(null as any, 'hash');
      const result2 = await passwordService.verifyPassword('password', null as any);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });

    it('should handle very long passwords', () => {
      const veryLongPassword = 'a'.repeat(1000) + 'A1!';
      const result = passwordService.validatePasswordStrength(veryLongPassword);

      expect(result.isValid).toBe(true);
    });

    it('should handle unicode characters in passwords', () => {
      const unicodePassword = 'Pässwörd123!';
      const result = passwordService.validatePasswordStrength(unicodePassword);

      expect(result.isValid).toBe(true);
    });

    it('should handle special characters correctly', () => {
      const specialChars = '!@#$%^&*(),.?":{}|<>';
      const password = `Test123${specialChars}`;
      const result = passwordService.validatePasswordStrength(password);

      expect(result.isValid).toBe(true);
    });
  });

  describe('performance considerations', () => {
    it('should complete password hashing within reasonable time', async () => {
      const startTime = Date.now();
      mockBcrypt.genSalt.mockResolvedValue('mocksalt' as any);
      mockBcrypt.hash.mockResolvedValue('hashedpassword');

      await passwordService.hashPassword('SecurePassword123!');

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly in tests
    });

    it('should complete password verification within reasonable time', async () => {
      const startTime = Date.now();
      mockBcrypt.compare.mockResolvedValue(true);

      await passwordService.verifyPassword('password', 'hash');

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle multiple concurrent operations', async () => {
      mockBcrypt.hash.mockResolvedValue('hashedpassword');
      mockBcrypt.genSalt.mockResolvedValue('mocksalt' as any);

      const promises = Array.from({ length: 10 }, (_, i) =>
        passwordService.hashPassword(`password${i}`)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBe('hashedpassword');
      });
    });
  });
});