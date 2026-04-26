import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { EncryptionService } from './encryption.service';

export interface ApiKeyInfo {
  id: string;
  name: string;
  keyPrefix: string;
  tenantId: string;
  userId: string;
  scopes: string[];
  rateLimit: number;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  usageCount: number;
  createdAt: Date;
}

export interface ApiKeyValidation {
  valid: boolean;
  key?: ApiKeyInfo;
  error?: string;
}

/**
 * API Keys Service
 *
 * Features:
 * - Secure key generation (32 bytes random)
 * - Key hashing (SHA-256) for storage
 * - Scope-based authorization
 * - Per-key rate limiting
 * - Expiration support
 * - Usage tracking
 */
@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);
  private readonly keyPrefix = 'mysk_'; // my-saas key

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Generate a new API key
   */
  async create(
    tenantId: string,
    userId: string,
    name: string,
    options: {
      scopes?: string[];
      rateLimit?: number;
      expiresAt?: Date;
    } = {},
  ): Promise<{ key: string; info: ApiKeyInfo }> {
    // Generate secure random key
    const randomBytes = crypto.randomBytes(32);
    const keyValue = this.keyPrefix + randomBytes.toString('base64url');

    // Hash for storage
    const keyHash = this.hashKey(keyValue);

    // Store first 8 chars for identification
    const keyPrefixValue = keyValue.slice(0, 12); // mysk_ + 7 chars

    const apiKey = await this.prisma.apiKey.create({
      data: {
        name,
        keyHash,
        keyPrefix: keyPrefixValue,
        tenantId,
        userId,
        scopes: options.scopes || [],
        rateLimit: options.rateLimit || 1000,
        expiresAt: options.expiresAt,
      },
    });

    return {
      key: keyValue, // Only returned once!
      info: this.toApiKeyInfo(apiKey),
    };
  }

  /**
   * Validate an API key
   */
  async validate(keyValue: string): Promise<ApiKeyValidation> {
    if (!keyValue.startsWith(this.keyPrefix)) {
      return { valid: false, error: 'Invalid key format' };
    }

    const keyHash = this.hashKey(keyValue);

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
    });

    if (!apiKey) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (apiKey.revokedAt) {
      return { valid: false, error: 'API key has been revoked' };
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { valid: false, error: 'API key has expired' };
    }

    // Update usage
    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
      },
    });

    return {
      valid: true,
      key: this.toApiKeyInfo(apiKey),
    };
  }

  /**
   * Check if key has required scope
   */
  hasScope(key: ApiKeyInfo, requiredScope: string): boolean {
    // Wildcard scopes
    if (key.scopes.includes('*')) return true;

    // Exact match
    if (key.scopes.includes(requiredScope)) return true;

    // Prefix match (e.g., "supplies:*" matches "supplies:read")
    const [resource] = requiredScope.split(':');
    if (key.scopes.includes(`${resource}:*`)) return true;

    return false;
  }

  /**
   * List API keys for a tenant
   */
  async list(tenantId: string): Promise<ApiKeyInfo[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: { tenantId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map(this.toApiKeyInfo);
  }

  /**
   * Revoke an API key
   */
  async revoke(keyId: string, tenantId: string): Promise<boolean> {
    const result = await this.prisma.apiKey.updateMany({
      where: {
        id: keyId,
        tenantId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return result.count > 0;
  }

  /**
   * Hash API key for storage
   */
  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Convert Prisma model to ApiKeyInfo
   */
  private toApiKeyInfo(apiKey: {
    id: string;
    name: string;
    keyPrefix: string;
    tenantId: string;
    userId: string;
    scopes: string[];
    rateLimit: number;
    expiresAt: Date | null;
    lastUsedAt: Date | null;
    usageCount: number;
    createdAt: Date;
  }): ApiKeyInfo {
    return {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      tenantId: apiKey.tenantId,
      userId: apiKey.userId,
      scopes: apiKey.scopes,
      rateLimit: apiKey.rateLimit,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      usageCount: apiKey.usageCount,
      createdAt: apiKey.createdAt,
    };
  }

  /**
   * Cleanup expired keys
   */
  async cleanup(): Promise<number> {
    const result = await this.prisma.apiKey.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { not: null } },
        ],
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired/revoked API keys`);
    return result.count;
  }
}

/**
 * API Key Auth Guard
 */
import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Check for API key in header
    const apiKey =
      (request.headers['x-api-key'] as string) ||
      (request.headers['authorization']?.replace('Bearer ', '') || '');

    if (!apiKey || !apiKey.startsWith('mysk_')) {
      return true; // Let JWT auth handle it
    }

    const validation = await this.apiKeysService.validate(apiKey);

    if (!validation.valid) {
      throw new UnauthorizedException(validation.error);
    }

    // Attach key info to request
    (request as Request & { apiKey: ApiKeyInfo }).apiKey = validation.key!;

    return true;
  }
}

/**
 * Scope decorator for API key authorization
 */
export function RequireScope(scope: string) {
  return (target: object, key: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: { apiKeysService: ApiKeysService }, ...args: unknown[]) {
      const request = args.find(
        (arg) => arg && typeof arg === 'object' && 'apiKey' in arg,
      ) as Request & { apiKey?: ApiKeyInfo } | undefined;

      if (request?.apiKey) {
        if (!this.apiKeysService.hasScope(request.apiKey, scope)) {
          throw new ForbiddenException(`Missing required scope: ${scope}`);
        }
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
