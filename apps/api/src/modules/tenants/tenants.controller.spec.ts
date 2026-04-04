import { Test, TestingModule } from '@nestjs/testing';

import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

describe('TenantsController', () => {
  let controller: TenantsController;
  let tenantsService: any;

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
    members: [],
  };

  const mockMembership = {
    id: 'member-123',
    userId: 'user-123',
    tenantId: 'tenant-123',
    role: 'OWNER',
    joinedAt: new Date(),
    user: mockUser,
  };

  const mockJwtPayload = {
    sub: 'user-123',
    email: 'test@example.com',
    tenantId: 'tenant-123',
    role: 'OWNER',
  };

  beforeEach(async () => {
    tenantsService = {
      create: jest.fn(),
      findById: jest.fn(),
      findByIdForUser: jest.fn(),
      update: jest.fn(),
      getMembers: jest.fn(),
      inviteMember: jest.fn(),
      updateMemberRole: jest.fn(),
      removeMember: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [{ provide: TenantsService, useValue: tenantsService }],
    }).compile();

    controller = module.get<TenantsController>(TenantsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = { name: 'New Tenant' };

    it('should create a new tenant', async () => {
      tenantsService.create.mockResolvedValue({
        ...mockTenant,
        name: 'New Tenant',
      });

      const result = await controller.create(mockJwtPayload, createDto);

      expect(result.name).toBe('New Tenant');
      expect(tenantsService.create).toHaveBeenCalledWith(
        createDto,
        mockJwtPayload.sub,
      );
    });
  });

  describe('getCurrent', () => {
    it('should return current tenant', async () => {
      tenantsService.findById.mockResolvedValue(mockTenant);

      const result = await controller.getCurrent(mockTenant.id);

      expect(result).toEqual(mockTenant);
      expect(tenantsService.findById).toHaveBeenCalledWith(mockTenant.id);
    });
  });

  describe('findById', () => {
    it('should return tenant by id for authorized user', async () => {
      tenantsService.findByIdForUser.mockResolvedValue(mockTenant);

      const result = await controller.findById(mockJwtPayload, mockTenant.id);

      expect(result).toEqual(mockTenant);
      expect(tenantsService.findByIdForUser).toHaveBeenCalledWith(
        mockTenant.id,
        mockJwtPayload.sub,
      );
    });
  });

  describe('update', () => {
    it('should update tenant', async () => {
      const updateData = { name: 'Updated Name' };
      tenantsService.update.mockResolvedValue({
        ...mockTenant,
        name: 'Updated Name',
      });

      const result = await controller.update(
        mockTenant.id,
        mockJwtPayload,
        updateData,
      );

      expect(result.name).toBe('Updated Name');
      expect(tenantsService.update).toHaveBeenCalledWith(
        mockTenant.id,
        mockJwtPayload.sub,
        updateData,
      );
    });
  });

  describe('getMembers', () => {
    it('should return all members', async () => {
      const members = [mockMembership];
      tenantsService.getMembers.mockResolvedValue(members);

      const result = await controller.getMembers(mockTenant.id);

      expect(result).toEqual(members);
      expect(tenantsService.getMembers).toHaveBeenCalledWith(mockTenant.id);
    });
  });

  describe('inviteMember', () => {
    const inviteDto = { email: 'new@example.com', role: 'MEMBER' as const };

    it('should invite a new member', async () => {
      const newMembership = {
        ...mockMembership,
        id: 'new-member',
        userId: 'new-user',
        role: 'MEMBER',
        user: { ...mockUser, id: 'new-user', email: 'new@example.com' },
      };
      tenantsService.inviteMember.mockResolvedValue(newMembership);

      const result = await controller.inviteMember(
        mockTenant.id,
        mockJwtPayload,
        inviteDto,
      );

      expect(result.user.email).toBe('new@example.com');
      expect(tenantsService.inviteMember).toHaveBeenCalledWith(
        mockTenant.id,
        mockJwtPayload.sub,
        inviteDto,
      );
    });
  });

  describe('updateMemberRole', () => {
    const updateRoleDto = { role: 'ADMIN' as const };
    const memberId = 'member-to-update';

    it('should update member role', async () => {
      tenantsService.updateMemberRole.mockResolvedValue({
        ...mockMembership,
        id: memberId,
        role: 'ADMIN',
      });

      const result = await controller.updateMemberRole(
        mockTenant.id,
        mockJwtPayload,
        memberId,
        updateRoleDto,
      );

      expect(result.role).toBe('ADMIN');
      expect(tenantsService.updateMemberRole).toHaveBeenCalledWith(
        mockTenant.id,
        mockJwtPayload.sub,
        memberId,
        'ADMIN',
      );
    });
  });

  describe('removeMember', () => {
    const memberId = 'member-to-remove';

    it('should remove a member', async () => {
      tenantsService.removeMember.mockResolvedValue(undefined);

      await controller.removeMember(mockTenant.id, mockJwtPayload, memberId);

      expect(tenantsService.removeMember).toHaveBeenCalledWith(
        mockTenant.id,
        mockJwtPayload.sub,
        memberId,
      );
    });
  });
});
