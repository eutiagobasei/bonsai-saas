'use client';

import { useApiConnection } from '@/hooks/use-api-connection';

/**
 * Banner that displays when the API is not reachable.
 * Automatically retries connection every 5 seconds.
 */
export function ApiConnectionBanner() {
  const { isConnected, isChecking, error, checkConnection } = useApiConnection({
    checkOnMount: true,
    retryInterval: 5000,
  });

  // Don't show anything if connected
  if (isConnected) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="bg-red-600 text-white px-4 py-2 text-center text-sm"
    >
      <div className="flex items-center justify-center gap-2">
        {isChecking ? (
          <>
            <svg
              aria-hidden="true"
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Connecting to API...</span>
          </>
        ) : (
          <>
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{error || 'Cannot connect to API'}</span>
            <button
              onClick={() => checkConnection()}
              className="ml-2 underline hover:no-underline"
              aria-label="Retry connection to API"
            >
              Retry
            </button>
          </>
        )}
      </div>
    </div>
  );
}
