import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

import { PrismaService } from '../../../common/database/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { TokenPayload } from '../auth.service';
import { COOKIE_NAMES } from '../../../common/security';

/**
 * Extracts JWT token with the following priority:
 * 1. HttpOnly cookie (secure, preferred for browser clients)
 * 2. Authorization header (for API clients, CLI tools)
 */
function extractJwtFromCookieOrHeader(req: Request): string | null {
  // First, try to extract from HttpOnly cookie (most secure for browsers)
  const cookieToken = req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN];
  if (cookieToken) {
    return cookieToken;
  }

  // Fallback to Authorization header for API clients
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  // Short cache TTL for security - revoked users will be blocked within 30 seconds
  // Trade-off: More database lookups vs faster revocation
  private readonly cacheTtl = 30 * 1000; // 30 seconds

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {
    super({
      jwtFromRequest: extractJwtFromCookieOrHeader,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: TokenPayload): Promise<TokenPayload> {
    const cacheKey = `jwt_valid:${payload.sub}:${payload.tenantId ?? 'global'}`;

    // Check cache first
    const cachedResult = await this.cache.get<{
      valid: boolean;
      role?: string;
    }>(cacheKey);

    if (cachedResult) {
      if (!cachedResult.valid) {
        throw new UnauthorizedException('Invalid token (cached)');
      }
      // Update role from cache if different
      if (cachedResult.role && cachedResult.role !== payload.role) {
        payload.role = cachedResult.role;
      }
      return payload;
    }

    // Cache miss - perform full validation
    try {
      const result = await this.validateWithDatabase(payload);

      // Cache successful validation
      await this.cache.set(
        cacheKey,
        { valid: true, role: result.role },
        this.cacheTtl,
      );

      return result;
    } catch (error) {
      // Cache failed validation (shorter TTL to allow recovery)
      await this.cache.set(cacheKey, { valid: false }, 60 * 1000);
      throw error;
    }
  }

  private async validateWithDatabase(
    payload: TokenPayload,
  ): Promise<TokenPayload> {
    // Verify user still exists
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    // If tenant is specified, verify membership still exists
    if (payload.tenantId) {
      const membership = await this.prisma.tenantMember.findUnique({
        where: {
          userId_tenantId: {
            userId: payload.sub,
            tenantId: payload.tenantId,
          },
        },
      });

      if (!membership) {
        throw new UnauthorizedException('No longer a member of this tenant');
      }

      // Update role in payload if it has changed
      if (membership.role !== payload.role) {
        payload.role = membership.role;
      }
    }

    return payload;
  }
}
