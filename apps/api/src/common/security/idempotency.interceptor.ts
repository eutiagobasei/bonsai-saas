import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { PrismaService } from '../database/prisma.service';

const IDEMPOTENCY_HEADER = 'Idempotency-Key';
const IDEMPOTENCY_TTL_HOURS = 24;

/**
 * Idempotency Interceptor
 *
 * Ensures safe retries for POST/PUT/PATCH requests.
 * If a request with the same idempotency key is received,
 * returns the cached response instead of executing again.
 *
 * Usage:
 * Add `Idempotency-Key: <uuid>` header to requests.
 *
 * Benefits:
 * - Safe retries on network failures
 * - Prevents duplicate charges, orders, etc.
 * - Required for payment processing
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Only apply to mutating methods
    if (['GET', 'HEAD', 'OPTIONS', 'DELETE'].includes(request.method)) {
      return next.handle();
    }

    const idempotencyKey = request.headers[IDEMPOTENCY_HEADER.toLowerCase()] as string;

    // If no idempotency key, proceed normally
    if (!idempotencyKey) {
      return next.handle();
    }

    // Check for existing key
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });

    if (existing) {
      // Check if same endpoint
      if (
        existing.endpoint !== request.path ||
        existing.method !== request.method
      ) {
        throw new ConflictException(
          'Idempotency key already used for different endpoint',
        );
      }

      // If response exists, return cached response
      if (existing.response !== null && existing.statusCode !== null) {
        this.logger.debug(`Returning cached response for key: ${idempotencyKey}`);
        response.status(existing.statusCode);
        response.setHeader('Idempotency-Replayed', 'true');
        return of(existing.response);
      }

      // Request still in progress
      throw new ConflictException('Request with this idempotency key is in progress');
    }

    // Create new idempotency record
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + IDEMPOTENCY_TTL_HOURS);

    const userId = (request as Request & { user?: { sub: string } }).user?.sub;
    const tenantId = (request as Request & { user?: { tenantId: string } }).user?.tenantId;

    await this.prisma.idempotencyKey.create({
      data: {
        key: idempotencyKey,
        endpoint: request.path,
        method: request.method,
        userId,
        tenantId,
        expiresAt,
      },
    });

    // Execute request and cache response
    return next.handle().pipe(
      tap(async (data) => {
        try {
          await this.prisma.idempotencyKey.update({
            where: { key: idempotencyKey },
            data: {
              statusCode: response.statusCode,
              response: data as object,
            },
          });
        } catch (error) {
          this.logger.error('Failed to cache idempotency response', error);
        }
      }),
    );
  }
}

/**
 * Cleanup expired idempotency keys
 * Run this periodically (e.g., every hour via cron)
 */
export async function cleanupIdempotencyKeys(prisma: PrismaService): Promise<number> {
  const result = await prisma.idempotencyKey.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}
