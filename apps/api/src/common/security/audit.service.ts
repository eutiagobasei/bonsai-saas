import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../database/prisma.service';

export type AuditAction =
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'REGISTER'
  | 'PASSWORD_CHANGE'
  | 'MFA_ENABLED'
  | 'MFA_DISABLED'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'EXPORT'
  | 'IMPORT'
  | 'BILLING_UPDATE'
  | 'PERMISSION_CHANGE'
  | 'API_KEY_CREATED'
  | 'API_KEY_REVOKED'
  | 'DATA_DELETION_REQUEST'
  | 'CONSENT_GRANTED'
  | 'CONSENT_REVOKED';

export interface AuditLogEntry {
  userId?: string;
  tenantId?: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  req?: Request;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an audit event
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const ipAddress = entry.req
        ? (entry.req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
          entry.req.socket.remoteAddress
        : null;

      const userAgent = entry.req?.headers['user-agent'] || null;

      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          tenantId: entry.tenantId,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          oldData: entry.oldData ?? null,
          newData: entry.newData ?? null,
          ipAddress,
          userAgent,
        },
      });
    } catch (error) {
      // Never throw from audit logging - just log the error
      this.logger.error('Failed to create audit log', error);
    }
  }

  /**
   * Log authentication events
   */
  async logAuth(
    action: 'LOGIN' | 'LOGIN_FAILED' | 'LOGOUT' | 'REGISTER',
    userId: string | null,
    req: Request,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      userId: userId ?? undefined,
      action,
      entity: 'auth',
      newData: metadata,
      req,
    });
  }

  /**
   * Log entity changes (create/update/delete)
   */
  async logChange(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    entity: string,
    entityId: string,
    userId: string,
    tenantId: string,
    oldData?: Record<string, unknown>,
    newData?: Record<string, unknown>,
    req?: Request,
  ): Promise<void> {
    // Sanitize sensitive fields
    const sanitizedOld = oldData ? this.sanitize(oldData) : undefined;
    const sanitizedNew = newData ? this.sanitize(newData) : undefined;

    await this.log({
      userId,
      tenantId,
      action,
      entity,
      entityId,
      oldData: sanitizedOld,
      newData: sanitizedNew,
      req,
    });
  }

  /**
   * Log data export
   */
  async logExport(
    entity: string,
    userId: string,
    tenantId: string,
    recordCount: number,
    format: string,
    req?: Request,
  ): Promise<void> {
    await this.log({
      userId,
      tenantId,
      action: 'EXPORT',
      entity,
      newData: { recordCount, format },
      req,
    });
  }

  /**
   * Log billing events
   */
  async logBilling(
    userId: string,
    tenantId: string,
    action: string,
    details: Record<string, unknown>,
    req?: Request,
  ): Promise<void> {
    await this.log({
      userId,
      tenantId,
      action: 'BILLING_UPDATE',
      entity: 'billing',
      newData: { billingAction: action, ...details },
      req,
    });
  }

  /**
   * Query audit logs
   */
  async query(params: {
    userId?: string;
    tenantId?: string;
    action?: AuditAction;
    entity?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};

    if (params.userId) where.userId = params.userId;
    if (params.tenantId) where.tenantId = params.tenantId;
    if (params.action) where.action = params.action;
    if (params.entity) where.entity = params.entity;
    if (params.entityId) where.entityId = params.entityId;

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) (where.createdAt as Record<string, Date>).gte = params.startDate;
      if (params.endDate) (where.createdAt as Record<string, Date>).lte = params.endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit ?? 50,
        skip: params.offset ?? 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Remove sensitive fields from data
   */
  private sanitize(data: Record<string, unknown>): Record<string, unknown> {
    const sensitiveFields = [
      'password',
      'passwordHash',
      'secret',
      'token',
      'apiKey',
      'mfaSecret',
      'creditCard',
      'ssn',
      'cpf',
    ];

    const result = { ...data };

    for (const field of sensitiveFields) {
      if (field in result) {
        result[field] = '[REDACTED]';
      }
    }

    return result;
  }

  /**
   * Cleanup old audit logs based on retention policy
   */
  async cleanup(retentionDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.log(`Cleaned up ${result.count} audit logs older than ${retentionDays} days`);
    return result.count;
  }
}
