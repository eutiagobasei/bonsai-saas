import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  name: string | null;
}

export interface Tenant {
  id: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  tenants: Tenant[];
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  // Actions
  setAuth: (data: {
    user: User;
    tenant?: Tenant;
    tenants?: Tenant[];
    accessToken: string;
    refreshToken: string;
  }) => void;
  setTenant: (tenant: Tenant, accessToken: string, refreshToken: string) => void;
  setTenants: (tenants: Tenant[]) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tenant: null,
      tenants: [],
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (data) => {
        // Also store in localStorage for API interceptors
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
        }

        set({
          user: data.user,
          tenant: data.tenant ?? null,
          tenants: data.tenants ?? [],
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          isAuthenticated: true,
        });
      },

      setTenant: (tenant, accessToken, refreshToken) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);
        }

        set({
          tenant,
          accessToken,
          refreshToken,
        });
      },

      setTenants: (tenants) => {
        set({ tenants });
      },

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }

        set({
          user: null,
          tenant: null,
          tenants: [],
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        tenant: state.tenant,
        tenants: state.tenants,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
