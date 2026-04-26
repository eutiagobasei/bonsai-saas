'use client';

import { ReactNode } from 'react';
import { ApiConnectionBanner } from '@/components/ui/ApiConnectionBanner';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Client-side providers wrapper.
 * Includes API connection status banner and future providers (QueryClient, etc.)
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <>
      <ApiConnectionBanner />
      {children}
    </>
  );
}
