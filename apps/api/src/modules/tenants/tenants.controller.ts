import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { TenantRole } from '@prisma/client';

import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTenantDto,
  ) {
    return this.tenantsService.create(dto, user.sub);
  }

  @Get('current')
  @UseGuards(TenantGuard)
  async getCurrent(@CurrentTenant() tenantId: string) {
    return this.tenantsService.findById(tenantId);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.tenantsService.findById(id);
  }

  @Patch('current')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles(TenantRole.ADMIN, TenantRole.OWNER)
  async update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() data: { name?: string },
  ) {
    return this.tenantsService.update(tenantId, user.sub, data);
  }

  @Get('current/members')
  @UseGuards(TenantGuard)
  async getMembers(@CurrentTenant() tenantId: string) {
    return this.tenantsService.getMembers(tenantId);
  }

  @Post('current/members')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles(TenantRole.ADMIN, TenantRole.OWNER)
  async inviteMember(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: InviteMemberDto,
  ) {
    return this.tenantsService.inviteMember(tenantId, user.sub, dto);
  }

  @Patch('current/members/:memberId/role')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles(TenantRole.OWNER)
  async updateMemberRole(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.tenantsService.updateMemberRole(
      tenantId,
      user.sub,
      memberId,
      dto.role,
    );
  }

  @Delete('current/members/:memberId')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles(TenantRole.ADMIN, TenantRole.OWNER)
  async removeMember(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param('memberId') memberId: string,
  ) {
    return this.tenantsService.removeMember(tenantId, user.sub, memberId);
  }
}
