'use client';

import { useState, useEffect } from 'react';
import {
  supplyApi,
  supplyCategoryApi,
  Supply,
  SupplyCategory,
  CreateSupplyData,
} from '@/lib/api';
import { useCrudPage } from '@/hooks/use-crud-page';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { CubeIcon } from '@/components/icons';
import {
  CrudPageHeader,
  CrudEmptyState,
  CrudDeleteModal,
  CrudLoadingState,
  CrudErrorAlert,
  CrudWarningAlert,
} from '@/components/crud';
import { cn } from '@/lib/utils';

const UNIT_OPTIONS = [
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'g', label: 'Grama (g)' },
  { value: 'L', label: 'Litro (L)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'un', label: 'Unidade (un)' },
  { value: 'cx', label: 'Caixa (cx)' },
  { value: 'pct', label: 'Pacote (pct)' },
  { value: 'dz', label: 'Dúzia (dz)' },
];

export default function InsumosPage() {
  const [categories, setCategories] = useState<SupplyCategory[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('');

  const crud = useCrudPage<Supply, CreateSupplyData>({
    api: supplyApi,
    entityName: 'insumo',
    defaultFormData: {
      name: '',
      categoryId: '',
      unit: 'kg',
      description: '',
      minStock: undefined,
    },
    fetchOptions: {
      categoryId: filterCategory || undefined,
      includeInactive: true,
    },
    dependencies: [filterCategory],
    onFetchSuccess: async () => {
      // Fetch categories for the form
      if (categories.length === 0) {
        const res = await supplyCategoryApi.getAll({ includeInactive: false });
        setCategories(res.data);
      }
    },
  });

  // Load categories on mount
  useEffect(() => {
    supplyCategoryApi.getAll({ includeInactive: false }).then((res) => {
      setCategories(res.data);
    });
  }, []);

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  // Set default categoryId when opening create modal
  const handleOpenCreate = () => {
    crud.openCreateModal();
    if (categories[0]) {
      crud.updateFormField('categoryId', categories[0].id);
    }
  };

  if (crud.isLoading) return <CrudLoadingState />;

  return (
    <div className="space-y-6">
      <CrudPageHeader
        title="Insumos"
        description="Gerencie os insumos do seu estabelecimento"
        createLabel="Novo Insumo"
        onCreateClick={handleOpenCreate}
        createDisabled={categories.length === 0}
      />

      {categories.length === 0 && (
        <CrudWarningAlert>
          Você precisa criar pelo menos uma categoria antes de cadastrar insumos.{' '}
          <a href="/categorias" className="underline font-medium">Criar categoria</a>
        </CrudWarningAlert>
      )}

      {crud.error && <CrudErrorAlert message={crud.error} />}

      {/* Filters */}
      {categories.length > 0 && (
        <div className="flex gap-4">
          <Select
            options={[{ value: '', label: 'Todas as categorias' }, ...categoryOptions]}
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-48"
          />
        </div>
      )}

      {/* Supplies Table */}
      {crud.items.length === 0 ? (
        <CrudEmptyState
          icon={<CubeIcon className="w-12 h-12" />}
          title="Nenhum insumo"
          description={filterCategory ? 'Nenhum insumo encontrado nesta categoria.' : 'Comece cadastrando seu primeiro insumo.'}
          createLabel="Novo Insumo"
          onCreateClick={handleOpenCreate}
          showCreateButton={!filterCategory && categories.length > 0}
        />
      ) : (
        <SuppliesTable
          supplies={crud.items}
          onEdit={crud.openEditModal}
          onDelete={crud.confirmDelete}
          onToggleActive={crud.toggleActive}
        />
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={crud.isModalOpen}
        onClose={crud.closeModal}
        title={crud.editingItem ? 'Editar Insumo' : 'Novo Insumo'}
        size="md"
      >
        <form onSubmit={crud.handleSubmit} className="space-y-4">
          <Input
            label="Nome"
            id="name"
            value={crud.formData.name}
            onChange={(e) => crud.updateFormField('name', e.target.value)}
            placeholder="Ex: Filé Mignon"
            required
          />
          <Select
            label="Categoria"
            id="categoryId"
            options={categoryOptions}
            value={crud.formData.categoryId}
            onChange={(e) => crud.updateFormField('categoryId', e.target.value)}
            placeholder="Selecione uma categoria"
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Unidade"
              id="unit"
              options={UNIT_OPTIONS}
              value={crud.formData.unit}
              onChange={(e) => crud.updateFormField('unit', e.target.value)}
            />
            <Input
              label="Estoque Mínimo (opcional)"
              id="minStock"
              type="number"
              step="0.01"
              min="0"
              value={crud.formData.minStock ?? ''}
              onChange={(e) =>
                crud.updateFormField('minStock', e.target.value ? parseFloat(e.target.value) : undefined)
              }
              placeholder="Ex: 5"
            />
          </div>
          <Input
            label="Descrição (opcional)"
            id="description"
            value={crud.formData.description || ''}
            onChange={(e) => crud.updateFormField('description', e.target.value)}
            placeholder="Ex: Filé mignon bovino de primeira"
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
        entityName="o insumo"
        itemName={crud.deleteConfirm?.name}
      />
    </div>
  );
}

// Sub-components

function SuppliesTable({
  supplies,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  supplies: Supply[];
  onEdit: (supply: Supply) => void;
  onDelete: (supply: Supply) => void;
  onToggleActive: (supply: Supply) => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nome</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Categoria</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unidade</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estoque Min.</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {supplies.map((supply) => (
            <tr key={supply.id} className={cn(!supply.isActive && 'opacity-60')}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900 dark:text-white">{supply.name}</div>
                {supply.description && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">{supply.description}</div>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <Badge color={supply.category.color || '#6B7280'}>{supply.category.name}</Badge>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{supply.unit}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {supply.minStock !== null ? supply.minStock : '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <StatusBadge isActive={supply.isActive} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                <button onClick={() => onToggleActive(supply)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mr-3">
                  {supply.isActive ? 'Desativar' : 'Ativar'}
                </button>
                <button onClick={() => onEdit(supply)} className="text-blue-600 hover:text-blue-700 mr-3">Editar</button>
                <button onClick={() => onDelete(supply)} className="text-red-600 hover:text-red-700">Excluir</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
        Ativo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
      Inativo
    </span>
  );
}
