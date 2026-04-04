import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../database/prisma.service';

/**
 * Row Level Security Interceptor
 *
 * Sets the current tenant context in PostgreSQL session for RLS policies.
 * This ensures that all database queries within the request are automatically
 * filtered by the tenant context.
 *
 * Usage:
 * - Apply globally or to specific controllers/routes
 * - Requires tenantId in the JWT payload (extracted by TenantInterceptor first)
 *
 * Note: This works in conjunction with the RLS policies defined in the database
 * migration (00000000000001_add_rls_policies).
 */
@Injectable()
export class RlsInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenantId;

    if (tenantId) {
      // Set the tenant context for RLS policies
      await this.prisma.$executeRaw`SELECT set_current_tenant(${tenantId})`;
    }

    return next.handle();
  }
}
