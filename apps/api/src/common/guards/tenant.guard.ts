import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Guard that ensures a tenant context is present in the request.
 * Use this guard on routes that require tenant isolation.
 *
 * Usage:
 * @UseGuards(TenantGuard)
 * @Controller('products')
 * export class ProductsController {}
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException(
        'No tenant context. Please select a tenant or re-authenticate.',
      );
    }

    return true;
  }
}
