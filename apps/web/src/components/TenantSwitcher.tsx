'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

export function TenantSwitcher() {
  const { tenant, tenants, switchTenant, refreshTenants } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Refresh tenants on mount
  useEffect(() => {
    refreshTenants();
  }, [refreshTenants]);

  const handleSwitch = async (tenantId: string) => {
    if (tenantId === tenant?.id) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      await switchTenant(tenantId);
    } catch (error) {
      console.error('Failed to switch tenant:', error);
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  if (!tenant || tenants.length <= 1) {
    // Show current tenant name without dropdown if only one tenant
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
        <span className="font-medium">{tenant?.name ?? 'No tenant'}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium',
          'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
          'hover:bg-gray-50 dark:hover:bg-gray-700',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          'transition-colors duration-150',
          isLoading && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className="truncate max-w-[150px]">{tenant.name}</span>
        <ChevronDownIcon className="w-4 h-4 text-gray-500" />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute right-0 mt-2 w-64 rounded-md shadow-lg z-50',
            'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
            'py-1'
          )}
        >
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Switch Workspace
          </div>

          {tenants.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSwitch(t.id)}
              disabled={isLoading}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-sm',
                'hover:bg-gray-100 dark:hover:bg-gray-700',
                'focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700',
                t.id === tenant.id && 'bg-blue-50 dark:bg-blue-900/20'
              )}
            >
              <div className="flex-1 text-left">
                <div className="font-medium text-gray-900 dark:text-white">
                  {t.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t.role.charAt(0) + t.role.slice(1).toLowerCase()}
                </div>
              </div>
              {t.id === tenant.id && (
                <CheckIcon className="w-4 h-4 text-blue-600" />
              )}
            </button>
          ))}

          <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
            <a
              href="/settings/workspaces"
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300',
                'hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              <PlusIcon className="w-4 h-4" />
              Create new workspace
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// Icon components
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
    </svg>
  );
}
