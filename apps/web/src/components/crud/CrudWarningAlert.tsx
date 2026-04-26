import { ReactNode } from 'react';

interface CrudWarningAlertProps {
  children: ReactNode;
}

export function CrudWarningAlert({ children }: CrudWarningAlertProps) {
  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-4">
      <div className="text-sm text-amber-600 dark:text-amber-400">
        {children}
      </div>
    </div>
  );
}
