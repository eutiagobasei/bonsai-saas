import { SetMetadata } from '@nestjs/common';

export const SUPER_ADMIN_KEY = 'isSuperAdmin';

/**
 * Decorator to mark a route as requiring Super Admin access.
 *
 * Usage:
 * @SuperAdmin()
 * @Get('stats')
 * getStats() {}
 */
export const SuperAdmin = () => SetMetadata(SUPER_ADMIN_KEY, true);
