import { Button } from '@/components/ui/Button';
import { PlusIcon } from '@/components/icons';

interface CrudPageHeaderProps {
  title: string;
  description?: string;
  createLabel?: string;
  onCreateClick: () => void;
  createDisabled?: boolean;
}

export function CrudPageHeader({
  title,
  description,
  createLabel = 'Novo',
  onCreateClick,
  createDisabled = false,
}: CrudPageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>
      <Button onClick={onCreateClick} disabled={createDisabled}>
        <PlusIcon className="w-4 h-4 mr-2" />
        {createLabel}
      </Button>
    </div>
  );
}
