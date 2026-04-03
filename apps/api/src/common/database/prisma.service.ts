import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

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
    this.logger.log('Database connection established');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }

  /**
   * Execute raw SQL for tenant schema operations
   */
  async createTenantSchema(schemaName: string): Promise<void> {
    // Validate schema name to prevent SQL injection
    if (!/^tenant_[a-z0-9_]+$/.test(schemaName)) {
      throw new Error(`Invalid schema name: ${schemaName}`);
    }

    await this.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    this.logger.log(`Created tenant schema: ${schemaName}`);
  }

  /**
   * Drop tenant schema (use with caution!)
   */
  async dropTenantSchema(schemaName: string): Promise<void> {
    if (!/^tenant_[a-z0-9_]+$/.test(schemaName)) {
      throw new Error(`Invalid schema name: ${schemaName}`);
    }

    await this.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    this.logger.warn(`Dropped tenant schema: ${schemaName}`);
  }

  /**
   * Clean database for testing (only in test environment)
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase can only be called in test environment');
    }

    const tablenames = await this.$queryRaw<
      Array<{ tablename: string }>
    >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

    for (const { tablename } of tablenames) {
      if (tablename !== '_prisma_migrations') {
        await this.$executeRawUnsafe(
          `TRUNCATE TABLE "public"."${tablename}" CASCADE;`,
        );
      }
    }
  }
}
