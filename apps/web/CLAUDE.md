# My-SaaS Web

Next.js 14 frontend with App Router and Tailwind CSS.

## Creating New CRUD Page

### 1. Add Types and API Client

In `src/lib/api.ts`:

```typescript
export interface Resource {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateResourceData {
  name: string;
  description?: string;
}

export interface UpdateResourceData {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export const resourceApi = {
  getAll: (options?: { includeInactive?: boolean }) => {
    const params = new URLSearchParams();
    if (options?.includeInactive) params.append('includeInactive', 'true');
    return api.get<Resource[]>(`/resources?${params.toString()}`);
  },
  getById: (id: string) => api.get<Resource>(`/resources/${id}`),
  create: (data: CreateResourceData) => api.post<Resource>('/resources', data),
  update: (id: string, data: UpdateResourceData) => api.patch<Resource>(`/resources/${id}`, data),
  delete: (id: string) => api.delete(`/resources/${id}`),
};
```

### 2. Create Page with useCrudPage

```tsx
'use client';

import { resourceApi, Resource, CreateResourceData } from '@/lib/api';
import { useCrudPage } from '@/hooks/use-crud-page';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { FolderIcon } from '@/components/icons';
import {
  CrudPageHeader,
  CrudEmptyState,
  CrudDeleteModal,
  CrudLoadingState,
  CrudErrorAlert,
} from '@/components/crud';

export default function ResourcePage() {
  const crud = useCrudPage<Resource, CreateResourceData>({
    api: resourceApi,
    entityName: 'recurso',
    defaultFormData: { name: '', description: '' },
    fetchOptions: { includeInactive: true },
  });

  if (crud.isLoading) return <CrudLoadingState />;

  return (
    <div className="space-y-6">
      <CrudPageHeader
        title="Recursos"
        description="Gerencie os recursos"
        createLabel="Novo Recurso"
        onCreateClick={crud.openCreateModal}
      />

      {crud.error && <CrudErrorAlert message={crud.error} />}

      {crud.items.length === 0 ? (
        <CrudEmptyState
          icon={<FolderIcon className="w-12 h-12" />}
          title="Nenhum recurso"
          description="Comece criando um novo recurso."
          createLabel="Novo Recurso"
          onCreateClick={crud.openCreateModal}
        />
      ) : (
        // Render items...
      )}

      <Modal
        isOpen={crud.isModalOpen}
        onClose={crud.closeModal}
        title={crud.editingItem ? 'Editar Recurso' : 'Novo Recurso'}
      >
        <form onSubmit={crud.handleSubmit} className="space-y-4">
          <Input
            label="Nome"
            value={crud.formData.name}
            onChange={(e) => crud.updateFormField('name', e.target.value)}
            required
          />
          {/* More fields... */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={crud.closeModal}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={crud.isSaving}>
              {crud.editingItem ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>

      <CrudDeleteModal
        isOpen={!!crud.deleteConfirm}
        onClose={crud.cancelDelete}
        onConfirm={crud.handleDelete}
        isDeleting={crud.isDeleting}
        entityName="o recurso"
        itemName={crud.deleteConfirm?.name}
      />
    </div>
  );
}
```

## useCrudPage API

### Options

```typescript
{
  api: CrudApiInterface,    // API client
  entityName: string,       // For error messages
  defaultFormData: FormData,// Initial form values
  fetchOptions?: object,    // Passed to api.getAll
  dependencies?: any[],     // Triggers refetch
}
```

### Returns

```typescript
{
  // State
  items: T[],
  isLoading: boolean,
  error: string | null,
  isModalOpen: boolean,
  editingItem: T | null,
  formData: FormData,
  isSaving: boolean,
  formError: string | null,
  deleteConfirm: T | null,
  isDeleting: boolean,

  // Actions
  openCreateModal: () => void,
  openEditModal: (item) => void,
  closeModal: () => void,
  updateFormField: (field, value) => void,
  handleSubmit: (e) => Promise<void>,
  confirmDelete: (item) => void,
  cancelDelete: () => void,
  handleDelete: () => Promise<void>,
  toggleActive: (item) => Promise<void>,
  refresh: () => Promise<void>,
}
```

## Key Imports

```typescript
import { useCrudPage } from '@/hooks/use-crud-page';
import { PlusIcon, EditIcon, TrashIcon, FolderIcon } from '@/components/icons';
import { CrudPageHeader, CrudEmptyState, CrudDeleteModal, CrudLoadingState, CrudErrorAlert } from '@/components/crud';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
```
