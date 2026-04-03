import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to extract the current tenant ID from the JWT token.
 *
 * Usage:
 * @Get()
 * findAll(@CurrentTenant() tenantId: string) {
 *   return this.service.findAllByTenant(tenantId);
 * }
 */
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.tenantId ?? null;
  },
);
