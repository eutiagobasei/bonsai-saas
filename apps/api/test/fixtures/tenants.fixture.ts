import { Plan, TenantRole, TenantStatus } from '@prisma/client';

export const testTenants = {
  default: {
    name: 'Test Workspace',
    slug: 'test-workspace',
    schema: 'tenant_test-workspace',
    plan: Plan.FREE,
    status: TenantStatus.ACTIVE,
  },
  premium: {
    name: 'Premium Workspace',
    slug: 'premium-workspace',
    schema: 'tenant_premium-workspace',
    plan: Plan.PRO,
    status: TenantStatus.ACTIVE,
  },
  suspended: {
    name: 'Suspended Workspace',
    slug: 'suspended-workspace',
    schema: 'tenant_suspended-workspace',
    plan: Plan.FREE,
    status: TenantStatus.SUSPENDED,
  },
};

export const testMemberships = {
  ownerMembership: {
    role: TenantRole.OWNER,
  },
  adminMembership: {
    role: TenantRole.ADMIN,
  },
  memberMembership: {
    role: TenantRole.MEMBER,
  },
  viewerMembership: {
    role: TenantRole.VIEWER,
  },
};

export function createTenantFixture(overrides?: Partial<typeof testTenants.default>) {
  const slug = overrides?.slug ?? `test-${Date.now()}`;
  return {
    ...testTenants.default,
    slug,
    schema: `tenant_${slug}`,
    ...overrides,
  };
}
