import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'crypto';

import { PrismaService } from '../../common/database/prisma.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  Argon2Service,
  SessionService,
  AuditService,
} from '../../common/security';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SwitchTenantDto } from './dto/switch-tenant.dto';

export interface TokenPayload {
  sub: string;
  email: string;
  tenantId?: string;
  role?: string;
  sessionId?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  tenant?: {
    id: string;
    name: string;
    role: string;
  };
  tenants?: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly argon2: Argon2Service,
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService,
  ) {}

  async register(dto: RegisterDto, req?: Request): Promise<AuthResponse> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    // Hash password with Argon2id
    const passwordHash = await this.argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
      },
    });

    // Create default tenant for the user
    const tenant = await this.tenantsService.create(
      {
        name: dto.tenantName ?? `${dto.name ?? dto.email}'s Workspace`,
      },
      user.id,
    );

    // Log registration
    await this.auditService.logAuth('REGISTER', user.id, req!);

    return this.generateAuthResponse(user, tenant.id, undefined, req);
  }

  async login(dto: LoginDto, req?: Request): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        tenantMemberships: {
          include: {
            tenant: true,
          },
        },
      },
    });

    if (!user) {
      await this.auditService.logAuth('LOGIN_FAILED', null, req!, {
        email: dto.email,
        reason: 'user_not_found',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password (supports both Argon2 and bcrypt for migration)
    const isPasswordValid = await this.verifyPassword(
      user.passwordHash,
      dto.password,
      user.id,
    );

    if (!isPasswordValid) {
      await this.auditService.logAuth('LOGIN_FAILED', user.id, req!, {
        reason: 'invalid_password',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Log successful login
    await this.auditService.logAuth('LOGIN', user.id, req!);

    const memberships = user.tenantMemberships;

    // If user has exactly one tenant, log them in directly
    if (memberships.length === 1) {
      return this.generateAuthResponse(
        user,
        memberships[0].tenantId,
        memberships[0].role,
        req,
      );
    }

    // If user has multiple tenants, return list for selection
    // (no tenantId in token yet)
    const tokens = await this.generateTokens(
      {
        sub: user.id,
        email: user.email,
      },
      user.id,
      null,
      req,
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      tenants: memberships.map(
        (m: { tenant: { id: string; name: string }; role: string }) => ({
          id: m.tenant.id,
          name: m.tenant.name,
          role: m.role,
        }),
      ),
    };
  }

  async switchTenant(
    userId: string,
    dto: SwitchTenantDto,
    req?: Request,
  ): Promise<AuthResponse> {
    const membership = await this.prisma.tenantMember.findUnique({
      where: {
        userId_tenantId: {
          userId,
          tenantId: dto.tenantId,
        },
      },
      include: {
        tenant: true,
      },
    });

    if (!membership) {
      throw new UnauthorizedException('You are not a member of this tenant');
    }

    const user = await this.usersService.findById(userId);
    return this.generateAuthResponse(
      user,
      membership.tenantId,
      membership.role,
      req,
    );
  }

  async refreshTokens(refreshToken: string, req?: Request): Promise<AuthResponse> {
    // Hash the token to find it in DB
    const tokenHash = this.hashToken(refreshToken);

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: { user: true, session: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if already revoked
    if (storedToken.revokedAt) {
      // REUSE DETECTION: This token was already used!
      // Revoke entire token family as a security measure
      this.logger.warn(
        `Refresh token reuse detected for user ${storedToken.userId}. Revoking all tokens in family ${storedToken.familyId}`,
      );

      await this.revokeTokenFamily(storedToken.familyId, 'reuse_detected');

      await this.auditService.logAuth('LOGIN_FAILED', storedToken.userId, req!, {
        reason: 'refresh_token_reuse',
        familyId: storedToken.familyId,
      });

      throw new UnauthorizedException('Token reuse detected. Please log in again.');
    }

    // Check expiration
    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Revoke the old token (rotation)
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        revokedAt: new Date(),
        revokedReason: 'rotation',
      },
    });

    // Generate new tokens in the same family
    return this.generateAuthResponse(
      storedToken.user,
      storedToken.tenantId ?? undefined,
      undefined,
      req,
      storedToken.familyId, // Keep same family
      storedToken.sessionId ?? undefined,
    );
  }

  async logout(
    userId: string,
    refreshToken?: string,
    sessionId?: string,
    req?: Request,
  ): Promise<void> {
    if (sessionId) {
      // Revoke specific session
      await this.sessionService.revokeSession(sessionId, userId);
    } else if (refreshToken) {
      // Revoke specific token and its family
      const tokenHash = this.hashToken(refreshToken);
      const token = await this.prisma.refreshToken.findFirst({
        where: { tokenHash, userId },
      });

      if (token) {
        await this.revokeTokenFamily(token.familyId, 'logout');
      }
    } else {
      // Revoke all tokens for user
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokedReason: 'logout_all',
        },
      });

      // Revoke all sessions
      await this.prisma.session.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }

    await this.auditService.logAuth('LOGOUT', userId, req!);
  }

  /**
   * Get user's active sessions
   */
  async getSessions(userId: string, currentSessionId?: string) {
    return this.sessionService.getUserSessions(userId, currentSessionId);
  }

  /**
   * Revoke a specific session (logout from device)
   */
  async revokeSession(
    userId: string,
    sessionId: string,
    req?: Request,
  ): Promise<boolean> {
    const result = await this.sessionService.revokeSession(sessionId, userId);

    if (result) {
      await this.auditService.log({
        userId,
        action: 'LOGOUT',
        entity: 'session',
        entityId: sessionId,
        req,
      });
    }

    return result;
  }

  /**
   * Verify password with migration support
   */
  private async verifyPassword(
    hash: string,
    password: string,
    userId: string,
  ): Promise<boolean> {
    const hashType = this.argon2.detectHashType(hash);

    if (hashType === 'argon2') {
      return this.argon2.verify(hash, password);
    }

    if (hashType === 'bcrypt') {
      // Migrate from bcrypt to argon2
      const newHash = await this.argon2.migrateFromBcrypt(hash, password);

      if (newHash) {
        // Update password hash in background
        this.prisma.user
          .update({
            where: { id: userId },
            data: { passwordHash: newHash },
          })
          .then(() => {
            this.logger.log(`Migrated user ${userId} from bcrypt to argon2`);
          })
          .catch((err) => {
            this.logger.error(`Failed to migrate password for user ${userId}`, err);
          });

        return true;
      }
      return false;
    }

    return false;
  }

  private async generateAuthResponse(
    user: { id: string; email: string; name: string | null },
    tenantId?: string,
    role?: string,
    req?: Request,
    familyId?: string,
    sessionId?: string,
  ): Promise<AuthResponse> {
    let tenantRole = role;

    // If tenantId provided but no role, look it up
    if (tenantId && !tenantRole) {
      const membership = await this.prisma.tenantMember.findUnique({
        where: {
          userId_tenantId: {
            userId: user.id,
            tenantId,
          },
        },
      });
      tenantRole = membership?.role;
    }

    // Create or reuse session
    let session = sessionId
      ? await this.prisma.session.findUnique({ where: { id: sessionId } })
      : null;

    if (!session && req) {
      const deviceInfo = this.sessionService.extractDeviceInfo(req);
      session = await this.sessionService.createSession(
        user.id,
        tenantId ?? null,
        deviceInfo,
      );
    }

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      ...(tenantId && { tenantId }),
      ...(tenantRole && { role: tenantRole }),
      ...(session && { sessionId: session.id }),
    };

    const tokens = await this.generateTokens(
      payload,
      user.id,
      tenantId ?? null,
      req,
      familyId,
      session?.id,
    );

    const response: AuthResponse = {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };

    if (tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
      });
      if (tenant) {
        response.tenant = {
          id: tenant.id,
          name: tenant.name,
          role: tenantRole ?? 'MEMBER',
        };
      }
    }

    return response;
  }

  private async generateTokens(
    payload: TokenPayload,
    userId: string,
    tenantId: string | null,
    req?: Request,
    existingFamilyId?: string,
    sessionId?: string,
  ) {
    const accessToken = this.jwtService.sign(payload);

    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const refreshExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );

    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
    });

    // Store refresh token with family ID for reuse detection
    const expiresAt = this.calculateExpiry(refreshExpiresIn);
    const familyId = existingFamilyId || crypto.randomUUID();
    const tokenHash = this.hashToken(refreshToken);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken, // Keep for backward compatibility (will remove later)
        tokenHash,
        familyId,
        userId,
        tenantId,
        sessionId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Hash token for secure storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Revoke all tokens in a family
   */
  private async revokeTokenFamily(
    familyId: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        familyId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }

  private calculateExpiry(duration: string): Date {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return new Date(Date.now() + value * multipliers[unit]);
  }
}
