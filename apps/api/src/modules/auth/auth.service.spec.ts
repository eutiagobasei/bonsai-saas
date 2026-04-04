import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { PrismaService } from '../../common/database/prisma.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let usersService: any;
  let tenantsService: any;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    name: 'Test User',
    emailVerified: null,
    createdAt: new Date(),
    updatedAt: new Date(),
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
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      tenant: {
        findUnique: jest.fn(),
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
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          JWT_REFRESH_EXPIRES_IN: '7d',
        };
        return config[key] ?? defaultValue;
      }),
      getOrThrow: jest.fn().mockReturnValue('mock-refresh-secret'),
    };

    usersService = {
      findById: jest.fn(),
    };

    tenantsService = {
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UsersService, useValue: usersService },
        { provide: TenantsService, useValue: tenantsService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'new@example.com',
      password: 'SecurePass123!',
      name: 'New User',
    };

    it('should register a new user successfully', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue({
        ...mockUser,
        email: registerDto.email,
        name: registerDto.name,
      });
      tenantsService.create.mockResolvedValue({
        ...mockTenant,
        members: [mockMembership],
      });
      prisma.tenantMember.findUnique.mockResolvedValue(mockMembership);
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.refreshToken.create.mockResolvedValue({
        id: 'refresh-123',
        token: 'mock-token',
        userId: mockUser.id,
        tenantId: mockTenant.id,
        expiresAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      });

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(registerDto.email.toLowerCase());
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
    });

    it('should throw BadRequestException if email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should normalize email to lowercase', async () => {
      const dtoWithUppercaseEmail = {
        ...registerDto,
        email: 'TEST@EXAMPLE.COM',
      };

      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue({
        ...mockUser,
        email: 'test@example.com',
      });
      tenantsService.create.mockResolvedValue({
        ...mockTenant,
        members: [mockMembership],
      });
      prisma.tenantMember.findUnique.mockResolvedValue(mockMembership);
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.refreshToken.create.mockResolvedValue({
        id: 'refresh-123',
        token: 'mock-token',
        userId: mockUser.id,
        tenantId: mockTenant.id,
        expiresAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      });

      await service.register(dtoWithUppercaseEmail);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'SecurePass123!',
    };

    it('should login user with single tenant', async () => {
      const userWithMembership = {
        ...mockUser,
        tenantMemberships: [
          {
            ...mockMembership,
            tenant: mockTenant,
          },
        ],
      };

      prisma.user.findUnique.mockResolvedValue(userWithMembership);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.tenantMember.findUnique.mockResolvedValue(mockMembership);
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.refreshToken.create.mockResolvedValue({
        id: 'refresh-123',
        token: 'mock-token',
        userId: mockUser.id,
        tenantId: mockTenant.id,
        expiresAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      });

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('tenant');
      expect(result.tenant?.id).toBe(mockTenant.id);
    });

    it('should return tenant list for user with multiple tenants', async () => {
      const secondTenant = { ...mockTenant, id: 'tenant-456', name: 'Second' };
      const userWithMultipleTenants = {
        ...mockUser,
        tenantMemberships: [
          { ...mockMembership, tenant: mockTenant },
          {
            ...mockMembership,
            id: 'member-456',
            tenantId: 'tenant-456',
            tenant: secondTenant,
          },
        ],
      };

      prisma.user.findUnique.mockResolvedValue(userWithMultipleTenants);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.refreshToken.create.mockResolvedValue({
        id: 'refresh-123',
        token: 'mock-token',
        userId: mockUser.id,
        tenantId: null,
        expiresAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      });

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('tenants');
      expect(result.tenants).toHaveLength(2);
      expect(result.tenant).toBeUndefined();
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        tenantMemberships: [],
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('switchTenant', () => {
    const switchDto = { tenantId: 'tenant-456' };

    it('should switch to a valid tenant', async () => {
      const newTenant = {
        ...mockTenant,
        id: 'tenant-456',
        name: 'New Tenant',
      };
      const newMembership = {
        ...mockMembership,
        tenantId: 'tenant-456',
        role: 'MEMBER',
        tenant: newTenant,
      };

      prisma.tenantMember.findUnique.mockResolvedValue(newMembership);
      usersService.findById.mockResolvedValue(mockUser);
      prisma.tenant.findUnique.mockResolvedValue(newTenant);
      prisma.refreshToken.create.mockResolvedValue({
        id: 'refresh-123',
        token: 'mock-token',
        userId: mockUser.id,
        tenantId: newTenant.id,
        expiresAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      });

      const result = await service.switchTenant(mockUser.id, switchDto);

      expect(result).toHaveProperty('accessToken');
      expect(result.tenant?.id).toBe('tenant-456');
    });

    it('should throw UnauthorizedException if not a member', async () => {
      prisma.tenantMember.findUnique.mockResolvedValue(null);

      await expect(
        service.switchTenant(mockUser.id, switchDto),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    const refreshToken = 'valid-refresh-token';

    it('should refresh tokens successfully', async () => {
      const storedToken = {
        id: 'refresh-123',
        token: refreshToken,
        userId: mockUser.id,
        tenantId: mockTenant.id,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        revokedAt: null,
        user: mockUser,
      };

      prisma.refreshToken.findUnique.mockResolvedValue(storedToken);
      prisma.refreshToken.update.mockResolvedValue({
        ...storedToken,
        revokedAt: new Date(),
      });
      prisma.tenantMember.findUnique.mockResolvedValue(mockMembership);
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.refreshToken.create.mockResolvedValue({
        id: 'refresh-new',
        token: 'new-mock-token',
        userId: mockUser.id,
        tenantId: mockTenant.id,
        expiresAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      });

      const result = await service.refreshTokens(refreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for revoked token', async () => {
      const revokedToken = {
        id: 'refresh-123',
        token: refreshToken,
        userId: mockUser.id,
        tenantId: mockTenant.id,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        revokedAt: new Date(),
        user: mockUser,
      };

      prisma.refreshToken.findUnique.mockResolvedValue(revokedToken);

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for expired token', async () => {
      const expiredToken = {
        id: 'refresh-123',
        token: refreshToken,
        userId: mockUser.id,
        tenantId: mockTenant.id,
        expiresAt: new Date(Date.now() - 86400000),
        createdAt: new Date(),
        revokedAt: null,
        user: mockUser,
      };

      prisma.refreshToken.findUnique.mockResolvedValue(expiredToken);

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke specific token', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout(mockUser.id, 'specific-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          token: 'specific-token',
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should revoke all tokens when no specific token provided', async () => {
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
