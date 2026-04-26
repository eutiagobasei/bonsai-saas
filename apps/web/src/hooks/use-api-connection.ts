'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface ConnectionStatus {
  isConnected: boolean;
  isChecking: boolean;
  error: string | null;
  lastChecked: Date | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// Build health endpoint URL safely
const HEALTH_ENDPOINT = (() => {
  try {
    const url = new URL(API_URL);
    url.pathname = '/health';
    return url.toString();
  } catch {
    // Fallback for relative URLs or parsing errors
    return API_URL.replace(/\/api.*$/, '/health');
  }
})();

/**
 * Hook to check API connectivity status.
 * Pings the /health endpoint to verify the backend is reachable.
 */
export function useApiConnection(options?: {
  /** Check connection on mount. Default: true */
  checkOnMount?: boolean;
  /** Auto-retry interval in ms. Set to 0 to disable. Default: 0 */
  retryInterval?: number;
}) {
  const { checkOnMount = true, retryInterval = 0 } = options ?? {};
  const abortControllerRef = useRef<AbortController | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>({
    isConnected: false,
    isChecking: false,
    error: null,
    lastChecked: null,
  });

  const checkConnection = useCallback(async (): Promise<boolean> => {
    // Abort any pending request
    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStatus((prev) => ({ ...prev, isChecking: true, error: null }));

    try {
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(HEALTH_ENDPOINT, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const isConnected = response.ok;

      setStatus({
        isConnected,
        isChecking: false,
        error: isConnected ? null : `API returned status ${response.status}`,
        lastChecked: new Date(),
      });

      return isConnected;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to connect to API';

      setStatus({
        isConnected: false,
        isChecking: false,
        error: error.includes('aborted')
          ? 'Connection timeout - API not responding'
          : `Cannot reach API at ${HEALTH_ENDPOINT}`,
        lastChecked: new Date(),
      });

      return false;
    }
  }, []);

  // Check on mount
  useEffect(() => {
    if (checkOnMount) {
      checkConnection();
    }
  }, [checkOnMount, checkConnection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Auto-retry
  useEffect(() => {
    if (retryInterval > 0 && !status.isConnected && !status.isChecking) {
      const timer = setTimeout(checkConnection, retryInterval);
      return () => clearTimeout(timer);
    }
  }, [retryInterval, status.isConnected, status.isChecking, checkConnection]);

  return {
    ...status,
    checkConnection,
    apiUrl: API_URL,
  };
}
