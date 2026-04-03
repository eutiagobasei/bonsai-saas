import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../../common/database/prisma.service';
import { TokenPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: TokenPayload): Promise<TokenPayload> {
    // Verify user still exists
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    // If tenant is specified, verify membership still exists
    if (payload.tenantId) {
      const membership = await this.prisma.tenantMember.findUnique({
        where: {
          userId_tenantId: {
            userId: payload.sub,
            tenantId: payload.tenantId,
          },
        },
      });

      if (!membership) {
        throw new UnauthorizedException('No longer a member of this tenant');
      }

      // Update role in payload if it has changed
      if (membership.role !== payload.role) {
        payload.role = membership.role;
      }
    }

    return payload;
  }
}
