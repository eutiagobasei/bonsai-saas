import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Argon2id Password Hashing Service
 *
 * Argon2id is the recommended algorithm for password hashing:
 * - Winner of the Password Hashing Competition (2015)
 * - Resistant to side-channel attacks (Argon2i)
 * - Resistant to GPU cracking (Argon2d)
 * - Argon2id combines both for maximum security
 *
 * Configuration follows OWASP recommendations:
 * - Memory: 64MB (65536 KiB)
 * - Iterations: 3
 * - Parallelism: 4
 */
@Injectable()
export class Argon2Service {
  private readonly hashOptions: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 65536, // 64MB
    timeCost: 3, // 3 iterations
    parallelism: 4,
  };

  /**
   * Hash a password using Argon2id
   */
  async hash(password: string): Promise<string> {
    return argon2.hash(password, this.hashOptions);
  }

  /**
   * Verify a password against a hash
   */
  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /**
   * Check if a hash needs to be rehashed (e.g., after config changes)
   */
  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, this.hashOptions);
  }

  /**
   * Migrate from bcrypt hash to argon2id
   * Returns null if bcrypt verification fails
   */
  async migrateFromBcrypt(
    bcryptHash: string,
    password: string,
  ): Promise<string | null> {
    // Dynamically import bcrypt for migration
    const bcrypt = await import('bcrypt');
    const isValid = await bcrypt.compare(password, bcryptHash);

    if (!isValid) {
      return null;
    }

    // Rehash with Argon2id
    return this.hash(password);
  }

  /**
   * Detect hash algorithm (for migration)
   */
  detectHashType(hash: string): 'argon2' | 'bcrypt' | 'unknown' {
    if (hash.startsWith('$argon2')) {
      return 'argon2';
    }
    if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
      return 'bcrypt';
    }
    return 'unknown';
  }
}
