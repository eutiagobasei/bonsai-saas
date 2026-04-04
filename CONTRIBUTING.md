# Contributing to My-SaaS Framework

Thank you for your interest in contributing to the My-SaaS Framework! This document provides guidelines for extending and contributing to the project.

## Table of Contents

- [Project Philosophy](#project-philosophy)
- [Development Setup](#development-setup)
- [Architecture Overview](#architecture-overview)
- [Extension Guide](#extension-guide)
- [Code Standards](#code-standards)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)

## Project Philosophy

My-SaaS is a **framework**, not a finished application. Our goals are:

1. **Provide solid foundations** - Authentication, authorization, multi-tenancy
2. **Be extensible** - Easy to add new features without modifying core
3. **Follow best practices** - Security, performance, maintainability
4. **Stay minimal** - Only include what most SaaS apps need

### What We Include

- Core authentication and authorization
- Multi-tenant isolation
- Common guards, decorators, interceptors
- Database patterns and migrations
- CI/CD and deployment infrastructure

### What Users Implement

- Business-specific features
- Email/notification providers
- Payment integrations
- Domain-specific logic

## Development Setup

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm 10+
- Git

### Getting Started

```bash
# Clone the repository
git clone https://github.com/your-username/my-saas.git
cd my-saas

# Install dependencies
npm install

# Start infrastructure
npm run docker:up

# Run migrations
npm run db:migrate

# Start development
npm run dev
```

### Useful Commands

```bash
# Run tests
npm run test

# Run tests with coverage
npm run test:cov

# Lint code
npm run lint

# Type check
npm run type-check

# Build all
npm run build
```

## Architecture Overview

### Backend (NestJS)

```
apps/api/src/
├── common/              # Shared infrastructure
│   ├── guards/          # Authentication & authorization
│   ├── decorators/      # Custom decorators
│   ├── interceptors/    # Request/response interceptors
│   ├── database/        # Prisma services
│   ├── cache/           # Redis caching
│   ├── logging/         # Structured logging
│   └── audit/           # Audit logging
│
└── modules/             # Feature modules
    ├── auth/            # Authentication
    ├── users/           # User management
    ├── tenants/         # Tenant management
    └── health/          # Health checks
```

### Frontend (Next.js)

```
apps/web/src/
├── app/                 # App Router pages
├── components/          # React components
├── hooks/               # Custom hooks
└── lib/                 # Utilities & API client
```

### Key Patterns

1. **Guards** - Control access at controller/method level
2. **Decorators** - Extract data from requests (@CurrentUser, @CurrentTenant)
3. **Interceptors** - Transform requests/responses (TenantInterceptor)
4. **Services** - Business logic and data access
5. **DTOs** - Input validation and transformation

## Extension Guide

### Adding a New Module

```bash
# 1. Generate module structure
cd apps/api
npx nest generate module modules/products
npx nest generate controller modules/products
npx nest generate service modules/products

# 2. Create directory structure
mkdir -p src/modules/products/dto
```

### Module Template

```typescript
// products.module.ts
import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { DatabaseModule } from '../../common/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
```

### Controller Template

```typescript
// products.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('products')
@ApiBearerAuth('JWT-auth')
@Controller('products')
@UseGuards(TenantGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@CurrentTenant() tenantId: string) {
    return this.productsService.findByTenant(tenantId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'OWNER')
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.create(tenantId, user.sub, dto);
  }
}
```

### Service Template

```typescript
// products.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenant(tenantId: string) {
    return this.prisma.product.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, tenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async create(tenantId: string, userId: string, dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        ...dto,
        tenantId,
        createdBy: userId,
      },
    });
  }
}
```

### DTO Template

```typescript
// dto/create-product.dto.ts
import { IsString, IsNumber, IsOptional, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ description: 'Product name', example: 'Premium Plan' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Product description' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ description: 'Price in cents', example: 9900 })
  @IsNumber()
  @Min(0)
  price: number;
}
```

### Adding Database Models

```prisma
// prisma/schema.prisma

model Product {
  id          String   @id @default(cuid())
  tenantId    String   @map("tenant_id")
  name        String
  description String?
  price       Int      // Store in cents
  createdBy   String   @map("created_by")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@index([tenantId])
  @@map("products")
}
```

### Adding a Custom Guard

```typescript
// common/guards/subscription.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true, status: true },
    });

    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new ForbiddenException('Tenant is not active');
    }

    // Add plan-specific logic here
    return true;
  }
}
```

### Adding a Custom Decorator

```typescript
// common/decorators/require-plan.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PLAN_KEY = 'requiredPlan';
export const RequirePlan = (...plans: string[]) =>
  SetMetadata(REQUIRED_PLAN_KEY, plans);

// Usage:
// @RequirePlan('PRO', 'ENTERPRISE')
// @Get('advanced-feature')
// advancedFeature() { ... }
```

## Code Standards

### TypeScript

- Use strict mode
- Prefer interfaces over types for object shapes
- Use `readonly` for immutable properties
- Avoid `any` - use `unknown` if type is uncertain

### NestJS

- One module per feature
- Keep controllers thin - logic in services
- Use DTOs for all inputs
- Document with Swagger decorators
- Handle errors with NestJS exceptions

### Naming Conventions

```typescript
// Files
user.service.ts          // Services
user.controller.ts       // Controllers
create-user.dto.ts       // DTOs
user.guard.ts            // Guards

// Classes
UserService              // PascalCase
CreateUserDto

// Methods/Variables
findById                 // camelCase
createUser

// Constants
MAX_LOGIN_ATTEMPTS       // SCREAMING_SNAKE_CASE
```

### File Organization

```typescript
// Order of imports
import { ... } from '@nestjs/common';     // 1. NestJS
import { ... } from '@nestjs/swagger';    // 2. NestJS ecosystem
import { ... } from 'class-validator';    // 3. External packages
import { ... } from '../../common/...';   // 4. Internal common
import { ... } from './dto/...';          // 5. Local files
```

## Testing Requirements

### Minimum Coverage

- New modules: 80% coverage
- Bug fixes: Include regression test
- Security fixes: Include security test

### Test Structure

```typescript
// products.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../../common/database/prisma.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: {
            product: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prisma = module.get(PrismaService);
  });

  describe('findByTenant', () => {
    it('should return products for tenant', async () => {
      const mockProducts = [{ id: '1', name: 'Test' }];
      prisma.product.findMany.mockResolvedValue(mockProducts);

      const result = await service.findByTenant('tenant-123');

      expect(result).toEqual(mockProducts);
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
```

## Pull Request Process

### Before Submitting

1. Run all tests: `npm run test`
2. Run linting: `npm run lint`
3. Update documentation if needed
4. Add CHANGELOG entry

### PR Checklist

- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] No console.log statements
- [ ] No hardcoded secrets
- [ ] Types are properly defined

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add products module
fix: resolve tenant isolation bug
docs: update extension guide
test: add products service tests
refactor: extract validation logic
```

### Review Process

1. Create PR against `develop` branch
2. Ensure CI passes
3. Request review from maintainers
4. Address feedback
5. Squash and merge

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Check existing issues before creating new ones

Thank you for contributing!
