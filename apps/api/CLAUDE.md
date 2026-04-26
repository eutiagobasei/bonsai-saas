# My-SaaS API

NestJS backend with Prisma ORM and multi-tenant architecture.

## Creating New CRUD Resource

### 1. Create Module Structure

```
src/modules/{resource}/
├── {resource}.module.ts
├── {resource}.controller.ts
├── {resource}.service.ts
└── dto/
    ├── create-{resource}.dto.ts
    └── update-{resource}.dto.ts
```

### 2. Create DTOs

```typescript
// create-{resource}.dto.ts
import { IsString, IsOptional } from 'class-validator';

export class CreateResourceDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

// update-{resource}.dto.ts
import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';
import { CreateResourceDto } from './create-{resource}.dto';

export class UpdateResourceDto extends PartialType(CreateResourceDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

### 3. Create Service (extends BaseCrudService)

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { BaseCrudService } from '../../common/crud';
import { Resource } from '@prisma/client';
import { CreateResourceDto } from './dto/create-{resource}.dto';
import { UpdateResourceDto } from './dto/update-{resource}.dto';

@Injectable()
export class ResourceService extends BaseCrudService<
  Resource,
  CreateResourceDto,
  UpdateResourceDto
> {
  protected readonly modelName = 'resource';
  protected readonly uniqueField = 'name'; // Optional: for duplicate checking
  protected readonly defaultOrderBy = { name: 'asc' as const };

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  // Optional: override validation hooks
  protected async validateDelete(tenantId: string, id: string): Promise<void> {
    // Custom delete validation
  }
}
```

### 4. Create Controller

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ResourceService } from './{resource}.service';
import { CurrentTenant } from '../../common/decorators';
import { TenantGuard } from '../../common/guards';

@ApiTags('{resource}')
@ApiBearerAuth('JWT-auth')
@Controller('{resource}')
@UseGuards(TenantGuard)
export class ResourceController {
  constructor(private readonly service: ResourceService) {}

  @Post()
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateResourceDto) {
    return this.service.create(tenantId, dto);
  }

  @Get()
  findAll(@CurrentTenant() tenantId: string, @Query('includeInactive') includeInactive?: string) {
    return this.service.findAll(tenantId, { includeInactive: includeInactive === 'true' });
  }

  @Get(':id')
  findById(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findById(tenantId, id);
  }

  @Patch(':id')
  update(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: UpdateResourceDto) {
    return this.service.update(tenantId, id, dto);
  }

  @Delete(':id')
  delete(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.delete(tenantId, id);
  }
}
```

### 5. Register Module

Add to `app.module.ts` imports array.

## BaseCrudService Hooks

Override these methods for custom logic:

- `validateCreate(tenantId, dto)` - Pre-create validation
- `validateUpdate(tenantId, id, dto, existing)` - Pre-update validation
- `validateDelete(tenantId, id)` - Pre-delete validation

## Key Imports

```typescript
import { BaseCrudService, FilterOptions } from '../../common/crud';
import { PrismaService } from '../../common/database/prisma.service';
import { CurrentTenant, CurrentUser } from '../../common/decorators';
import { TenantGuard, RolesGuard } from '../../common/guards';
```
