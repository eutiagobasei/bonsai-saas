import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';
import { AuditService } from '../../common/security';
import { PaginationDto, PaginatedResult } from './dto/pagination.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get dashboard stats for super admin
   */
  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalTenants,
      totalUsers,
      tenantsThisMonth,
      usersThisMonth,
      activeTenants,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.user.count(),
      this.prisma.tenant.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      this.prisma.tenant.count({
        where: { status: 'ACTIVE' },
      }),
    ]);

    return {
      totalTenants,
      totalUsers,
      tenantsThisMonth,
      usersThisMonth,
      activeTenants,
    };
  }

  /**
   * List all tenants with pagination
   */
  async findAllTenants(query: PaginationDto): Promise<PaginatedResult<unknown>> {
    const { page = 1, limit = 20, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TenantWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { members: true },
          },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get tenant by ID
   */
  async findTenantById(id: string) {
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
        _count: {
          select: { members: true },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  /**
   * Update tenant
   */
  async updateTenant(id: string, dto: UpdateTenantDto, adminUserId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: dto,
    });

    await this.auditService.log({
      userId: adminUserId,
      action: 'ADMIN_UPDATE',
      entity: 'tenant',
      entityId: id,
      oldData: tenant,
      newData: updated,
    });

    return updated;
  }

  /**
   * Delete tenant
   */
  async deleteTenant(id: string, adminUserId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    await this.prisma.tenant.delete({
      where: { id },
    });

    await this.auditService.log({
      userId: adminUserId,
      action: 'ADMIN_DELETE',
      entity: 'tenant',
      entityId: id,
      oldData: tenant,
    });

    return { success: true };
  }

  /**
   * List all users with pagination
   */
  async findAllUsers(query: PaginationDto): Promise<PaginatedResult<unknown>> {
    const { page = 1, limit = 20, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          isSuperAdmin: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { tenantMemberships: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user by ID
   */
  async findUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
        createdAt: true,
        updatedAt: true,
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

  /**
   * Update user
   */
  async updateUser(id: string, dto: UpdateUserDto, adminUserId: string) {
    // Prevent admin from removing their own super admin status
    if (id === adminUserId && dto.isSuperAdmin === false) {
      throw new ForbiddenException('Cannot remove your own super admin status');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.auditService.log({
      userId: adminUserId,
      action: 'ADMIN_UPDATE',
      entity: 'user',
      entityId: id,
      oldData: user,
      newData: updated,
    });

    return updated;
  }

  /**
   * Delete user
   */
  async deleteUser(id: string, adminUserId: string) {
    // Prevent admin from deleting themselves
    if (id === adminUserId) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent deleting other super admins (unless you explicitly allow it)
    if (user.isSuperAdmin) {
      throw new ForbiddenException('Cannot delete a super admin');
    }

    await this.prisma.user.delete({
      where: { id },
    });

    await this.auditService.log({
      userId: adminUserId,
      action: 'ADMIN_DELETE',
      entity: 'user',
      entityId: id,
      oldData: user,
    });

    return { success: true };
  }
}
