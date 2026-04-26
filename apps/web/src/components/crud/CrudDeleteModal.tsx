import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ReactNode } from 'react';

interface CrudDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  title?: string;
  entityName: string;
  itemName?: string;
  warning?: ReactNode;
  canDelete?: boolean;
}

export function CrudDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
  title = 'Excluir',
  entityName,
  itemName,
  warning,
  canDelete = true,
}: CrudDeleteModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${title} ${entityName}`} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Tem certeza que deseja excluir {entityName.toLowerCase()}{' '}
          {itemName && <strong>{itemName}</strong>}?
        </p>
        {warning && (
          <div className="text-sm text-amber-600 dark:text-amber-400">
            {warning}
          </div>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            isLoading={isDeleting}
            disabled={!canDelete}
          >
            Excluir
          </Button>
        </div>
      </div>
    </Modal>
  );
}
