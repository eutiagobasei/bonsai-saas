import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { TenantRole } from '@prisma/client';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTenantDto, ownerId: string) {
    // Generate unique slug
    const baseSlug = this.generateSlug(dto.name);
    let slug = baseSlug;
    let counter = 1;

    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Generate schema name
    const schemaName = `tenant_${slug.replace(/-/g, '_')}`;

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug,
        schema: schemaName,
        members: {
          create: {
            userId: ownerId,
            role: TenantRole.OWNER,
          },
        },
      },
      include: {
        members: {
          where: { userId: ownerId },
        },
      },
    });

    // Create tenant schema in database
    await this.prisma.createTenantSchema(schemaName);

    return tenant;
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async update(id: string, userId: string, data: { name?: string }) {
    await this.verifyOwnerOrAdmin(id, userId);

    return this.prisma.tenant.update({
      where: { id },
      data,
    });
  }

  async inviteMember(tenantId: string, inviterId: string, dto: InviteMemberDto) {
    await this.verifyOwnerOrAdmin(tenantId, inviterId);

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new NotFoundException('User not found with this email');
    }

    // Check if already a member
    const existingMembership = await this.prisma.tenantMember.findUnique({
      where: {
        userId_tenantId: {
          userId: user.id,
          tenantId,
        },
      },
    });

    if (existingMembership) {
      throw new ConflictException('User is already a member of this tenant');
    }

    return this.prisma.tenantMember.create({
      data: {
        userId: user.id,
        tenantId,
        role: dto.role ?? TenantRole.MEMBER,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  async removeMember(tenantId: string, removerId: string, memberId: string) {
    await this.verifyOwnerOrAdmin(tenantId, removerId);

    // Cannot remove self
    if (removerId === memberId) {
      throw new ForbiddenException('Cannot remove yourself from tenant');
    }

    const membership = await this.prisma.tenantMember.findUnique({
      where: {
        userId_tenantId: {
          userId: memberId,
          tenantId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Member not found in this tenant');
    }

    // Cannot remove owner
    if (membership.role === TenantRole.OWNER) {
      throw new ForbiddenException('Cannot remove tenant owner');
    }

    await this.prisma.tenantMember.delete({
      where: {
        userId_tenantId: {
          userId: memberId,
          tenantId,
        },
      },
    });
  }

  async updateMemberRole(
    tenantId: string,
    updaterId: string,
    memberId: string,
    role: TenantRole,
  ) {
    const updaterMembership = await this.verifyOwnerOrAdmin(tenantId, updaterId);

    // Only owner can change roles
    if (updaterMembership.role !== TenantRole.OWNER) {
      throw new ForbiddenException('Only the owner can change member roles');
    }

    // Cannot change own role
    if (updaterId === memberId) {
      throw new ForbiddenException('Cannot change your own role');
    }

    // Cannot assign owner role
    if (role === TenantRole.OWNER) {
      throw new ForbiddenException('Cannot assign owner role');
    }

    return this.prisma.tenantMember.update({
      where: {
        userId_tenantId: {
          userId: memberId,
          tenantId,
        },
      },
      data: { role },
    });
  }

  async getMembers(tenantId: string) {
    return this.prisma.tenantMember.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  private async verifyOwnerOrAdmin(tenantId: string, userId: string) {
    const membership = await this.prisma.tenantMember.findUnique({
      where: {
        userId_tenantId: {
          userId,
          tenantId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Not a member of this tenant');
    }

    if (![TenantRole.OWNER, TenantRole.ADMIN].includes(membership.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return membership;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
