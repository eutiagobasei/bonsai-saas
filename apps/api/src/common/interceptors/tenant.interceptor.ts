import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext, TenantContextData } from '../database/tenant-context';
import { TenantAwarePrismaService } from '../database/tenant-aware-prisma.service';

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
  constructor(private readonly prisma: TenantAwarePrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    // If user is authenticated and has a tenantId, set up tenant context
    if (request.user?.tenantId) {
      const tenantId = request.user.tenantId;
      const tenantSchema = `tenant_${tenantId}`;

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
      await this.prisma.setTenantSchema(tenantSchema);
      await this.prisma.setTenantContext(tenantId);

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
            await this.prisma.clearTenantContext();
          }
        });
      });
    }

    // No tenant context, proceed normally
    return next.handle();
  }
}
