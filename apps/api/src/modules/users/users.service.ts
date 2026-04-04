import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { CacheService } from '../../common/cache/cache.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        tenantMemberships: {
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async getTenants(userId: string) {
    const memberships = await this.prisma.tenantMember.findMany({
      where: { userId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
          },
        },
      },
    });

    return memberships.map((m) => ({
      ...m.tenant,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  async updateProfile(userId: string, data: { name?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    // Invalidate JWT cache for this user
    await this.cache.invalidateUserJwt(userId);

    return user;
  }
}
