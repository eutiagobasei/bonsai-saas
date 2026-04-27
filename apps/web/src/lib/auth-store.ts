import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  name: string | null;
  isSuperAdmin?: boolean;
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
  isAuthenticated: boolean;

  // Actions
  setAuth: (data: {
    user: User;
    tenant?: Tenant;
    tenants?: Tenant[];
  }) => void;
  setTenant: (tenant: Tenant) => void;
  setTenants: (tenants: Tenant[]) => void;
  logout: () => void;
}

/**
 * Auth store for user/tenant state.
 *
 * SECURITY: Access tokens are stored in HttpOnly cookies, not in JavaScript.
 * This prevents XSS attacks from stealing tokens via DevTools or malicious scripts.
 * The frontend only stores non-sensitive user metadata.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tenant: null,
      tenants: [],
      isAuthenticated: false,

      setAuth: (data) => {
        set({
          user: data.user,
          tenant: data.tenant ?? null,
          tenants: data.tenants ?? [],
          isAuthenticated: true,
        });
      },

      setTenant: (tenant) => {
        set({ tenant });
      },

      setTenants: (tenants) => {
        set({ tenants });
      },

      logout: () => {
        set({
          user: null,
          tenant: null,
          tenants: [],
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        tenant: state.tenant,
        tenants: state.tenants,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
