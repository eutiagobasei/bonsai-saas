import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import * as UAParser from 'ua-parser-js';
import { PrismaService } from '../database/prisma.service';

export interface DeviceInfo {
  deviceName: string;
  deviceType: string;
  browser: string;
  os: string;
  ipAddress: string;
  userAgent: string;
}

export interface SessionInfo {
  id: string;
  deviceName: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  lastActiveAt: Date;
  createdAt: Date;
  isCurrent: boolean;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Extract device information from request
   */
  extractDeviceInfo(req: Request): DeviceInfo {
    const userAgent = req.headers['user-agent'] || '';
    const parser = new UAParser.UAParser(userAgent);
    const result = parser.getResult();

    const browser = result.browser.name
      ? `${result.browser.name} ${result.browser.version || ''}`
      : 'Unknown Browser';

    const os = result.os.name
      ? `${result.os.name} ${result.os.version || ''}`
      : 'Unknown OS';

    const deviceType = result.device.type || 'desktop';
    const deviceName = `${browser} on ${os}`;

    // Get IP address (handle proxies)
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';

    return {
      deviceName,
      deviceType,
      browser,
      os,
      ipAddress,
      userAgent,
    };
  }

  /**
   * Create a new session for a user
   */
  async createSession(
    userId: string,
    tenantId: string | null,
    deviceInfo: DeviceInfo,
    expiresIn: number = 7 * 24 * 60 * 60 * 1000, // 7 days
  ) {
    const expiresAt = new Date(Date.now() + expiresIn);

    return this.prisma.session.create({
      data: {
        userId,
        tenantId,
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        expiresAt,
      },
    });
  }

  /**
   * Update session activity
   */
  async touchSession(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { lastActiveAt: new Date() },
    });
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<SessionInfo[]> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      deviceName: s.deviceName,
      deviceType: s.deviceType,
      browser: s.browser,
      os: s.os,
      ipAddress: s.ipAddress,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
      isCurrent: s.id === currentSessionId,
    }));
  }

  /**
   * Revoke a specific session (logout from device)
   */
  async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    const result = await this.prisma.session.updateMany({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    if (result.count > 0) {
      // Also revoke all refresh tokens for this session
      await this.prisma.refreshToken.updateMany({
        where: {
          sessionId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokedReason: 'session_revoked',
        },
      });
    }

    return result.count > 0;
  }

  /**
   * Revoke all sessions except current (logout from all devices)
   */
  async revokeAllOtherSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        id: { not: currentSessionId },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    // Also revoke refresh tokens
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        sessionId: { not: currentSessionId },
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: 'all_sessions_revoked',
      },
    });

    return result.count;
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired sessions`);
    return result.count;
  }
}
