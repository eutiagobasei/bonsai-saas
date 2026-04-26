interface CrudErrorAlertProps {
  message: string;
}

export function CrudErrorAlert({ message }: CrudErrorAlertProps) {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
      <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
    </div>
  );
}
