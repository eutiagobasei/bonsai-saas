# CRUD Abstractions

Patterns to reduce boilerplate in CRUD operations.

## Frontend: useCrudPage Hook

Located at: `apps/web/src/hooks/use-crud-page.ts`

Encapsulates all state management for CRUD pages:
- Loading states, errors, modal visibility
- Form data management
- Create, edit, delete operations
- Auto-fetch on mount

### Usage

```tsx
const crud = useCrudPage({
  api: supplyCategoryApi,
  entityName: 'categoria',
  defaultFormData: { name: '', description: '' },
});

// Access states
crud.items        // T[]
crud.isLoading    // boolean
crud.error        // string | null
crud.isModalOpen  // boolean
crud.editingItem  // T | null
crud.formData     // FormData
crud.deleteConfirm // T | null

// Actions
crud.openCreateModal()
crud.openEditModal(item)
crud.closeModal()
crud.setFormData(data)
crud.handleSubmit(e)
crud.handleDelete()
crud.confirmDelete(item)
crud.cancelDelete()
crud.toggleActive(item)
crud.refresh()
```

## Backend: BaseCrudService

Located at: `apps/api/src/common/crud/base-crud.service.ts`

Abstract class providing standard CRUD operations:
- `create(tenantId, dto)`
- `findAll(tenantId, options)`
- `findById(tenantId, id)`
- `update(tenantId, id, dto)`
- `delete(tenantId, id)`

### Usage

```typescript
@Injectable()
export class MyService extends BaseCrudService<Entity, CreateDto, UpdateDto> {
  protected readonly modelName = 'myModel';

  // Optional: override hooks for custom validation
  protected async validateCreate(tenantId: string, dto: CreateDto): Promise<void> {
    // Check for duplicates, validate relationships, etc.
  }
}
```

## API Factory

Located at: `apps/web/src/lib/api/factory.ts`

Creates typed API clients:

```typescript
export const myApi = createCrudApi<MyEntity>('/my-endpoint');

// Provides:
myApi.getAll(options?)
myApi.getById(id)
myApi.create(data)
myApi.update(id, data)
myApi.delete(id)
```

## Reduction Metrics

| Component | Before | After | Reduction |
|-----------|--------|-------|-----------|
| CRUD Page | 400-480 lines | 80-120 lines | ~75% |
| CRUD Service | 120-150 lines | 25-40 lines | ~70% |
| API Client | 10-15 lines | 2-3 lines | ~80% |
