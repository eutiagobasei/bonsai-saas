# My-SaaS Framework

Multi-tenant SaaS framework with NestJS (backend) and Next.js (frontend).

## Quick Start

```bash
npm run setup        # First time setup
npm run docker:up    # Start PostgreSQL + Redis
npm run db:migrate   # Run migrations
npm run dev          # Start dev servers (API :3000, Web :3001)
```

## Architecture

```
my-saas/
├── apps/
│   ├── api/         # NestJS backend (port 3000)
│   └── web/         # Next.js frontend (port 3001)
├── wiki/            # Knowledge base (Claude maintains)
└── raw/             # Source documents (user maintains)
```

## Code Patterns

### Frontend: useCrudPage Hook

For CRUD pages, use the `useCrudPage` hook:

```tsx
const crud = useCrudPage({
  api: supplyCategoryApi,
  entityName: 'categoria',
  defaultFormData: { name: '', description: '', color: '#3B82F6' },
});
```

### Backend: BaseCrudService

For CRUD services, extend `BaseCrudService`:

```typescript
@Injectable()
export class SupplyCategoriesService extends BaseCrudService<
  SupplyCategory,
  CreateSupplyCategoryDto,
  UpdateSupplyCategoryDto
> {
  protected readonly modelName = 'supplyCategory';
}
```

### API Factory

Create API clients with `createCrudApi`:

```typescript
export const supplyCategoryApi = createCrudApi<SupplyCategory>('/supply-categories');
```

## Key Conventions

| Area | Convention |
|------|------------|
| Icons | Import from `@/components/icons` |
| API calls | Use typed API factories in `@/lib/api` |
| Forms | Use `useCrudPage` hook for CRUD pages |
| Services | Extend `BaseCrudService` for CRUD operations |
| Validation | Use class-validator DTOs in backend |
| Styling | Tailwind CSS with `cn()` utility |

## File Structure Conventions

### Frontend Page (CRUD)
```
apps/web/src/app/(dashboard)/[resource]/page.tsx  # ~80-120 lines
```

### Backend Module
```
apps/api/src/modules/[resource]/
├── [resource].module.ts
├── [resource].controller.ts
├── [resource].service.ts        # Extends BaseCrudService (~30-40 lines)
└── dto/
    ├── create-[resource].dto.ts
    └── update-[resource].dto.ts
```

## Database

- **ORM**: Prisma
- **Multi-tenancy**: Row Level Security (RLS) with `tenantId`
- **Migrations**: `npm run db:migrate`

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all dev servers |
| `npm run build` | Build all apps |
| `npm run type-check` | TypeScript validation |
| `npm run lint` | ESLint validation |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:studio` | Open Prisma Studio |

## Wiki Structure

- `/wiki/index.md` - Knowledge catalog
- `/wiki/conceitos/` - Reusable patterns and concepts
- `/wiki/decisoes/` - Architecture decisions
- `/wiki/arquitetura/` - System architecture docs
- `/raw/` - Source documents for ingestion

## Creating New Features

### CRUD Resource Checklist

1. **Backend**:
   - [ ] Create DTOs (`create-*.dto.ts`, `update-*.dto.ts`)
   - [ ] Create service extending `BaseCrudService`
   - [ ] Create controller with standard CRUD endpoints
   - [ ] Create module and import in `AppModule`

2. **Frontend**:
   - [ ] Add types and API client to `@/lib/api`
   - [ ] Create page using `useCrudPage` hook
   - [ ] Add route to sidebar navigation

3. **Database**:
   - [ ] Add Prisma model with `tenantId`
   - [ ] Run migration

### Custom Logic

Override hooks in `BaseCrudService` for custom validation:

```typescript
protected async validateCreate(tenantId: string, dto: CreateDto): Promise<void> {
  // Custom validation
}

protected async validateUpdate(tenantId: string, id: string, dto: UpdateDto): Promise<void> {
  // Custom validation
}
```
