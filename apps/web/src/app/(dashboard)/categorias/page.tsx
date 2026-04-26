'use client';

import {
  supplyCategoryApi,
  SupplyCategory,
  CreateSupplyCategoryData,
} from '@/lib/api';
import { useCrudPage } from '@/hooks/use-crud-page';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { FolderIcon } from '@/components/icons';
import {
  CrudPageHeader,
  CrudEmptyState,
  CrudDeleteModal,
  CrudLoadingState,
  CrudErrorAlert,
} from '@/components/crud';
import { cn } from '@/lib/utils';

const DEFAULT_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6',
  '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280',
];

export default function CategoriasPage() {
  const crud = useCrudPage<SupplyCategory, CreateSupplyCategoryData>({
    api: supplyCategoryApi,
    entityName: 'categoria',
    defaultFormData: { name: '', description: '', color: DEFAULT_COLORS[0] },
    fetchOptions: { includeInactive: true },
  });

  if (crud.isLoading) return <CrudLoadingState />;

  return (
    <div className="space-y-6">
      <CrudPageHeader
        title="Categorias de Insumos"
        description="Gerencie as categorias para organizar seus insumos"
        createLabel="Nova Categoria"
        onCreateClick={crud.openCreateModal}
      />

      {crud.error && <CrudErrorAlert message={crud.error} />}

      {crud.items.length === 0 ? (
        <CrudEmptyState
          icon={<FolderIcon className="w-12 h-12" />}
          title="Nenhuma categoria"
          description="Comece criando uma nova categoria para seus insumos."
          createLabel="Nova Categoria"
          onCreateClick={crud.openCreateModal}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {crud.items.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onEdit={() => crud.openEditModal(category)}
              onDelete={() => crud.confirmDelete(category)}
              onToggleActive={() => crud.toggleActive(category)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={crud.isModalOpen}
        onClose={crud.closeModal}
        title={crud.editingItem ? 'Editar Categoria' : 'Nova Categoria'}
      >
        <form onSubmit={crud.handleSubmit} className="space-y-4">
          <Input
            label="Nome"
            id="name"
            value={crud.formData.name}
            onChange={(e) => crud.updateFormField('name', e.target.value)}
            placeholder="Ex: Carnes"
            required
          />
          <Input
            label="Descrição (opcional)"
            id="description"
            value={crud.formData.description || ''}
            onChange={(e) => crud.updateFormField('description', e.target.value)}
            placeholder="Ex: Carnes e derivados"
          />
          <ColorPicker
            colors={DEFAULT_COLORS}
            selected={crud.formData.color || DEFAULT_COLORS[0]}
            onChange={(color) => crud.updateFormField('color', color)}
          />
          {crud.formError && <p className="text-sm text-red-500">{crud.formError}</p>}
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

      {/* Delete Modal */}
      <CrudDeleteModal
        isOpen={!!crud.deleteConfirm}
        onClose={crud.cancelDelete}
        onConfirm={crud.handleDelete}
        isDeleting={crud.isDeleting}
        entityName="a categoria"
        itemName={crud.deleteConfirm?.name}
        warning={
          (crud.deleteConfirm?._count?.supplies || 0) > 0 &&
          `Esta categoria possui ${crud.deleteConfirm?._count?.supplies} insumos. Remova-os primeiro.`
        }
        canDelete={(crud.deleteConfirm?._count?.supplies || 0) === 0}
      />
    </div>
  );
}

// Sub-components

function CategoryCard({
  category,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  category: SupplyCategory;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-800 rounded-lg border p-4',
        'border-gray-200 dark:border-gray-700',
        !category.isActive && 'opacity-60'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: category.color || '#6B7280' }}
          />
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">{category.name}</h3>
            {category.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {category.description}
              </p>
            )}
          </div>
        </div>
        {!category.isActive && <Badge color="#6B7280">Inativa</Badge>}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {category._count?.supplies || 0} insumos
        </span>
        <div className="flex items-center gap-2">
          <button onClick={onToggleActive} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            {category.isActive ? 'Desativar' : 'Ativar'}
          </button>
          <button onClick={onEdit} className="text-sm text-blue-600 hover:text-blue-700">Editar</button>
          <button onClick={onDelete} className="text-sm text-red-600 hover:text-red-700">Excluir</button>
        </div>
      </div>
    </div>
  );
}

function ColorPicker({
  colors,
  selected,
  onChange,
}: {
  colors: string[];
  selected: string;
  onChange: (color: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cor</label>
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              'w-8 h-8 rounded-full border-2 transition-transform',
              selected === color ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}
