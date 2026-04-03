import { SetMetadata } from '@nestjs/common';

export enum TenantRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify required roles for a route.
 *
 * Usage:
 * @Roles(TenantRole.ADMIN, TenantRole.OWNER)
 * @Delete(':id')
 * remove(@Param('id') id: string) {
 *   return this.service.remove(id);
 * }
 */
export const Roles = (...roles: TenantRole[]) => SetMetadata(ROLES_KEY, roles);
