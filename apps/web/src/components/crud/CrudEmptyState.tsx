import { Button } from '@/components/ui/Button';
import { PlusIcon } from '@/components/icons';
import { ReactNode } from 'react';

interface CrudEmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  createLabel?: string;
  onCreateClick?: () => void;
  showCreateButton?: boolean;
}

export function CrudEmptyState({
  icon,
  title,
  description,
  createLabel = 'Criar',
  onCreateClick,
  showCreateButton = true,
}: CrudEmptyStateProps) {
  return (
    <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="w-12 h-12 mx-auto text-gray-400">{icon}</div>
      <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
        {title}
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {description}
      </p>
      {showCreateButton && onCreateClick && (
        <div className="mt-6">
          <Button onClick={onCreateClick}>
            <PlusIcon className="w-4 h-4 mr-2" />
            {createLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
