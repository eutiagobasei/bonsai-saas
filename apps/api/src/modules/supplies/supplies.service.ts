import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { BaseCrudService } from '../../common/crud';
import { CreateSupplyDto } from './dto/create-supply.dto';
import { UpdateSupplyDto } from './dto/update-supply.dto';
import { Supply } from '@prisma/client';

@Injectable()
export class SuppliesService extends BaseCrudService<
  Supply,
  CreateSupplyDto,
  UpdateSupplyDto
> {
  protected readonly modelName = 'supply';
  protected readonly uniqueField = 'name';
  protected readonly defaultOrderBy = { name: 'asc' as const };
  protected readonly findAllIncludes = { category: true };
  protected readonly findByIdIncludes = { category: true };

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Validate that category exists and belongs to tenant
   */
  protected async validateCreate(
    tenantId: string,
    dto: CreateSupplyDto,
  ): Promise<void> {
    await this.validateCategory(tenantId, dto.categoryId);
  }

  /**
   * Validate category on update if changed
   */
  protected async validateUpdate(
    tenantId: string,
    _id: string,
    dto: UpdateSupplyDto,
    existing: Supply,
  ): Promise<void> {
    if (dto.categoryId && dto.categoryId !== existing.categoryId) {
      await this.validateCategory(tenantId, dto.categoryId);
    }
  }

  /**
   * Check that category exists and belongs to tenant
   */
  private async validateCategory(
    tenantId: string,
    categoryId: string,
  ): Promise<void> {
    const category = await this.prisma.supplyCategory.findFirst({
      where: { id: categoryId, tenantId },
    });

    if (!category) {
      throw new BadRequestException('Invalid category');
    }
  }
}
