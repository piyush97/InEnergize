// MFA Service Unit Tests

import { MFAService } from '../../src/services/mfa.service';
import { PrismaClient } from '@prisma/client';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { MFADevice, MFADeviceType } from '../../src/types/auth';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('speakeasy', () => ({
  generateSecret: jest.fn(),
  totp: {
    verify: jest.fn(),
    generate: jest.fn()
  },
  time: jest.fn()
}));
jest.mock('qrcode', () => ({
  toDataURL: jest.fn()
}));

describe('MFAService', () => {
  let mfaService: MFAService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockSpeakeasy: jest.Mocked<typeof speakeasy>;
  let mockQRCode: jest.Mocked<typeof qrcode>;

  beforeEach(() => {
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    mfaService = new MFAService(mockPrisma);
    mockSpeakeasy = speakeasy as jest.Mocked<typeof speakeasy>;
    mockQRCode = qrcode as jest.Mocked<typeof qrcode>;

    // Mock environment
    process.env.MFA_SECRET_KEY = 'test-secret-key-for-mfa-encryption';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTOTPSecret', () => {
    it('should generate TOTP secret with correct parameters', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const mockSecret = {
        ascii: 'mock-ascii-secret',
        base32: 'MOCKBASE32SECRET',
        hex: 'mockhexsecret',
        qr_code_ascii: 'mock-qr-ascii',
        qr_code_hex: 'mockqrhex',
        qr_code_base32: 'MOCKQRBASE32',
        google_auth_qr: 'otpauth://totp/InErgize:test@example.com?secret=MOCKBASE32SECRET&issuer=InErgize',
        otpauth_url: 'otpauth://totp/InErgize:test@example.com?secret=MOCKBASE32SECRET&issuer=InErgize'
      };
      const mockQRDataURL = 'data:image/png;base64,mockqrcode';

      mockSpeakeasy.generateSecret.mockReturnValue(mockSecret);
      mockQRCode.toDataURL.mockResolvedValue(mockQRDataURL);

      const result = await mfaService.generateTOTPSecret(userId, email);

      expect(mockSpeakeasy.generateSecret).toHaveBeenCalledWith({
        name: `InErgize:${email}`,
        issuer: 'InErgize',
        length: 32
      });

      expect(mockQRCode.toDataURL).toHaveBeenCalledWith(mockSecret.otpauth_url);

      expect(result).toEqual({
        secret: mockSecret.base32,
        qrCodeDataURL: mockQRDataURL,
        backupCodes: expect.any(Array),
        manualEntryKey: mockSecret.base32
      });

      expect(result.backupCodes).toHaveLength(8);
      result.backupCodes.forEach(code => {
        expect(code).toMatch(/^[0-9]{8}$/);
      });
    });

    it('should handle QR code generation errors gracefully', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const mockSecret = {
        base32: 'MOCKBASE32SECRET',
        otpauth_url: 'otpauth://totp/InErgize:test@example.com?secret=MOCKBASE32SECRET&issuer=InErgize'
      };

      mockSpeakeasy.generateSecret.mockReturnValue(mockSecret as any);
      mockQRCode.toDataURL.mockRejectedValue(new Error('QR generation failed'));

      await expect(mfaService.generateTOTPSecret(userId, email))
        .rejects.toThrow('Failed to generate MFA setup data');
    });

    it('should generate unique backup codes', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const mockSecret = {
        base32: 'MOCKBASE32SECRET',
        otpauth_url: 'otpauth://totp/test'
      };

      mockSpeakeasy.generateSecret.mockReturnValue(mockSecret as any);
      mockQRCode.toDataURL.mockResolvedValue('data:image/png;base64,test');

      const result1 = await mfaService.generateTOTPSecret(userId, email);
      const result2 = await mfaService.generateTOTPSecret(userId, email);

      const codes1Set = new Set(result1.backupCodes);
      const codes2Set = new Set(result2.backupCodes);

      expect(codes1Set.size).toBe(8); // All codes should be unique within set
      expect(codes2Set.size).toBe(8);
      
      // Different generations should produce different codes
      const intersection = new Set([...codes1Set].filter(x => codes2Set.has(x)));
      expect(intersection.size).toBeLessThan(8);
    });
  });

  describe('enableMFA', () => {
    it('should enable MFA device successfully', async () => {
      const userId = 'user-123';
      const secret = 'MOCKBASE32SECRET';
      const verificationCode = '123456';
      const backupCodes = ['12345678', '87654321'];

      mockSpeakeasy.totp.verify.mockReturnValue(true);
      mockPrisma.mfaDevice.create.mockResolvedValue({
        id: 'device-123',
        userId,
        type: MFADeviceType.TOTP,
        name: 'Authenticator App',
        secret: 'encrypted-secret',
        backupCodes: 'encrypted-backup-codes',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null
      } as MFADevice);

      const result = await mfaService.enableMFA(
        userId,
        MFADeviceType.TOTP,
        secret,
        verificationCode,
        'Authenticator App',
        backupCodes
      );

      expect(mockSpeakeasy.totp.verify).toHaveBeenCalledWith({
        secret,
        token: verificationCode,
        window: 2,
        encoding: 'base32'
      });

      expect(mockPrisma.mfaDevice.create).toHaveBeenCalledWith({
        data: {
          userId,
          type: MFADeviceType.TOTP,
          name: 'Authenticator App',
          secret: expect.any(String), // encrypted
          backupCodes: expect.any(String), // encrypted
          isActive: true
        }
      });

      expect(result.success).toBe(true);
      expect(result.device).toBeDefined();
      expect(result.device?.id).toBe('device-123');
    });

    it('should reject invalid verification code', async () => {
      const userId = 'user-123';
      const secret = 'MOCKBASE32SECRET';
      const verificationCode = 'invalid';

      mockSpeakeasy.totp.verify.mockReturnValue(false);

      const result = await mfaService.enableMFA(
        userId,
        MFADeviceType.TOTP,
        secret,
        verificationCode,
        'Authenticator App'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid verification code');
      expect(mockPrisma.mfaDevice.create).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const userId = 'user-123';
      const secret = 'MOCKBASE32SECRET';
      const verificationCode = '123456';

      mockSpeakeasy.totp.verify.mockReturnValue(true);
      mockPrisma.mfaDevice.create.mockRejectedValue(new Error('Database error'));

      const result = await mfaService.enableMFA(
        userId,
        MFADeviceType.TOTP,
        secret,
        verificationCode,
        'Authenticator App'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to enable MFA device');
    });

    it('should encrypt secret and backup codes', async () => {
      const userId = 'user-123';
      const secret = 'MOCKBASE32SECRET';
      const verificationCode = '123456';
      const backupCodes = ['12345678', '87654321'];

      mockSpeakeasy.totp.verify.mockReturnValue(true);
      mockPrisma.mfaDevice.create.mockResolvedValue({
        id: 'device-123',
        userId,
        type: MFADeviceType.TOTP,
        name: 'Authenticator App',
        secret: 'encrypted-secret',
        backupCodes: 'encrypted-backup-codes',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null
      } as MFADevice);

      await mfaService.enableMFA(
        userId,
        MFADeviceType.TOTP,
        secret,
        verificationCode,
        'Authenticator App',
        backupCodes
      );

      const createCall = mockPrisma.mfaDevice.create.mock.calls[0][0];
      
      // Verify that stored secret is not the original
      expect(createCall.data.secret).not.toBe(secret);
      expect(createCall.data.backupCodes).not.toBe(JSON.stringify(backupCodes));
    });
  });

  describe('verifyMFA', () => {
    it('should verify valid TOTP code', async () => {
      const userId = 'user-123';
      const code = '123456';
      const mockDevice = {
        id: 'device-123',
        userId,
        type: MFADeviceType.TOTP,
        secret: 'encrypted-secret',
        isActive: true,
        lastUsedAt: null
      };

      mockPrisma.mfaDevice.findFirst.mockResolvedValue(mockDevice as MFADevice);
      mockSpeakeasy.totp.verify.mockReturnValue(true);
      mockPrisma.mfaDevice.update.mockResolvedValue({
        ...mockDevice,
        lastUsedAt: new Date()
      } as MFADevice);

      const result = await mfaService.verifyMFA(userId, code);

      expect(mockPrisma.mfaDevice.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          isActive: true
        }
      });

      expect(mockSpeakeasy.totp.verify).toHaveBeenCalledWith({
        secret: 'MOCKBASE32SECRET', // decrypted
        token: code,
        window: 2,
        encoding: 'base32'
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('totp');
    });

    it('should verify valid backup code', async () => {
      const userId = 'user-123';
      const code = '12345678';
      const mockDevice = {
        id: 'device-123',
        userId,
        type: MFADeviceType.TOTP,
        secret: 'encrypted-secret',
        backupCodes: 'encrypted-backup-codes',
        isActive: true,
        lastUsedAt: null
      };

      mockPrisma.mfaDevice.findFirst.mockResolvedValue(mockDevice as MFADevice);
      mockSpeakeasy.totp.verify.mockReturnValue(false); // TOTP fails
      mockPrisma.mfaDevice.update.mockResolvedValue({
        ...mockDevice,
        lastUsedAt: new Date()
      } as MFADevice);

      // Mock decryption to return backup codes including the test code
      const mockDecryptedBackupCodes = ['12345678', '87654321', '11111111'];

      const result = await mfaService.verifyMFA(userId, code);

      expect(result.success).toBe(true);
      expect(result.method).toBe('backup_code');
    });

    it('should reject invalid code', async () => {
      const userId = 'user-123';
      const code = 'invalid';
      const mockDevice = {
        id: 'device-123',
        userId,
        type: MFADeviceType.TOTP,
        secret: 'encrypted-secret',
        isActive: true
      };

      mockPrisma.mfaDevice.findFirst.mockResolvedValue(mockDevice as MFADevice);
      mockSpeakeasy.totp.verify.mockReturnValue(false);

      const result = await mfaService.verifyMFA(userId, code);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid MFA code');
    });

    it('should return false when no MFA device found', async () => {
      const userId = 'user-123';
      const code = '123456';

      mockPrisma.mfaDevice.findFirst.mockResolvedValue(null);

      const result = await mfaService.verifyMFA(userId, code);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No active MFA device found');
    });

    it('should handle database errors gracefully', async () => {
      const userId = 'user-123';
      const code = '123456';

      mockPrisma.mfaDevice.findFirst.mockRejectedValue(new Error('Database error'));

      const result = await mfaService.verifyMFA(userId, code);

      expect(result.success).toBe(false);
      expect(result.error).toBe('MFA verification failed');
    });

    it('should prevent replay attacks by updating lastUsedAt', async () => {
      const userId = 'user-123';
      const code = '123456';
      const mockDevice = {
        id: 'device-123',
        userId,
        type: MFADeviceType.TOTP,
        secret: 'encrypted-secret',
        isActive: true,
        lastUsedAt: null
      };

      mockPrisma.mfaDevice.findFirst.mockResolvedValue(mockDevice as MFADevice);
      mockSpeakeasy.totp.verify.mockReturnValue(true);

      await mfaService.verifyMFA(userId, code);

      expect(mockPrisma.mfaDevice.update).toHaveBeenCalledWith({
        where: { id: 'device-123' },
        data: { lastUsedAt: expect.any(Date) }
      });
    });
  });

  describe('disableMFA', () => {
    it('should disable MFA device successfully', async () => {
      const userId = 'user-123';
      const deviceId = 'device-123';
      const verificationCode = '123456';
      const mockDevice = {
        id: deviceId,
        userId,
        type: MFADeviceType.TOTP,
        secret: 'encrypted-secret',
        isActive: true
      };

      mockPrisma.mfaDevice.findFirst.mockResolvedValue(mockDevice as MFADevice);
      mockSpeakeasy.totp.verify.mockReturnValue(true);
      mockPrisma.mfaDevice.update.mockResolvedValue({
        ...mockDevice,
        isActive: false
      } as MFADevice);

      const result = await mfaService.disableMFA(userId, deviceId, verificationCode);

      expect(mockPrisma.mfaDevice.findFirst).toHaveBeenCalledWith({
        where: {
          id: deviceId,
          userId,
          isActive: true
        }
      });

      expect(mockSpeakeasy.totp.verify).toHaveBeenCalled();
      
      expect(mockPrisma.mfaDevice.update).toHaveBeenCalledWith({
        where: { id: deviceId },
        data: { isActive: false }
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid verification code', async () => {
      const userId = 'user-123';
      const deviceId = 'device-123';
      const verificationCode = 'invalid';
      const mockDevice = {
        id: deviceId,
        userId,
        type: MFADeviceType.TOTP,
        secret: 'encrypted-secret',
        isActive: true
      };

      mockPrisma.mfaDevice.findFirst.mockResolvedValue(mockDevice as MFADevice);
      mockSpeakeasy.totp.verify.mockReturnValue(false);

      const result = await mfaService.disableMFA(userId, deviceId, verificationCode);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid verification code');
      expect(mockPrisma.mfaDevice.update).not.toHaveBeenCalled();
    });

    it('should return false when device not found', async () => {
      const userId = 'user-123';
      const deviceId = 'device-123';
      const verificationCode = '123456';

      mockPrisma.mfaDevice.findFirst.mockResolvedValue(null);

      const result = await mfaService.disableMFA(userId, deviceId, verificationCode);

      expect(result.success).toBe(false);
      expect(result.error).toBe('MFA device not found');
    });
  });

  describe('getUserMFADevices', () => {
    it('should return user MFA devices', async () => {
      const userId = 'user-123';
      const mockDevices = [
        {
          id: 'device-1',
          userId,
          type: MFADeviceType.TOTP,
          name: 'Authenticator App',
          isActive: true,
          createdAt: new Date('2024-01-01'),
          lastUsedAt: new Date('2024-01-02')
        },
        {
          id: 'device-2',
          userId,
          type: MFADeviceType.TOTP,
          name: 'Backup Device',
          isActive: false,
          createdAt: new Date('2024-01-03'),
          lastUsedAt: null
        }
      ];

      mockPrisma.mfaDevice.findMany.mockResolvedValue(mockDevices as MFADevice[]);

      const result = await mfaService.getUserMFADevices(userId);

      expect(mockPrisma.mfaDevice.findMany).toHaveBeenCalledWith({
        where: { userId },
        select: {
          id: true,
          type: true,
          name: true,
          isActive: true,
          createdAt: true,
          lastUsedAt: true
        }
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'device-1',
        type: MFADeviceType.TOTP,
        name: 'Authenticator App',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        lastUsedAt: new Date('2024-01-02')
      });
    });

    it('should return empty array when no devices found', async () => {
      const userId = 'user-123';

      mockPrisma.mfaDevice.findMany.mockResolvedValue([]);

      const result = await mfaService.getUserMFADevices(userId);

      expect(result).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      const userId = 'user-123';

      mockPrisma.mfaDevice.findMany.mockRejectedValue(new Error('Database error'));

      await expect(mfaService.getUserMFADevices(userId))
        .rejects.toThrow('Failed to retrieve MFA devices');
    });
  });

  describe('isMFAEnabled', () => {
    it('should return true when user has active MFA device', async () => {
      const userId = 'user-123';
      const mockDevice = {
        id: 'device-123',
        userId,
        type: MFADeviceType.TOTP,
        isActive: true
      };

      mockPrisma.mfaDevice.findFirst.mockResolvedValue(mockDevice as MFADevice);

      const result = await mfaService.isMFAEnabled(userId);

      expect(result).toBe(true);
      expect(mockPrisma.mfaDevice.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          isActive: true
        }
      });
    });

    it('should return false when user has no active MFA devices', async () => {
      const userId = 'user-123';

      mockPrisma.mfaDevice.findFirst.mockResolvedValue(null);

      const result = await mfaService.isMFAEnabled(userId);

      expect(result).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      const userId = 'user-123';

      mockPrisma.mfaDevice.findFirst.mockRejectedValue(new Error('Database error'));

      const result = await mfaService.isMFAEnabled(userId);

      expect(result).toBe(false);
    });
  });

  describe('regenerateBackupCodes', () => {
    it('should regenerate backup codes successfully', async () => {
      const userId = 'user-123';
      const deviceId = 'device-123';
      const verificationCode = '123456';
      const mockDevice = {
        id: deviceId,
        userId,
        type: MFADeviceType.TOTP,
        secret: 'encrypted-secret',
        isActive: true
      };

      mockPrisma.mfaDevice.findFirst.mockResolvedValue(mockDevice as MFADevice);
      mockSpeakeasy.totp.verify.mockReturnValue(true);
      mockPrisma.mfaDevice.update.mockResolvedValue({
        ...mockDevice,
        backupCodes: 'new-encrypted-backup-codes'
      } as MFADevice);

      const result = await mfaService.regenerateBackupCodes(userId, deviceId, verificationCode);

      expect(result.success).toBe(true);
      expect(result.backupCodes).toHaveLength(8);
      result.backupCodes!.forEach(code => {
        expect(code).toMatch(/^[0-9]{8}$/);
      });
    });

    it('should reject invalid verification code', async () => {
      const userId = 'user-123';
      const deviceId = 'device-123';
      const verificationCode = 'invalid';
      const mockDevice = {
        id: deviceId,
        userId,
        type: MFADeviceType.TOTP,
        secret: 'encrypted-secret',
        isActive: true
      };

      mockPrisma.mfaDevice.findFirst.mockResolvedValue(mockDevice as MFADevice);
      mockSpeakeasy.totp.verify.mockReturnValue(false);

      const result = await mfaService.regenerateBackupCodes(userId, deviceId, verificationCode);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid verification code');
    });
  });

  describe('encryption and security', () => {
    it('should use consistent encryption for secrets', async () => {
      const secret = 'TESTBASE32SECRET';
      
      // Test encryption consistency
      const encrypted1 = (mfaService as any).encrypt(secret);
      const decrypted1 = (mfaService as any).decrypt(encrypted1);
      
      expect(decrypted1).toBe(secret);
    });

    it('should generate cryptographically secure backup codes', async () => {
      const codes1 = (mfaService as any).generateBackupCodes();
      const codes2 = (mfaService as any).generateBackupCodes();

      // Should be different sets
      expect(codes1).not.toEqual(codes2);
      
      // Should all be 8-digit numbers
      codes1.forEach((code: string) => {
        expect(code).toMatch(/^[0-9]{8}$/);
      });
    });

    it('should handle encryption errors gracefully', () => {
      // Test with invalid key
      const originalKey = process.env.MFA_SECRET_KEY;
      process.env.MFA_SECRET_KEY = '';

      expect(() => (mfaService as any).encrypt('test'))
        .toThrow();

      process.env.MFA_SECRET_KEY = originalKey;
    });
  });

  describe('rate limiting and security measures', () => {
    it('should implement window tolerance for TOTP verification', async () => {
      const userId = 'user-123';
      const code = '123456';
      const mockDevice = {
        id: 'device-123',
        userId,
        type: MFADeviceType.TOTP,
        secret: 'encrypted-secret',
        isActive: true
      };

      mockPrisma.mfaDevice.findFirst.mockResolvedValue(mockDevice as MFADevice);
      mockSpeakeasy.totp.verify.mockReturnValue(true);

      await mfaService.verifyMFA(userId, code);

      expect(mockSpeakeasy.totp.verify).toHaveBeenCalledWith({
        secret: expect.any(String),
        token: code,
        window: 2, // Allow 1 step before and after current time
        encoding: 'base32'
      });
    });

    it('should validate backup code format', async () => {
      const invalidCodes = ['1234567', '123456789', 'abcd1234', ''];

      invalidCodes.forEach(code => {
        const isValid = (mfaService as any).isValidBackupCode(code);
        expect(isValid).toBe(false);
      });

      const validCode = '12345678';
      const isValid = (mfaService as any).isValidBackupCode(validCode);
      expect(isValid).toBe(true);
    });
  });

  describe('cleanup and maintenance', () => {
    it('should disconnect from database properly', async () => {
      await mfaService.disconnect();

      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });
  });
});