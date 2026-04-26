import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext, TenantContextData } from '../database/tenant-context';
import { TenantAwarePrismaService } from '../database/tenant-aware-prisma.service';
import { PrismaService } from '../database/prisma.service';

/**
 * Interceptor that extracts tenant context from the JWT and:
 * 1. Attaches it to the request object for easy access
 * 2. Sets up AsyncLocalStorage context for the entire request lifecycle
 * 3. Configures the database connection for tenant isolation (schema + RLS)
 *
 * This provides defense-in-depth for multi-tenant data isolation.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantInterceptor.name);
  private readonly schemaCache = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantAwarePrisma: TenantAwarePrismaService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    // If user is authenticated and has a tenantId, set up tenant context
    if (request.user?.tenantId) {
      const tenantId = request.user.tenantId;

      // Look up the tenant's schema name from the database (with caching)
      const tenantSchema = await this.getTenantSchema(tenantId);

      if (!tenantSchema) {
        this.logger.warn(`Tenant ${tenantId} not found or has no schema`);
        return next.handle();
      }

      // Attach to request for easy access in controllers
      request.tenantId = tenantId;
      request.tenantSchema = tenantSchema;

      // Create context data for AsyncLocalStorage
      const contextData: TenantContextData = {
        tenantId,
        tenantSchema,
        userId: request.user.sub,
      };

      // Set up database context for tenant isolation
      await this.tenantAwarePrisma.setTenantSchema(tenantSchema);
      await this.tenantAwarePrisma.setTenantContext(tenantId);

      // Also set context on PrismaService for middleware (uses internal _tenantId property)
      (this.prisma as unknown as { _tenantId: string })._tenantId = tenantId;

      // Run the rest of the request within the tenant context
      return new Observable((subscriber) => {
        TenantContext.runAsync(contextData, async () => {
          try {
            const result = await next.handle().toPromise();
            subscriber.next(result);
            subscriber.complete();
          } catch (error) {
            subscriber.error(error);
          } finally {
            // Clear tenant context after request completes
            await this.tenantAwarePrisma.clearTenantContext();
            delete (this.prisma as unknown as { _tenantId?: string })._tenantId;
          }
        });
      });
    }

    // No tenant context, proceed normally
    return next.handle();
  }

  /**
   * Get tenant schema with caching to avoid repeated database lookups.
   * Cache is in-memory and cleared when the interceptor instance is recreated.
   */
  private async getTenantSchema(tenantId: string): Promise<string | null> {
    // Check cache first
    const cached = this.schemaCache.get(tenantId);
    if (cached) {
      return cached;
    }

    // Look up from database
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { schema: true },
    });

    if (tenant?.schema) {
      // Cache for future requests (in-memory, per-instance)
      this.schemaCache.set(tenantId, tenant.schema);
      return tenant.schema;
    }

    return null;
  }
}
