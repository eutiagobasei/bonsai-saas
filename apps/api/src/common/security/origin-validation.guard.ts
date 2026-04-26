import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Origin Validation Guard for CSRF Protection
 *
 * Validates that requests come from allowed origins.
 * Works together with SameSite cookies for defense in depth.
 *
 * Checks:
 * 1. Origin header matches allowed list
 * 2. Referer header as fallback
 * 3. X-Requested-With header for XHR (optional)
 */
@Injectable()
export class OriginValidationGuard implements CanActivate {
  private readonly logger = new Logger(OriginValidationGuard.name);
  private readonly allowedOrigins: string[];
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isProduction = this.configService.get('NODE_ENV') === 'production';

    const corsOrigins = this.configService.get<string>('CORS_ORIGINS', '');
    this.allowedOrigins = corsOrigins
      ? corsOrigins.split(',').map((o) => o.trim())
      : ['http://localhost:3001'];
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Skip for non-mutating methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    const origin = request.headers.origin;
    const referer = request.headers.referer;

    // Check Origin header first
    if (origin) {
      if (this.isAllowedOrigin(origin)) {
        return true;
      }
      this.logger.warn(`Blocked request from invalid origin: ${origin}`);
      throw new ForbiddenException('Invalid origin');
    }

    // Fallback to Referer header
    if (referer) {
      try {
        const refererOrigin = new URL(referer).origin;
        if (this.isAllowedOrigin(refererOrigin)) {
          return true;
        }
      } catch {
        // Invalid URL, reject
      }
      this.logger.warn(`Blocked request from invalid referer: ${referer}`);
      throw new ForbiddenException('Invalid referer');
    }

    // In production, require origin for state-changing requests
    if (this.isProduction) {
      this.logger.warn('Blocked request without origin/referer header');
      throw new ForbiddenException('Origin header required');
    }

    // In development, allow requests without origin (e.g., Postman)
    return true;
  }

  private isAllowedOrigin(origin: string): boolean {
    return this.allowedOrigins.some((allowed) => {
      // Exact match
      if (allowed === origin) return true;

      // Wildcard subdomain match (e.g., *.example.com)
      if (allowed.startsWith('*.')) {
        const domain = allowed.slice(2);
        const originHost = new URL(origin).hostname;
        return (
          originHost === domain ||
          originHost.endsWith('.' + domain)
        );
      }

      return false;
    });
  }
}
