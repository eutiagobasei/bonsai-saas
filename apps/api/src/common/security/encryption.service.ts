import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Encryption service for sensitive data at rest.
 *
 * Uses AES-256-GCM for authenticated encryption:
 * - AES-256: Strong symmetric encryption
 * - GCM: Provides both confidentiality and integrity
 * - Random IV per encryption for semantic security
 *
 * Use cases:
 * - API keys stored in database
 * - PII data (personal identifiable information)
 * - Tenant-specific secrets
 *
 * Setup:
 * 1. Generate a 32-byte (256-bit) key: openssl rand -hex 32
 * 2. Set ENCRYPTION_KEY environment variable (or store in vault)
 *
 * IMPORTANT: Key rotation requires re-encrypting all data!
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 16; // 128 bits
  private readonly authTagLength = 16; // 128 bits
  private encryptionKey: Buffer | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const keyHex = this.configService.get<string>('ENCRYPTION_KEY');

    if (!keyHex) {
      this.logger.warn(
        'ENCRYPTION_KEY not set. Encryption features will be disabled. ' +
          'Generate a key with: openssl rand -hex 32',
      );
      return;
    }

    if (keyHex.length !== 64) {
      throw new Error(
        `ENCRYPTION_KEY must be 64 hex characters (32 bytes). Got ${keyHex.length} characters.`,
      );
    }

    this.encryptionKey = Buffer.from(keyHex, 'hex');
    this.logger.log('Encryption service initialized');
  }

  /**
   * Check if encryption is available.
   */
  isEnabled(): boolean {
    return this.encryptionKey !== null;
  }

  /**
   * Encrypt plaintext data.
   *
   * @param plaintext - The data to encrypt
   * @returns Base64-encoded ciphertext in format: iv:authTag:ciphertext
   * @throws If encryption is not configured
   */
  encrypt(plaintext: string): string {
    if (!this.encryptionKey) {
      throw new Error(
        'Encryption not configured. Set ENCRYPTION_KEY environment variable.',
      );
    }

    // Generate random IV for each encryption
    const iv = crypto.randomBytes(this.ivLength);

    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

    // Encrypt
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine: iv + authTag + ciphertext
    const combined = Buffer.concat([iv, authTag, encrypted]);

    return combined.toString('base64');
  }

  /**
   * Decrypt ciphertext data.
   *
   * @param ciphertext - Base64-encoded encrypted data
   * @returns Decrypted plaintext
   * @throws If decryption fails (wrong key, tampered data, etc.)
   */
  decrypt(ciphertext: string): string {
    if (!this.encryptionKey) {
      throw new Error(
        'Encryption not configured. Set ENCRYPTION_KEY environment variable.',
      );
    }

    try {
      const combined = Buffer.from(ciphertext, 'base64');

      // Extract components
      const iv = combined.subarray(0, this.ivLength);
      const authTag = combined.subarray(
        this.ivLength,
        this.ivLength + this.authTagLength,
      );
      const encrypted = combined.subarray(this.ivLength + this.authTagLength);

      // Create decipher
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
      );
      decipher.setAuthTag(authTag);

      // Decrypt
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      throw new Error(
        `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Hash data using HMAC-SHA-256 with a pepper.
   * Useful for creating searchable encrypted fields.
   *
   * Uses HMAC instead of plain SHA-256 to protect against rainbow table attacks.
   * The pepper is derived from the encryption key or a separate HASH_PEPPER env var.
   *
   * @param data - Data to hash
   * @returns Hex-encoded hash
   */
  hash(data: string): string {
    const pepper =
      this.configService.get<string>('HASH_PEPPER') ||
      (this.encryptionKey ? this.encryptionKey.toString('hex').slice(0, 32) : '');

    if (!pepper) {
      throw new Error(
        'Hash pepper not configured. Set HASH_PEPPER or ENCRYPTION_KEY environment variable.',
      );
    }

    return crypto.createHmac('sha256', pepper).update(data).digest('hex');
  }

  /**
   * Generate a secure random token.
   *
   * @param length - Token length in bytes (default: 32)
   * @returns Hex-encoded random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}
