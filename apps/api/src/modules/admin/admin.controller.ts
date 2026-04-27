import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { SuperAdminGuard } from '../../common/guards';
import { SuperAdmin, CurrentUser } from '../../common/decorators';
import { AdminService } from './admin.service';
import { PaginationDto } from './dto/pagination.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin')
@UseGuards(SuperAdminGuard)
@SuperAdmin()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get admin dashboard stats' })
  getStats() {
    return this.adminService.getStats();
  }

  // === Tenants ===

  @Get('tenants')
  @ApiOperation({ summary: 'List all tenants (paginated)' })
  findAllTenants(@Query() query: PaginationDto) {
    return this.adminService.findAllTenants(query);
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Get tenant by ID' })
  findTenantById(@Param('id') id: string) {
    return this.adminService.findTenantById(id);
  }

  @Patch('tenants/:id')
  @ApiOperation({ summary: 'Update tenant' })
  updateTenant(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser('sub') adminUserId: string,
  ) {
    return this.adminService.updateTenant(id, dto, adminUserId);
  }

  @Delete('tenants/:id')
  @ApiOperation({ summary: 'Delete tenant' })
  deleteTenant(
    @Param('id') id: string,
    @CurrentUser('sub') adminUserId: string,
  ) {
    return this.adminService.deleteTenant(id, adminUserId);
  }

  // === Users ===

  @Get('users')
  @ApiOperation({ summary: 'List all users (paginated)' })
  findAllUsers(@Query() query: PaginationDto) {
    return this.adminService.findAllUsers(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by ID' })
  findUserById(@Param('id') id: string) {
    return this.adminService.findUserById(id);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update user' })
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('sub') adminUserId: string,
  ) {
    return this.adminService.updateUser(id, dto, adminUserId);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete user' })
  deleteUser(
    @Param('id') id: string,
    @CurrentUser('sub') adminUserId: string,
  ) {
    return this.adminService.deleteUser(id, adminUserId);
  }
}
