import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
  isAuthenticated: boolean;

  // Actions
  setAuth: (data: {
    user: User;
    tenant?: Tenant;
    tenants?: Tenant[];
    accessToken: string;
  }) => void;
  setAccessToken: (accessToken: string) => void;
  setTenant: (tenant: Tenant, accessToken: string) => void;
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
      isAuthenticated: false,

      setAuth: (data) => {
        set({
          user: data.user,
          tenant: data.tenant ?? null,
          tenants: data.tenants ?? [],
          accessToken: data.accessToken,
          isAuthenticated: true,
        });
      },

      setAccessToken: (accessToken) => {
        set({ accessToken });
      },

      setTenant: (tenant, accessToken) => {
        set({
          tenant,
          accessToken,
        });
      },

      setTenants: (tenants) => {
        set({ tenants });
      },

      logout: () => {
        set({
          user: null,
          tenant: null,
          tenants: [],
          accessToken: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage), // Use sessionStorage instead of localStorage for better security
      partialize: (state) => ({
        user: state.user,
        tenant: state.tenant,
        tenants: state.tenants,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
