import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { TenantContext } from './tenant-context';

/**
 * Tenant-aware Prisma service that implements:
 * 1. Schema Switching - Sets PostgreSQL search_path per request
 * 2. Row-Level Security context - Sets app.tenant_id for RLS policies
 *
 * This provides defense-in-depth: even if application code has bugs,
 * the database layer will prevent cross-tenant data access.
 */
@Injectable()
export class TenantAwarePrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(TenantAwarePrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Tenant-aware database connection established');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Tenant-aware database connection closed');
  }

  /**
   * Set the tenant schema for the current connection.
   * This changes the PostgreSQL search_path to include the tenant's schema.
   *
   * @param schemaName - The schema name (e.g., 'tenant_abc123')
   */
  async setTenantSchema(schemaName: string): Promise<void> {
    // Validate schema name to prevent SQL injection
    if (!/^tenant_[a-z0-9_-]+$/.test(schemaName)) {
      throw new Error(`Invalid tenant schema name: ${schemaName}`);
    }

    await this.$executeRawUnsafe(`SET search_path TO "${schemaName}", public`);
  }

  /**
   * Set the tenant context for Row-Level Security.
   * This sets a session variable that RLS policies can reference.
   * Uses the set_current_tenant function from the RLS migration.
   *
   * @param tenantId - The tenant ID
   */
  async setTenantContext(tenantId: string): Promise<void> {
    // Use the helper function from RLS migration
    await this.$executeRaw`SELECT set_current_tenant(${tenantId})`;
  }

  /**
   * Clear the tenant context.
   * Useful after completing a request or for system operations.
   */
  async clearTenantContext(): Promise<void> {
    await this.$executeRaw`SELECT set_config('app.current_tenant_id', '', false)`;
    await this.$executeRawUnsafe(`SET search_path TO public`);
  }

  /**
   * Execute a function within a tenant context.
   * Automatically sets schema and RLS context before execution.
   *
   * @param tenantId - The tenant ID
   * @param fn - The function to execute
   */
  async withTenantContext<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    const schemaName = `tenant_${tenantId}`;

    try {
      await this.setTenantSchema(schemaName);
      await this.setTenantContext(tenantId);
      return await fn();
    } finally {
      // Reset to public schema after operation
      await this.clearTenantContext();
    }
  }

  /**
   * Execute within the current tenant context (from AsyncLocalStorage).
   * If no tenant context exists, executes in public schema.
   */
  async withCurrentTenant<T>(fn: () => Promise<T>): Promise<T> {
    const context = TenantContext.getContext();

    if (!context) {
      // No tenant context, execute in public schema
      return fn();
    }

    return this.withTenantContext(context.tenantId, fn);
  }

  /**
   * Create a new tenant schema with all required tables.
   * This should be called when a new tenant is created.
   */
  async createTenantSchema(schemaName: string): Promise<void> {
    if (!/^tenant_[a-z0-9_-]+$/.test(schemaName)) {
      throw new Error(`Invalid schema name: ${schemaName}`);
    }

    await this.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    this.logger.log(`Created tenant schema: ${schemaName}`);
  }

  /**
   * Drop a tenant schema (use with extreme caution!).
   * This permanently deletes all tenant data.
   */
  async dropTenantSchema(schemaName: string): Promise<void> {
    if (!/^tenant_[a-z0-9_-]+$/.test(schemaName)) {
      throw new Error(`Invalid schema name: ${schemaName}`);
    }

    await this.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    this.logger.warn(`Dropped tenant schema: ${schemaName}`);
  }

  /**
   * Clean database for testing (only in test environment).
   */
  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase can only be called in test environment');
    }

    const tablenames = await this.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname='public'
    `;

    for (const { tablename } of tablenames) {
      if (tablename !== '_prisma_migrations') {
        await this.$executeRawUnsafe(
          `TRUNCATE TABLE "public"."${tablename}" CASCADE;`,
        );
      }
    }
  }
}
