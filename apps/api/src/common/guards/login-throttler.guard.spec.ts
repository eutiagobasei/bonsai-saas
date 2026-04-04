import { LoginThrottlerGuard } from './login-throttler.guard';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorage } from '@nestjs/throttler';

describe('LoginThrottlerGuard', () => {
  let guard: LoginThrottlerGuard;

  beforeEach(() => {
    const mockOptions = [{ ttl: 1000, limit: 10 }];
    const mockStorage = {} as ThrottlerStorage;
    const mockReflector = {} as Reflector;
    guard = new LoginThrottlerGuard(mockOptions, mockStorage, mockReflector);
  });

  describe('recordFailedAttempt', () => {
    it('should record first failed attempt', () => {
      guard.recordFailedAttempt('192.168.1.1', 'test@example.com');

      expect(guard.getAttemptCount('192.168.1.1', 'test@example.com')).toBe(1);
    });

    it('should increment attempt count', () => {
      guard.recordFailedAttempt('192.168.1.1', 'test@example.com');
      guard.recordFailedAttempt('192.168.1.1', 'test@example.com');
      guard.recordFailedAttempt('192.168.1.1', 'test@example.com');

      expect(guard.getAttemptCount('192.168.1.1', 'test@example.com')).toBe(3);
    });

    it('should track attempts separately by IP', () => {
      guard.recordFailedAttempt('192.168.1.1', 'test@example.com');
      guard.recordFailedAttempt('192.168.1.2', 'test@example.com');

      expect(guard.getAttemptCount('192.168.1.1', 'test@example.com')).toBe(1);
      expect(guard.getAttemptCount('192.168.1.2', 'test@example.com')).toBe(1);
    });

    it('should track attempts separately by email', () => {
      guard.recordFailedAttempt('192.168.1.1', 'user1@example.com');
      guard.recordFailedAttempt('192.168.1.1', 'user2@example.com');

      expect(guard.getAttemptCount('192.168.1.1', 'user1@example.com')).toBe(1);
      expect(guard.getAttemptCount('192.168.1.1', 'user2@example.com')).toBe(1);
    });

    it('should normalize email to lowercase', () => {
      guard.recordFailedAttempt('192.168.1.1', 'TEST@EXAMPLE.COM');
      guard.recordFailedAttempt('192.168.1.1', 'test@example.com');

      expect(guard.getAttemptCount('192.168.1.1', 'test@example.com')).toBe(2);
    });
  });

  describe('clearAttempts', () => {
    it('should clear attempts after successful login', () => {
      guard.recordFailedAttempt('192.168.1.1', 'test@example.com');
      guard.recordFailedAttempt('192.168.1.1', 'test@example.com');
      guard.recordFailedAttempt('192.168.1.1', 'test@example.com');

      guard.clearAttempts('192.168.1.1', 'test@example.com');

      expect(guard.getAttemptCount('192.168.1.1', 'test@example.com')).toBe(0);
    });

    it('should not affect other IP/email combinations', () => {
      guard.recordFailedAttempt('192.168.1.1', 'test@example.com');
      guard.recordFailedAttempt('192.168.1.2', 'test@example.com');

      guard.clearAttempts('192.168.1.1', 'test@example.com');

      expect(guard.getAttemptCount('192.168.1.1', 'test@example.com')).toBe(0);
      expect(guard.getAttemptCount('192.168.1.2', 'test@example.com')).toBe(1);
    });
  });

  describe('getAttemptCount', () => {
    it('should return 0 for unknown IP/email', () => {
      expect(guard.getAttemptCount('10.0.0.1', 'unknown@example.com')).toBe(0);
    });
  });

  describe('progressive lockouts', () => {
    it('should not lock on less than 5 attempts', () => {
      for (let i = 0; i < 4; i++) {
        guard.recordFailedAttempt('192.168.1.1', 'test@example.com');
      }

      // No lockout yet - canActivate would pass (testing internal state)
      expect(guard.getAttemptCount('192.168.1.1', 'test@example.com')).toBe(4);
    });

    it('should track 5+ attempts for lockout', () => {
      for (let i = 0; i < 5; i++) {
        guard.recordFailedAttempt('192.168.1.1', 'test@example.com');
      }

      expect(guard.getAttemptCount('192.168.1.1', 'test@example.com')).toBe(5);
    });

    it('should track 10+ attempts for longer lockout', () => {
      for (let i = 0; i < 10; i++) {
        guard.recordFailedAttempt('192.168.1.1', 'test@example.com');
      }

      expect(guard.getAttemptCount('192.168.1.1', 'test@example.com')).toBe(10);
    });

    it('should track 15+ attempts for maximum lockout', () => {
      for (let i = 0; i < 15; i++) {
        guard.recordFailedAttempt('192.168.1.1', 'test@example.com');
      }

      expect(guard.getAttemptCount('192.168.1.1', 'test@example.com')).toBe(15);
    });
  });
});
