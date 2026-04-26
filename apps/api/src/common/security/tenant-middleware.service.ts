import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/**
 * Prisma Middleware for automatic tenant enforcement
 *
 * Automatically adds tenantId filter to all queries on tenant-scoped models.
 * This prevents BOLA/IDOR attacks by ensuring users can only access
 * data within their tenant.
 *
 * Usage:
 * 1. Set the tenant context before making queries:
 *    prismaService.setTenantContext(tenantId)
 *
 * 2. Clear context after request (handled by TenantInterceptor):
 *    prismaService.clearTenantContext()
 */
@Injectable()
export class TenantMiddlewareService implements OnModuleInit {
  // Models that are scoped to a tenant
  private readonly tenantScopedModels = [
    'SupplyCategory',
    'Supply',
    'ApiKey',
    'WebhookEndpoint',
    'WebhookDelivery',
    'ConsentRecord',
    'DataDeletionRequest',
  ];

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.setupMiddleware();
  }

  private setupMiddleware() {
    // Extend PrismaClient with tenant context
    this.prisma.$use(async (params, next) => {
      const tenantId = (this.prisma as unknown as { _tenantId?: string })._tenantId;

      // Skip if no tenant context or model not tenant-scoped
      if (!tenantId || !this.tenantScopedModels.includes(params.model ?? '')) {
        return next(params);
      }

      // Add tenantId to create operations
      if (params.action === 'create') {
        params.args.data = {
          ...params.args.data,
          tenantId,
        };
      }

      // Add tenantId filter to read operations
      if (['findFirst', 'findMany', 'count', 'aggregate'].includes(params.action)) {
        params.args = params.args || {};
        params.args.where = {
          ...params.args.where,
          tenantId,
        };
      }

      // Add tenantId filter to findUnique (convert to findFirst)
      if (params.action === 'findUnique') {
        params.action = 'findFirst';
        params.args.where = {
          ...params.args.where,
          tenantId,
        };
      }

      // Add tenantId filter to update operations
      if (['update', 'updateMany', 'delete', 'deleteMany'].includes(params.action)) {
        params.args = params.args || {};
        params.args.where = {
          ...params.args.where,
          tenantId,
        };
      }

      return next(params);
    });
  }
}

// Extend PrismaService with tenant context methods
declare module '../database/prisma.service' {
  interface PrismaService {
    setTenantContext(tenantId: string): void;
    clearTenantContext(): void;
    getTenantContext(): string | undefined;
  }
}

// Add methods to PrismaService prototype
PrismaService.prototype.setTenantContext = function (tenantId: string) {
  (this as unknown as { _tenantId: string })._tenantId = tenantId;
};

PrismaService.prototype.clearTenantContext = function () {
  delete (this as unknown as { _tenantId?: string })._tenantId;
};

PrismaService.prototype.getTenantContext = function () {
  return (this as unknown as { _tenantId?: string })._tenantId;
};
