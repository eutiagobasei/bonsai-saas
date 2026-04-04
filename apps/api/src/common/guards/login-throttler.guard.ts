import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Request } from 'express';

interface LoginAttempt {
  count: number;
  firstAttempt: number;
  lockedUntil?: number;
}

/**
 * Login-specific throttler guard with progressive delays.
 *
 * Strategy:
 * - 5 failed attempts: 1 minute lockout
 * - 10 failed attempts: 5 minute lockout
 * - 15+ failed attempts: 15 minute lockout
 *
 * Tracks attempts by IP + email combination.
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  private readonly attempts = new Map<string, LoginAttempt>();

  // Configurable thresholds
  private readonly THRESHOLD_1 = 5;
  private readonly THRESHOLD_2 = 10;
  private readonly THRESHOLD_3 = 15;

  private readonly LOCKOUT_1 = 60 * 1000; // 1 minute
  private readonly LOCKOUT_2 = 5 * 60 * 1000; // 5 minutes
  private readonly LOCKOUT_3 = 15 * 60 * 1000; // 15 minutes

  private readonly WINDOW = 15 * 60 * 1000; // 15 minute window for counting attempts

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Only apply to login endpoint
    if (!this.isLoginEndpoint(request)) {
      return super.canActivate(context);
    }

    const key = this.generateKeyInternal(request);
    const attempt = this.attempts.get(key);
    const now = Date.now();

    // Check if currently locked out
    if (attempt?.lockedUntil && attempt.lockedUntil > now) {
      const remainingSeconds = Math.ceil((attempt.lockedUntil - now) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many login attempts. Please try again in ${remainingSeconds} seconds.`,
          retryAfter: remainingSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Clean up old attempts
    if (attempt && now - attempt.firstAttempt > this.WINDOW) {
      this.attempts.delete(key);
    }

    return super.canActivate(context);
  }

  /**
   * Record a failed login attempt.
   * Call this from the auth service when login fails.
   */
  recordFailedAttempt(ip: string, email: string): void {
    const key = this.createKey(ip, email);
    const now = Date.now();
    const attempt = this.attempts.get(key);

    if (!attempt || now - attempt.firstAttempt > this.WINDOW) {
      this.attempts.set(key, {
        count: 1,
        firstAttempt: now,
      });
      return;
    }

    attempt.count++;

    // Apply progressive lockouts
    if (attempt.count >= this.THRESHOLD_3) {
      attempt.lockedUntil = now + this.LOCKOUT_3;
    } else if (attempt.count >= this.THRESHOLD_2) {
      attempt.lockedUntil = now + this.LOCKOUT_2;
    } else if (attempt.count >= this.THRESHOLD_1) {
      attempt.lockedUntil = now + this.LOCKOUT_1;
    }

    this.attempts.set(key, attempt);
  }

  /**
   * Clear attempts after successful login.
   */
  clearAttempts(ip: string, email: string): void {
    const key = this.createKey(ip, email);
    this.attempts.delete(key);
  }

  /**
   * Get current attempt count for monitoring.
   */
  getAttemptCount(ip: string, email: string): number {
    const key = this.createKey(ip, email);
    return this.attempts.get(key)?.count ?? 0;
  }

  private isLoginEndpoint(request: Request): boolean {
    return (
      request.method === 'POST' &&
      (request.path === '/api/auth/login' || request.path === '/auth/login')
    );
  }

  private generateKeyInternal(request: Request): string {
    const ip = this.getClientIp(request);
    const email = request.body?.email?.toLowerCase() ?? 'unknown';
    return this.createKey(ip, email);
  }

  private createKey(ip: string, email: string): string {
    return `login:${ip}:${email.toLowerCase()}`;
  }

  private getClientIp(request: Request): string {
    // Handle various proxy scenarios
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded)
        ? forwarded[0]
        : forwarded.split(',')[0];
      return ips.trim();
    }

    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    return request.ip ?? request.socket.remoteAddress ?? 'unknown';
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
  ): Promise<void> {
    throw new ThrottlerException('Too many requests. Please slow down.');
  }
}
