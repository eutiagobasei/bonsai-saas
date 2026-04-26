import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
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
  ApiQuery,
} from '@nestjs/swagger';

import { SuppliesService } from './supplies.service';
import { CreateSupplyDto } from './dto/create-supply.dto';
import { UpdateSupplyDto } from './dto/update-supply.dto';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';

@ApiTags('supplies')
@ApiBearerAuth('JWT-auth')
@Controller('supplies')
@UseGuards(TenantGuard)
export class SuppliesController {
  constructor(private readonly service: SuppliesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new supply' })
  @ApiResponse({ status: 201, description: 'Supply created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid category' })
  @ApiResponse({ status: 409, description: 'Supply name already exists' })
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateSupplyDto,
  ) {
    return this.service.create(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all supplies' })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    description: 'Filter by category ID',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Include inactive supplies',
  })
  @ApiResponse({ status: 200, description: 'List of supplies' })
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query('categoryId') categoryId?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.service.findAll(tenantId, {
      categoryId,
      includeInactive: includeInactive === 'true',
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a supply by ID' })
  @ApiParam({ name: 'id', description: 'Supply ID' })
  @ApiResponse({ status: 200, description: 'Supply details' })
  @ApiResponse({ status: 404, description: 'Supply not found' })
  async findById(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.findById(tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a supply' })
  @ApiParam({ name: 'id', description: 'Supply ID' })
  @ApiResponse({ status: 200, description: 'Supply updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid category' })
  @ApiResponse({ status: 404, description: 'Supply not found' })
  @ApiResponse({ status: 409, description: 'Supply name already exists' })
  async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSupplyDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a supply' })
  @ApiParam({ name: 'id', description: 'Supply ID' })
  @ApiResponse({ status: 204, description: 'Supply deleted successfully' })
  @ApiResponse({ status: 404, description: 'Supply not found' })
  async delete(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    await this.service.delete(tenantId, id);
  }
}
