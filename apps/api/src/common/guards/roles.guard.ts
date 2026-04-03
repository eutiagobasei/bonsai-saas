import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, TenantRole } from '../decorators/roles.decorator';

/**
 * Guard that checks if the user has the required role within the tenant.
 *
 * Usage:
 * @UseGuards(RolesGuard)
 * @Roles(TenantRole.ADMIN)
 * @Delete(':id')
 * remove() {}
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<TenantRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No roles required
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRole = request.user?.role as TenantRole;

    if (!userRole) {
      throw new ForbiddenException('No role found in token');
    }

    // Role hierarchy: OWNER > ADMIN > MEMBER > VIEWER
    const roleHierarchy: Record<TenantRole, number> = {
      [TenantRole.OWNER]: 4,
      [TenantRole.ADMIN]: 3,
      [TenantRole.MEMBER]: 2,
      [TenantRole.VIEWER]: 1,
    };

    const userRoleLevel = roleHierarchy[userRole] ?? 0;
    const hasPermission = requiredRoles.some(
      (role) => userRoleLevel >= roleHierarchy[role],
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredRoles.join(' or ')}`,
      );
    }

    return true;
  }
}
