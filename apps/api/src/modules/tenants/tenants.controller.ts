import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

import { TenantsService } from './tenants.service';
import { TenantRole } from '../../common/decorators/roles.decorator';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantRole as PrismaTenantRole } from '@prisma/client';

@ApiTags('tenants')
@ApiBearerAuth('JWT-auth')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tenant' })
  @ApiResponse({ status: 201, description: 'Tenant created successfully' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTenantDto,
  ) {
    return this.tenantsService.create(dto, user.sub);
  }

  @Get('current')
  @UseGuards(TenantGuard)
  @ApiOperation({ summary: 'Get current tenant details' })
  @ApiResponse({ status: 200, description: 'Current tenant details' })
  @ApiResponse({ status: 403, description: 'No tenant in context' })
  async getCurrent(@CurrentTenant() tenantId: string) {
    return this.tenantsService.findById(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiParam({ name: 'id', description: 'Tenant ID' })
  @ApiResponse({ status: 200, description: 'Tenant details' })
  @ApiResponse({ status: 403, description: 'Not a member of the tenant' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async findById(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.tenantsService.findByIdForUser(id, user.sub);
  }

  @Patch('current')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles(TenantRole.ADMIN, TenantRole.OWNER)
  @ApiOperation({ summary: 'Update current tenant (Admin/Owner only)' })
  @ApiResponse({ status: 200, description: 'Tenant updated successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() data: { name?: string },
  ) {
    return this.tenantsService.update(tenantId, user.sub, data);
  }

  @Get('current/members')
  @UseGuards(TenantGuard)
  @ApiOperation({ summary: 'List all members of current tenant' })
  @ApiResponse({ status: 200, description: 'List of tenant members' })
  async getMembers(@CurrentTenant() tenantId: string) {
    return this.tenantsService.getMembers(tenantId);
  }

  @Post('current/members')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles(TenantRole.ADMIN, TenantRole.OWNER)
  @ApiOperation({ summary: 'Invite a member to the tenant (Admin/Owner only)' })
  @ApiResponse({ status: 201, description: 'Member invited successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'User is already a member' })
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
  @ApiOperation({ summary: 'Update member role (Owner only)' })
  @ApiParam({ name: 'memberId', description: 'User ID of the member' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({ status: 403, description: 'Only owner can change roles' })
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(TenantGuard, RolesGuard)
  @Roles(TenantRole.ADMIN, TenantRole.OWNER)
  @ApiOperation({ summary: 'Remove a member from tenant (Admin/Owner only)' })
  @ApiParam({ name: 'memberId', description: 'User ID of the member to remove' })
  @ApiResponse({ status: 204, description: 'Member removed successfully' })
  @ApiResponse({ status: 403, description: 'Cannot remove owner or self' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async removeMember(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param('memberId') memberId: string,
  ) {
    return this.tenantsService.removeMember(tenantId, user.sub, memberId);
  }
}
