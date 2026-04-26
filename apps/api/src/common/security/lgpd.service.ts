import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from './audit.service';
import { Request } from 'express';

export interface ConsentType {
  type: string;
  version: string;
  required: boolean;
  description: string;
}

// Consent types for LGPD compliance
export const CONSENT_TYPES: ConsentType[] = [
  {
    type: 'terms',
    version: '1.0',
    required: true,
    description: 'Terms of Service',
  },
  {
    type: 'privacy',
    version: '1.0',
    required: true,
    description: 'Privacy Policy',
  },
  {
    type: 'marketing',
    version: '1.0',
    required: false,
    description: 'Marketing Communications',
  },
  {
    type: 'analytics',
    version: '1.0',
    required: false,
    description: 'Analytics and Usage Data',
  },
];

/**
 * LGPD Compliance Service
 *
 * Implements Brazilian General Data Protection Law requirements:
 * - Consent management
 * - Data deletion requests
 * - Data retention policies
 * - Data portability (export)
 */
@Injectable()
export class LgpdService {
  private readonly logger = new Logger(LgpdService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ==========================================
  // CONSENT MANAGEMENT
  // ==========================================

  /**
   * Record user consent
   */
  async grantConsent(
    userId: string,
    consentType: string,
    version: string,
    req?: Request,
  ): Promise<void> {
    const ipAddress = req
      ? (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress
      : null;

    const userAgent = req?.headers['user-agent'] || null;

    await this.prisma.consentRecord.create({
      data: {
        userId,
        consentType,
        version,
        granted: true,
        ipAddress,
        userAgent,
      },
    });

    await this.auditService.log({
      userId,
      action: 'CONSENT_GRANTED',
      entity: 'consent',
      newData: { consentType, version },
      req,
    });
  }

  /**
   * Revoke user consent
   */
  async revokeConsent(
    userId: string,
    consentType: string,
    req?: Request,
  ): Promise<void> {
    // Find latest consent of this type
    const consent = await this.prisma.consentRecord.findFirst({
      where: {
        userId,
        consentType,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (consent) {
      await this.prisma.consentRecord.update({
        where: { id: consent.id },
        data: { revokedAt: new Date() },
      });

      await this.auditService.log({
        userId,
        action: 'CONSENT_REVOKED',
        entity: 'consent',
        newData: { consentType },
        req,
      });
    }
  }

  /**
   * Get user's current consents
   */
  async getConsents(userId: string): Promise<
    Array<{
      type: string;
      version: string;
      granted: boolean;
      grantedAt: Date;
    }>
  > {
    const consents = await this.prisma.consentRecord.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Return latest consent per type
    const consentMap = new Map<
      string,
      { type: string; version: string; granted: boolean; grantedAt: Date }
    >();

    for (const consent of consents) {
      if (!consentMap.has(consent.consentType)) {
        consentMap.set(consent.consentType, {
          type: consent.consentType,
          version: consent.version,
          granted: consent.granted,
          grantedAt: consent.createdAt,
        });
      }
    }

    return Array.from(consentMap.values());
  }

  /**
   * Check if user has required consents
   */
  async hasRequiredConsents(userId: string): Promise<boolean> {
    const userConsents = await this.getConsents(userId);
    const requiredTypes = CONSENT_TYPES.filter((c) => c.required).map((c) => c.type);

    for (const required of requiredTypes) {
      const consent = userConsents.find((c) => c.type === required && c.granted);
      if (!consent) {
        return false;
      }
    }

    return true;
  }

  // ==========================================
  // DATA DELETION (Right to Erasure)
  // ==========================================

  /**
   * Request data deletion
   */
  async requestDeletion(
    userId: string,
    tenantId: string | null,
    dataTypes: string[] = ['all'],
    req?: Request,
  ): Promise<{ requestId: string; scheduledAt: Date }> {
    // Schedule deletion for 7 days from now (grace period)
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + 7);

    const request = await this.prisma.dataDeletionRequest.create({
      data: {
        userId,
        tenantId,
        scheduledAt,
        dataTypes,
        status: 'PENDING',
      },
    });

    await this.auditService.log({
      userId,
      tenantId: tenantId ?? undefined,
      action: 'DATA_DELETION_REQUEST',
      entity: 'data_deletion',
      entityId: request.id,
      newData: { dataTypes, scheduledAt },
      req,
    });

    return {
      requestId: request.id,
      scheduledAt,
    };
  }

  /**
   * Cancel deletion request
   */
  async cancelDeletion(requestId: string, userId: string): Promise<boolean> {
    const result = await this.prisma.dataDeletionRequest.updateMany({
      where: {
        id: requestId,
        userId,
        status: 'PENDING',
      },
      data: { status: 'FAILED' }, // Reusing status for cancelled
    });

    return result.count > 0;
  }

  /**
   * Process pending deletion requests
   * Run this daily via cron
   */
  async processDeletionRequests(): Promise<number> {
    const requests = await this.prisma.dataDeletionRequest.findMany({
      where: {
        status: 'PENDING',
        scheduledAt: { lte: new Date() },
      },
    });

    let processed = 0;

    for (const request of requests) {
      try {
        await this.prisma.dataDeletionRequest.update({
          where: { id: request.id },
          data: { status: 'IN_PROGRESS' },
        });

        await this.executeDataDeletion(request.userId, request.dataTypes);

        await this.prisma.dataDeletionRequest.update({
          where: { id: request.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });

        processed++;
      } catch (error) {
        this.logger.error(`Failed to process deletion request ${request.id}`, error);

        await this.prisma.dataDeletionRequest.update({
          where: { id: request.id },
          data: { status: 'FAILED' },
        });
      }
    }

    return processed;
  }

  /**
   * Execute data deletion for a user
   */
  private async executeDataDeletion(
    userId: string,
    dataTypes: string[],
  ): Promise<void> {
    const deleteAll = dataTypes.includes('all');

    // Delete in order (respecting foreign keys)
    if (deleteAll || dataTypes.includes('sessions')) {
      await this.prisma.session.deleteMany({ where: { userId } });
    }

    if (deleteAll || dataTypes.includes('tokens')) {
      await this.prisma.refreshToken.deleteMany({ where: { userId } });
    }

    if (deleteAll || dataTypes.includes('consents')) {
      await this.prisma.consentRecord.deleteMany({ where: { userId } });
    }

    // Anonymize audit logs instead of deleting (for compliance)
    if (deleteAll || dataTypes.includes('audit')) {
      await this.prisma.auditLog.updateMany({
        where: { userId },
        data: { userId: null },
      });
    }

    // Finally delete user if all data requested
    if (deleteAll || dataTypes.includes('profile')) {
      await this.prisma.user.delete({ where: { id: userId } });
    }

    this.logger.log(`Completed data deletion for user ${userId}`);
  }

  // ==========================================
  // DATA RETENTION
  // ==========================================

  /**
   * Set retention policy for an entity type
   */
  async setRetentionPolicy(
    tenantId: string | null,
    entityType: string,
    retentionDays: number,
  ): Promise<void> {
    await this.prisma.dataRetentionPolicy.upsert({
      where: {
        tenantId_entityType: {
          tenantId: tenantId ?? 'global',
          entityType,
        },
      },
      create: {
        tenantId,
        entityType,
        retentionDays,
      },
      update: {
        retentionDays,
      },
    });
  }

  /**
   * Apply retention policies
   * Run this daily via cron
   */
  async applyRetentionPolicies(): Promise<Record<string, number>> {
    const policies = await this.prisma.dataRetentionPolicy.findMany();
    const results: Record<string, number> = {};

    for (const policy of policies) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

      let deleted = 0;

      switch (policy.entityType) {
        case 'audit_logs':
          const auditResult = await this.prisma.auditLog.deleteMany({
            where: {
              tenantId: policy.tenantId,
              createdAt: { lt: cutoffDate },
            },
          });
          deleted = auditResult.count;
          break;

        case 'sessions':
          const sessionResult = await this.prisma.session.deleteMany({
            where: {
              createdAt: { lt: cutoffDate },
            },
          });
          deleted = sessionResult.count;
          break;

        // Add more entity types as needed
      }

      results[policy.entityType] = deleted;
      this.logger.log(
        `Retention policy: deleted ${deleted} ${policy.entityType} older than ${policy.retentionDays} days`,
      );
    }

    return results;
  }

  // ==========================================
  // DATA PORTABILITY (Export)
  // ==========================================

  /**
   * Export all user data (LGPD portability)
   */
  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        tenantMemberships: {
          select: {
            role: true,
            joinedAt: true,
            tenant: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    const consents = await this.getConsents(userId);

    const sessions = await this.prisma.session.findMany({
      where: { userId },
      select: {
        deviceName: true,
        ipAddress: true,
        createdAt: true,
        lastActiveAt: true,
      },
    });

    const auditLogs = await this.prisma.auditLog.findMany({
      where: { userId },
      select: {
        action: true,
        entity: true,
        createdAt: true,
        ipAddress: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      exportDate: new Date().toISOString(),
      user,
      consents,
      sessions,
      recentActivity: auditLogs,
    };
  }
}
