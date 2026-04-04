import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../common/database/prisma.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SwitchTenantDto } from './dto/switch-tenant.dto';

export interface TokenPayload {
  sub: string;
  email: string;
  tenantId?: string;
  role?: string;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

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

    return this.generateAuthResponse(user, tenant.id);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
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
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const memberships = user.tenantMemberships;

    // If user has exactly one tenant, log them in directly
    if (memberships.length === 1) {
      return this.generateAuthResponse(
        user,
        memberships[0].tenantId,
        memberships[0].role,
      );
    }

    // If user has multiple tenants, return list for selection
    // (no tenantId in token yet)
    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      tenants: memberships.map((m: { tenant: { id: string; name: string }; role: string }) => ({
        id: m.tenant.id,
        name: m.tenant.name,
        role: m.role,
      })),
    };
  }

  async switchTenant(userId: string, dto: SwitchTenantDto): Promise<AuthResponse> {
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
    return this.generateAuthResponse(user, membership.tenantId, membership.role);
  }

  async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Revoke the old token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    return this.generateAuthResponse(
      storedToken.user,
      storedToken.tenantId ?? undefined,
    );
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // Revoke specific token
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          token: refreshToken,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    } else {
      // Revoke all tokens for user
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }
  }

  private async generateAuthResponse(
    user: { id: string; email: string; name: string | null },
    tenantId?: string,
    role?: string,
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

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      ...(tenantId && { tenantId }),
      ...(tenantRole && { role: tenantRole }),
    };

    const tokens = await this.generateTokens(payload);

    // Store refresh token
    const refreshTokenExpiry = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );
    const expiresAt = this.calculateExpiry(refreshTokenExpiry);

    await this.prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        tenantId: tenantId ?? null,
        expiresAt,
      },
    });

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

  private async generateTokens(payload: TokenPayload) {
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

    return { accessToken, refreshToken };
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
