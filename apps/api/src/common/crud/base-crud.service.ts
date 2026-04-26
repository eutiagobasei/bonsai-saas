import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/**
 * Filter options for findAll queries
 */
export interface FilterOptions {
  includeInactive?: boolean;
  [key: string]: unknown;
}

/**
 * Abstract base class for CRUD services
 *
 * Provides standard CRUD operations with multi-tenancy support.
 * Override validation hooks for custom business logic.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class SupplyCategoriesService extends BaseCrudService<
 *   SupplyCategory,
 *   CreateSupplyCategoryDto,
 *   UpdateSupplyCategoryDto
 * > {
 *   protected readonly modelName = 'supplyCategory';
 *
 *   // Optional: override for custom validation
 *   protected async validateCreate(tenantId: string, dto: CreateSupplyCategoryDto): Promise<void> {
 *     await this.checkUniqueName(tenantId, dto.name);
 *   }
 * }
 * ```
 */
@Injectable()
export abstract class BaseCrudService<
  TEntity,
  TCreateDto,
  TUpdateDto extends { isActive?: boolean } = TCreateDto & { isActive?: boolean },
> {
  /**
   * The Prisma model name (e.g., 'supplyCategory', 'supply')
   */
  protected abstract readonly modelName: string;

  /**
   * Optional: includes for findAll query
   */
  protected readonly findAllIncludes?: Record<string, unknown>;

  /**
   * Optional: includes for findById query
   */
  protected readonly findByIdIncludes?: Record<string, unknown>;

  /**
   * Optional: default order for findAll
   */
  protected readonly defaultOrderBy?: Record<string, 'asc' | 'desc'>;

  /**
   * Optional: unique field for duplicate checking (e.g., 'name')
   */
  protected readonly uniqueField?: string;

  constructor(protected readonly prisma: PrismaService) {}

  /**
   * Create a new entity
   */
  async create(tenantId: string, dto: TCreateDto): Promise<TEntity> {
    await this.validateCreate(tenantId, dto);

    // Check for duplicates if uniqueField is defined
    if (this.uniqueField) {
      await this.checkUnique(tenantId, (dto as Record<string, unknown>)[this.uniqueField] as string);
    }

    return this.getModel().create({
      data: {
        tenantId,
        ...dto,
      },
      include: this.findByIdIncludes,
    });
  }

  /**
   * Find all entities for a tenant
   */
  async findAll(tenantId: string, options?: FilterOptions): Promise<TEntity[]> {
    const where: Record<string, unknown> = { tenantId };

    if (!options?.includeInactive) {
      where.isActive = true;
    }

    // Add additional filters from options
    if (options) {
      const { includeInactive, ...otherFilters } = options;
      Object.entries(otherFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          where[key] = value;
        }
      });
    }

    return this.getModel().findMany({
      where,
      orderBy: this.defaultOrderBy || { createdAt: 'desc' },
      include: this.findAllIncludes,
    });
  }

  /**
   * Find entity by ID
   */
  async findById(tenantId: string, id: string): Promise<TEntity> {
    const entity = await this.getModel().findFirst({
      where: { id, tenantId },
      include: this.findByIdIncludes,
    });

    if (!entity) {
      throw new NotFoundException(`${this.modelName} not found`);
    }

    return entity;
  }

  /**
   * Update an entity
   */
  async update(tenantId: string, id: string, dto: TUpdateDto): Promise<TEntity> {
    const existing = await this.findById(tenantId, id);
    await this.validateUpdate(tenantId, id, dto, existing);

    // Check for duplicates if uniqueField is defined and value changed
    if (this.uniqueField) {
      const newValue = (dto as Record<string, unknown>)[this.uniqueField] as string | undefined;
      const existingValue = (existing as Record<string, unknown>)[this.uniqueField] as string;
      if (newValue && newValue !== existingValue) {
        await this.checkUnique(tenantId, newValue, id);
      }
    }

    return this.getModel().update({
      where: { id },
      data: dto,
      include: this.findByIdIncludes,
    });
  }

  /**
   * Delete an entity
   */
  async delete(tenantId: string, id: string): Promise<void> {
    await this.findById(tenantId, id);
    await this.validateDelete(tenantId, id);

    await this.getModel().delete({
      where: { id },
    });
  }

  /**
   * Hook for custom create validation
   * Override to add business rules
   */
  protected async validateCreate(
    _tenantId: string,
    _dto: TCreateDto,
  ): Promise<void> {
    // Override in subclass for custom validation
  }

  /**
   * Hook for custom update validation
   * Override to add business rules
   */
  protected async validateUpdate(
    _tenantId: string,
    _id: string,
    _dto: TUpdateDto,
    _existing: TEntity,
  ): Promise<void> {
    // Override in subclass for custom validation
  }

  /**
   * Hook for custom delete validation
   * Override to add business rules (e.g., check for related records)
   */
  protected async validateDelete(
    _tenantId: string,
    _id: string,
  ): Promise<void> {
    // Override in subclass for custom validation
  }

  /**
   * Check for unique constraint on a field
   */
  protected async checkUnique(
    tenantId: string,
    value: string,
    excludeId?: string,
  ): Promise<void> {
    if (!this.uniqueField || !value) return;

    const existing = await this.getModel().findFirst({
      where: {
        tenantId,
        [this.uniqueField]: value,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (existing) {
      throw new ConflictException(
        `${this.modelName} with ${this.uniqueField} "${value}" already exists`,
      );
    }
  }

  /**
   * Get the Prisma model delegate
   */
  private getModel() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.prisma as any)[this.modelName];
  }
}
