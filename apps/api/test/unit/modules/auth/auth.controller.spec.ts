import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from '../../../../src/modules/auth/auth.controller';
import { AuthService } from '../../../../src/modules/auth/auth.service';
import { testUsers, TEST_PASSWORD } from '../../../fixtures/users.fixture';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockAuthResponse = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    user: {
      id: 'user-123',
      email: testUsers.owner.email,
      name: testUsers.owner.name,
    },
    tenant: {
      id: 'tenant-123',
      name: 'Test Workspace',
      role: 'OWNER',
    },
  };

  const mockResponse = {
    cookie: jest.fn(),
  };

  const mockRequest = {
    cookies: {
      refreshToken: 'mock-refresh-token',
    },
  };

  const mockJwtPayload = {
    sub: 'user-123',
    email: testUsers.owner.email,
    tenantId: 'tenant-123',
    role: 'OWNER',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            switchTenant: jest.fn(),
            refreshTokens: jest.fn(),
            logout: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('development'),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  describe('register', () => {
    it('should register a new user and set cookie', async () => {
      authService.register.mockResolvedValue(mockAuthResponse);

      const result = await controller.register(
        {
          email: testUsers.newUser.email,
          password: testUsers.newUser.password,
          name: testUsers.newUser.name,
        },
        mockResponse as any,
      );

      expect(result).not.toHaveProperty('refreshToken');
      expect(result.accessToken).toBe(mockAuthResponse.accessToken);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        mockAuthResponse.refreshToken,
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/api/auth',
        }),
      );
    });
  });

  describe('login', () => {
    it('should login user and set cookie', async () => {
      authService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(
        { email: testUsers.owner.email, password: TEST_PASSWORD },
        mockResponse as any,
      );

      expect(result).not.toHaveProperty('refreshToken');
      expect(result.accessToken).toBe(mockAuthResponse.accessToken);
      expect(result.user).toEqual(mockAuthResponse.user);
      expect(mockResponse.cookie).toHaveBeenCalled();
    });
  });

  describe('switchTenant', () => {
    it('should switch tenant and set new cookie', async () => {
      authService.switchTenant.mockResolvedValue(mockAuthResponse);

      const result = await controller.switchTenant(
        mockJwtPayload,
        { tenantId: 'tenant-456' },
        mockResponse as any,
      );

      expect(result).not.toHaveProperty('refreshToken');
      expect(mockResponse.cookie).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('should refresh tokens from cookie', async () => {
      authService.refreshTokens.mockResolvedValue(mockAuthResponse);

      const result = await controller.refresh(
        mockRequest as any,
        mockResponse as any,
      );

      expect(result).not.toHaveProperty('refreshToken');
      expect(authService.refreshTokens).toHaveBeenCalledWith('mock-refresh-token');
      expect(mockResponse.cookie).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if no cookie', async () => {
      const requestWithoutCookie = { cookies: {} };

      await expect(
        controller.refresh(requestWithoutCookie as any, mockResponse as any),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should logout and clear cookie', async () => {
      authService.logout.mockResolvedValue(undefined);

      await controller.logout(
        mockJwtPayload,
        mockRequest as any,
        mockResponse as any,
      );

      expect(authService.logout).toHaveBeenCalledWith(
        mockJwtPayload.sub,
        'mock-refresh-token',
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        '',
        expect.objectContaining({
          httpOnly: true,
          maxAge: 0,
        }),
      );
    });
  });
});
