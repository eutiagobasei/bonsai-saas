/**
 * useCrudPage Hook
 *
 * Encapsulates all state management for CRUD pages:
 * - Loading, error, and modal states
 * - Form data management
 * - Create, edit, delete operations
 * - Auto-fetch on mount with dependency tracking
 *
 * Usage:
 * const crud = useCrudPage({
 *   api: supplyCategoryApi,
 *   entityName: 'categoria',
 *   defaultFormData: { name: '', description: '' },
 * });
 */

import { useState, useEffect, useCallback } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface CrudApiInterface<T, CreateDto, UpdateDto> {
  getAll: (options?: any) => Promise<{ data: T[] }>;
  create: (data: CreateDto) => Promise<{ data: T }>;
  update: (id: string, data: UpdateDto) => Promise<{ data: T }>;
  delete: (id: string) => Promise<unknown>;
}

export interface UseCrudPageOptions<T, CreateDto, UpdateDto> {
  api: CrudApiInterface<T, CreateDto, UpdateDto>;
  entityName: string;
  defaultFormData: CreateDto;
  fetchOptions?: Record<string, unknown>;
  dependencies?: unknown[];
  getItemId?: (item: T) => string;
  transformFormToUpdate?: (form: CreateDto, editing: T) => UpdateDto;
  onFetchSuccess?: (items: T[]) => void;
  onCreateSuccess?: (item: T) => void;
  onUpdateSuccess?: (item: T) => void;
  onDeleteSuccess?: () => void;
}

export interface UseCrudPageReturn<T, CreateDto> {
  // State
  items: T[];
  isLoading: boolean;
  error: string | null;
  isModalOpen: boolean;
  editingItem: T | null;
  formData: CreateDto;
  isSaving: boolean;
  formError: string | null;
  deleteConfirm: T | null;
  isDeleting: boolean;

  // Actions
  openCreateModal: () => void;
  openEditModal: (item: T) => void;
  closeModal: () => void;
  setFormData: (data: CreateDto | ((prev: CreateDto) => CreateDto)) => void;
  updateFormField: <K extends keyof CreateDto>(field: K, value: CreateDto[K]) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  confirmDelete: (item: T) => void;
  cancelDelete: () => void;
  handleDelete: () => Promise<void>;
  toggleActive: (item: T) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useCrudPage<
  T extends { id: string; isActive?: boolean },
  CreateDto,
  UpdateDto = Partial<CreateDto> & { isActive?: boolean }
>(
  options: UseCrudPageOptions<T, CreateDto, UpdateDto>
): UseCrudPageReturn<T, CreateDto> {
  const {
    api,
    entityName,
    defaultFormData,
    fetchOptions = {},
    dependencies = [],
    getItemId = (item) => item.id,
    transformFormToUpdate,
    onFetchSuccess,
    onCreateSuccess,
    onUpdateSuccess,
    onDeleteSuccess,
  } = options;

  // List state
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [formData, setFormData] = useState<CreateDto>(defaultFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState<T | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch items
  const fetchItems = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.getAll(fetchOptions);
      setItems(response.data);
      onFetchSuccess?.(response.data);
    } catch (err) {
      setError(`Erro ao carregar ${entityName}s`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [api, entityName, fetchOptions, onFetchSuccess]);

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies]);

  // Modal actions
  const openCreateModal = useCallback(() => {
    setEditingItem(null);
    setFormData(defaultFormData);
    setFormError(null);
    setIsModalOpen(true);
  }, [defaultFormData]);

  const openEditModal = useCallback((item: T) => {
    setEditingItem(item);
    // Extract form fields from item
    const formFields = Object.keys(defaultFormData as object).reduce((acc, key) => {
      const value = (item as Record<string, unknown>)[key];
      return { ...acc, [key]: value ?? (defaultFormData as Record<string, unknown>)[key] };
    }, {} as CreateDto);
    setFormData(formFields);
    setFormError(null);
    setIsModalOpen(true);
  }, [defaultFormData]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormError(null);
  }, []);

  const updateFormField = useCallback(<K extends keyof CreateDto>(field: K, value: CreateDto[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Submit handler
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);

    try {
      if (editingItem) {
        const updateData = transformFormToUpdate
          ? transformFormToUpdate(formData, editingItem)
          : (formData as unknown as UpdateDto);
        const response = await api.update(getItemId(editingItem), updateData);
        onUpdateSuccess?.(response.data);
      } else {
        const response = await api.create(formData);
        onCreateSuccess?.(response.data);
      }
      await fetchItems();
      closeModal();
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        `Erro ao salvar ${entityName}`;
      setFormError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }, [
    editingItem,
    formData,
    api,
    entityName,
    fetchItems,
    closeModal,
    getItemId,
    transformFormToUpdate,
    onCreateSuccess,
    onUpdateSuccess,
  ]);

  // Delete actions
  const confirmDelete = useCallback((item: T) => {
    setDeleteConfirm(item);
  }, []);

  const cancelDelete = useCallback(() => {
    setDeleteConfirm(null);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteConfirm) return;

    setIsDeleting(true);
    try {
      await api.delete(getItemId(deleteConfirm));
      await fetchItems();
      setDeleteConfirm(null);
      onDeleteSuccess?.();
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        `Erro ao excluir ${entityName}`;
      alert(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteConfirm, api, entityName, fetchItems, getItemId, onDeleteSuccess]);

  // Toggle active status
  const toggleActive = useCallback(async (item: T) => {
    try {
      await api.update(getItemId(item), { isActive: !item.isActive } as unknown as UpdateDto);
      await fetchItems();
    } catch (err) {
      console.error(err);
    }
  }, [api, fetchItems, getItemId]);

  return {
    // State
    items,
    isLoading,
    error,
    isModalOpen,
    editingItem,
    formData,
    isSaving,
    formError,
    deleteConfirm,
    isDeleting,

    // Actions
    openCreateModal,
    openEditModal,
    closeModal,
    setFormData,
    updateFormField,
    handleSubmit,
    confirmDelete,
    cancelDelete,
    handleDelete,
    toggleActive,
    refresh: fetchItems,
  };
}
