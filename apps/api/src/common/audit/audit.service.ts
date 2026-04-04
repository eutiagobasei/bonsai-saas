import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

import { Prisma } from '@prisma/client';

export interface AuditLogEntry {
  userId?: string;
  tenantId?: string;
  action: string;
  entity: string;
  entityId?: string;
  oldData?: Prisma.InputJsonValue;
  newData?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Service for creating audit log entries.
 * Uses the existing AuditLog model from the Prisma schema.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an audit log entry
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          tenantId: entry.tenantId,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          oldData: entry.oldData,
          newData: entry.newData,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });
    } catch (error) {
      // Log error but don't throw - audit logging should not break the main flow
      this.logger.error('Failed to create audit log entry', error);
    }
  }

  /**
   * Create multiple audit log entries
   */
  async logMany(entries: AuditLogEntry[]): Promise<void> {
    try {
      await this.prisma.auditLog.createMany({
        data: entries.map((entry) => ({
          userId: entry.userId,
          tenantId: entry.tenantId,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          oldData: entry.oldData,
          newData: entry.newData,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        })),
      });
    } catch (error) {
      this.logger.error('Failed to create audit log entries', error);
    }
  }

  /**
   * Get audit logs for a specific entity
   */
  async getByEntity(
    entity: string,
    entityId: string,
    options?: { limit?: number; offset?: number },
  ) {
    return this.prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });
  }

  /**
   * Get audit logs for a specific user
   */
  async getByUser(
    userId: string,
    options?: { limit?: number; offset?: number; tenantId?: string },
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        userId,
        ...(options?.tenantId && { tenantId: options.tenantId }),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });
  }

  /**
   * Get audit logs for a specific tenant
   */
  async getByTenant(
    tenantId: string,
    options?: { limit?: number; offset?: number; action?: string },
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        tenantId,
        ...(options?.action && { action: options.action }),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });
  }
}
