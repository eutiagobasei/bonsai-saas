import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';

import { TenantsService } from './tenants.service';
import { PrismaService } from '../../common/database/prisma.service';

describe('TenantsService', () => {
  let service: TenantsService;
  let prisma: any;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockTenant = {
    id: 'tenant-123',
    name: 'Test Tenant',
    slug: 'test-tenant',
    schema: 'tenant_test_tenant',
    plan: 'FREE',
    status: 'ACTIVE',
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMembership = {
    id: 'member-123',
    userId: 'user-123',
    tenantId: 'tenant-123',
    role: 'OWNER',
    joinedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      tenant: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      tenantMember: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      createTenantSchema: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = { name: 'New Tenant' };

    it('should create a tenant with unique slug', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.tenant.create.mockResolvedValue({
        ...mockTenant,
        name: 'New Tenant',
        slug: 'new-tenant',
        schema: 'tenant_new_tenant',
        members: [mockMembership],
      });
      prisma.createTenantSchema.mockResolvedValue(undefined);

      const result = await service.create(createDto, mockUser.id);

      expect(result.name).toBe('New Tenant');
      expect(result.slug).toBe('new-tenant');
      expect(prisma.createTenantSchema).toHaveBeenCalledWith('tenant_new_tenant');
    });

    it('should generate unique slug when name already exists', async () => {
      prisma.tenant.findUnique
        .mockResolvedValueOnce(mockTenant)
        .mockResolvedValueOnce(null);
      prisma.tenant.create.mockResolvedValue({
        ...mockTenant,
        slug: 'test-tenant-1',
        members: [mockMembership],
      });
      prisma.createTenantSchema.mockResolvedValue(undefined);

      const result = await service.create({ name: 'Test Tenant' }, mockUser.id);

      expect(result.slug).toBe('test-tenant-1');
    });
  });

  describe('findById', () => {
    it('should return tenant with members', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        ...mockTenant,
        members: [{ ...mockMembership, user: mockUser }],
      });

      const result = await service.findById(mockTenant.id);

      expect(result.id).toBe(mockTenant.id);
      expect(result.members).toHaveLength(1);
    });

    it('should throw NotFoundException when tenant not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.findById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findBySlug', () => {
    it('should return tenant by slug', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);

      const result = await service.findBySlug('test-tenant');

      expect(result.slug).toBe('test-tenant');
    });

    it('should throw NotFoundException when slug not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('invalid-slug')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByIdForUser', () => {
    it('should return tenant if user is member', async () => {
      prisma.tenantMember.findUnique.mockResolvedValue(mockMembership);
      prisma.tenant.findUnique.mockResolvedValue({
        ...mockTenant,
        members: [{ ...mockMembership, user: mockUser }],
      });

      const result = await service.findByIdForUser(mockTenant.id, mockUser.id);

      expect(result.id).toBe(mockTenant.id);
    });

    it('should throw ForbiddenException if user is not member', async () => {
      prisma.tenantMember.findUnique.mockResolvedValue(null);

      await expect(
        service.findByIdForUser(mockTenant.id, 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update tenant name as owner', async () => {
      prisma.tenantMember.findUnique.mockResolvedValue(mockMembership);
      prisma.tenant.update.mockResolvedValue({
        ...mockTenant,
        name: 'Updated Name',
      });

      const result = await service.update(mockTenant.id, mockUser.id, {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });

    it('should update tenant name as admin', async () => {
      const adminMembership = { ...mockMembership, role: 'ADMIN' };
      prisma.tenantMember.findUnique.mockResolvedValue(adminMembership);
      prisma.tenant.update.mockResolvedValue({
        ...mockTenant,
        name: 'Updated Name',
      });

      const result = await service.update(mockTenant.id, mockUser.id, {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });

    it('should throw ForbiddenException for non-admin/owner', async () => {
      const memberMembership = { ...mockMembership, role: 'MEMBER' };
      prisma.tenantMember.findUnique.mockResolvedValue(memberMembership);

      await expect(
        service.update(mockTenant.id, mockUser.id, { name: 'New Name' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('inviteMember', () => {
    const inviteDto = { email: 'new@example.com', role: 'MEMBER' as const };
    const newUser = { ...mockUser, id: 'new-user-id', email: 'new@example.com' };

    it('should invite new member successfully', async () => {
      prisma.tenantMember.findUnique
        .mockResolvedValueOnce(mockMembership)
        .mockResolvedValueOnce(null);
      prisma.user.findUnique.mockResolvedValue(newUser);
      prisma.tenantMember.create.mockResolvedValue({
        ...mockMembership,
        id: 'new-member-id',
        userId: newUser.id,
        role: 'MEMBER',
        user: newUser,
      });

      const result = await service.inviteMember(
        mockTenant.id,
        mockUser.id,
        inviteDto,
      );

      expect(result.userId).toBe(newUser.id);
      expect(result.role).toBe('MEMBER');
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.tenantMember.findUnique.mockResolvedValue(mockMembership);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.inviteMember(mockTenant.id, mockUser.id, inviteDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if already member', async () => {
      prisma.tenantMember.findUnique
        .mockResolvedValueOnce(mockMembership)
        .mockResolvedValueOnce({ ...mockMembership, userId: newUser.id });
      prisma.user.findUnique.mockResolvedValue(newUser);

      await expect(
        service.inviteMember(mockTenant.id, mockUser.id, inviteDto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeMember', () => {
    const memberToRemove = {
      ...mockMembership,
      id: 'member-to-remove',
      userId: 'user-to-remove',
      role: 'MEMBER',
    };

    it('should remove member successfully', async () => {
      prisma.tenantMember.findUnique
        .mockResolvedValueOnce(mockMembership)
        .mockResolvedValueOnce(memberToRemove);

      await service.removeMember(
        mockTenant.id,
        mockUser.id,
        memberToRemove.userId,
      );

      expect(prisma.tenantMember.delete).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when removing self', async () => {
      prisma.tenantMember.findUnique.mockResolvedValue(mockMembership);

      await expect(
        service.removeMember(mockTenant.id, mockUser.id, mockUser.id),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when removing owner', async () => {
      const ownerMember = {
        ...memberToRemove,
        userId: 'owner-user',
        role: 'OWNER',
      };
      prisma.tenantMember.findUnique
        .mockResolvedValueOnce(mockMembership)
        .mockResolvedValueOnce(ownerMember);

      await expect(
        service.removeMember(mockTenant.id, mockUser.id, 'owner-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if member not found', async () => {
      prisma.tenantMember.findUnique
        .mockResolvedValueOnce(mockMembership)
        .mockResolvedValueOnce(null);

      await expect(
        service.removeMember(mockTenant.id, mockUser.id, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMemberRole', () => {
    const memberToUpdate = {
      ...mockMembership,
      id: 'member-to-update',
      userId: 'user-to-update',
      role: 'MEMBER',
    };

    it('should update member role as owner', async () => {
      prisma.tenantMember.findUnique.mockResolvedValue(mockMembership);
      prisma.tenantMember.update.mockResolvedValue({
        ...memberToUpdate,
        role: 'ADMIN',
      });

      const result = await service.updateMemberRole(
        mockTenant.id,
        mockUser.id,
        memberToUpdate.userId,
        'ADMIN' as any,
      );

      expect(result.role).toBe('ADMIN');
    });

    it('should throw ForbiddenException if not owner', async () => {
      const adminMembership = { ...mockMembership, role: 'ADMIN' };
      prisma.tenantMember.findUnique.mockResolvedValue(adminMembership);

      await expect(
        service.updateMemberRole(
          mockTenant.id,
          mockUser.id,
          memberToUpdate.userId,
          'ADMIN' as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when changing own role', async () => {
      prisma.tenantMember.findUnique.mockResolvedValue(mockMembership);

      await expect(
        service.updateMemberRole(
          mockTenant.id,
          mockUser.id,
          mockUser.id,
          'ADMIN' as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when assigning owner role', async () => {
      prisma.tenantMember.findUnique.mockResolvedValue(mockMembership);

      await expect(
        service.updateMemberRole(
          mockTenant.id,
          mockUser.id,
          memberToUpdate.userId,
          'OWNER' as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMembers', () => {
    it('should return all members', async () => {
      const members = [
        { ...mockMembership, user: mockUser },
        {
          ...mockMembership,
          id: 'member-2',
          userId: 'user-2',
          role: 'MEMBER',
          user: { ...mockUser, id: 'user-2', email: 'user2@example.com' },
        },
      ];
      prisma.tenantMember.findMany.mockResolvedValue(members);

      const result = await service.getMembers(mockTenant.id);

      expect(result).toHaveLength(2);
    });
  });
});
