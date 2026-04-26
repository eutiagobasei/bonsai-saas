import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { BaseCrudService } from '../../common/crud';
import { CreateSupplyCategoryDto } from './dto/create-supply-category.dto';
import { UpdateSupplyCategoryDto } from './dto/update-supply-category.dto';
import { SupplyCategory } from '@prisma/client';

@Injectable()
export class SupplyCategoriesService extends BaseCrudService<
  SupplyCategory,
  CreateSupplyCategoryDto,
  UpdateSupplyCategoryDto
> {
  protected readonly modelName = 'supplyCategory';
  protected readonly uniqueField = 'name';
  protected readonly defaultOrderBy = { name: 'asc' as const };
  protected readonly findAllIncludes = {
    _count: { select: { supplies: true } },
  };
  protected readonly findByIdIncludes = {
    _count: { select: { supplies: true } },
  };

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Prevent deletion if category has supplies
   */
  protected async validateDelete(tenantId: string, id: string): Promise<void> {
    const suppliesCount = await this.prisma.supply.count({
      where: { categoryId: id },
    });

    if (suppliesCount > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${suppliesCount} supplies. Remove or reassign supplies first.`,
      );
    }
  }
}
