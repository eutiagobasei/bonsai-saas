import { SetMetadata } from '@nestjs/common';

export const AUDIT_METADATA_KEY = 'audit';

export interface AuditOptions {
  action: string;
  entity: string;
  getEntityId?: (args: unknown[]) => string | undefined;
}

/**
 * Decorator to mark methods for audit logging.
 *
 * @example
 * ```typescript
 * @Audit({ action: 'INVITE_MEMBER', entity: 'TenantMember' })
 * async inviteMember(tenantId: string, dto: InviteMemberDto) { ... }
 * ```
 */
export const Audit = (options: AuditOptions) =>
  SetMetadata(AUDIT_METADATA_KEY, options);
