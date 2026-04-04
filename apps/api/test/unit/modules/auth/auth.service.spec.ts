import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from '../../../../src/modules/auth/auth.service';
import { PrismaService } from '../../../../src/common/database/prisma.service';
import { UsersService } from '../../../../src/modules/users/users.service';
import { TenantsService } from '../../../../src/modules/tenants/tenants.service';
import { testUsers, TEST_PASSWORD, TEST_PASSWORD_HASH } from '../../../fixtures/users.fixture';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let usersService: jest.Mocked<UsersService>;
  let tenantsService: jest.Mocked<TenantsService>;

  const mockUser = {
    id: 'user-123',
    email: testUsers.owner.email,
    passwordHash: TEST_PASSWORD_HASH,
    name: testUsers.owner.name,
    emailVerified: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTenant = {
    id: 'tenant-123',
    name: 'Test Workspace',
    slug: 'test-workspace',
    schema: 'tenant_test-workspace',
    plan: 'FREE',
    status: 'ACTIVE',
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMembership = {
    id: 'membership-123',
    userId: mockUser.id,
    tenantId: mockTenant.id,
    role: 'OWNER',
    joinedAt: new Date(),
    tenant: mockTenant,
  };

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      tenantMember: {
        findUnique: jest.fn(),
      },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      tenant: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('7d'),
            getOrThrow: jest.fn().mockReturnValue('refresh-secret'),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: TenantsService,
          useValue: {
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
    usersService = module.get(UsersService);
    tenantsService = module.get(TenantsService);
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);
      prisma.tenantMember.findUnique.mockResolvedValue(mockMembership);
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.refreshToken.create.mockResolvedValue({
        id: 'token-123',
        token: 'mock-refresh-token',
        userId: mockUser.id,
        tenantId: mockTenant.id,
        expiresAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      });
      tenantsService.create.mockResolvedValue(mockTenant as any);

      const result = await service.register({
        email: testUsers.newUser.email,
        password: testUsers.newUser.password,
        name: testUsers.newUser.name,
        tenantName: testUsers.newUser.tenantName,
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(testUsers.newUser.email.toLowerCase());
    });

    it('should throw BadRequestException if email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: testUsers.owner.email,
          password: TEST_PASSWORD,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials (single tenant)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        tenantMemberships: [mockMembership],
      });
      prisma.tenantMember.findUnique.mockResolvedValue(mockMembership);
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.refreshToken.create.mockResolvedValue({
        id: 'token-123',
        token: 'mock-refresh-token',
        userId: mockUser.id,
        tenantId: mockTenant.id,
        expiresAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      });

      const result = await service.login({
        email: testUsers.owner.email,
        password: TEST_PASSWORD,
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.id).toBe(mockUser.id);
      expect(result.tenant).toBeDefined();
    });

    it('should return tenant list for user with multiple tenants', async () => {
      const secondTenant = {
        ...mockTenant,
        id: 'tenant-456',
        name: 'Second Workspace',
      };
      const secondMembership = {
        ...mockMembership,
        id: 'membership-456',
        tenantId: secondTenant.id,
        tenant: secondTenant,
      };

      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        tenantMemberships: [mockMembership, secondMembership],
      });
      prisma.refreshToken.create.mockResolvedValue({
        id: 'token-123',
        token: 'mock-refresh-token',
        userId: mockUser.id,
        tenantId: null,
        expiresAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      });

      const result = await service.login({
        email: testUsers.owner.email,
        password: TEST_PASSWORD,
      });

      expect(result.tenants).toHaveLength(2);
      expect(result.tenant).toBeUndefined();
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@test.com',
          password: TEST_PASSWORD,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        tenantMemberships: [],
      });

      await expect(
        service.login({
          email: testUsers.owner.email,
          password: 'WrongPassword123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('switchTenant', () => {
    it('should switch tenant successfully', async () => {
      prisma.tenantMember.findUnique.mockResolvedValue(mockMembership);
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.refreshToken.create.mockResolvedValue({
        id: 'token-123',
        token: 'mock-refresh-token',
        userId: mockUser.id,
        tenantId: mockTenant.id,
        expiresAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      });
      usersService.findById.mockResolvedValue(mockUser as any);

      const result = await service.switchTenant(mockUser.id, {
        tenantId: mockTenant.id,
      });

      expect(result.tenant).toBeDefined();
      expect(result.tenant!.id).toBe(mockTenant.id);
    });

    it('should throw UnauthorizedException if not a member of tenant', async () => {
      prisma.tenantMember.findUnique.mockResolvedValue(null);

      await expect(
        service.switchTenant(mockUser.id, { tenantId: 'non-member-tenant' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens successfully', async () => {
      const storedToken = {
        id: 'token-123',
        token: 'valid-refresh-token',
        userId: mockUser.id,
        tenantId: mockTenant.id,
        expiresAt: new Date(Date.now() + 86400000), // 1 day from now
        createdAt: new Date(),
        revokedAt: null,
        user: mockUser,
      };

      prisma.refreshToken.findUnique.mockResolvedValue(storedToken);
      prisma.refreshToken.update.mockResolvedValue({ ...storedToken, revokedAt: new Date() });
      prisma.tenantMember.findUnique.mockResolvedValue(mockMembership);
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.refreshToken.create.mockResolvedValue({
        ...storedToken,
        id: 'new-token-123',
        token: 'new-refresh-token',
      });

      const result = await service.refreshTokens('valid-refresh-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedException for revoked token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-123',
        token: 'revoked-token',
        userId: mockUser.id,
        tenantId: mockTenant.id,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        revokedAt: new Date(), // Already revoked
        user: mockUser,
      });

      await expect(service.refreshTokens('revoked-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for expired token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-123',
        token: 'expired-token',
        userId: mockUser.id,
        tenantId: mockTenant.id,
        expiresAt: new Date(Date.now() - 86400000), // 1 day ago
        createdAt: new Date(),
        revokedAt: null,
        user: mockUser,
      });

      await expect(service.refreshTokens('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke specific refresh token', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout(mockUser.id, 'refresh-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          token: 'refresh-token',
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should revoke all tokens if no specific token provided', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await service.logout(mockUser.id);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
