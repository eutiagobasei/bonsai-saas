'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { authApi, userApi } from '@/lib/api';

export function useAuth() {
  const router = useRouter();
  const {
    user,
    tenant,
    tenants,
    isAuthenticated,
    setAuth,
    setTenant,
    logout: clearAuth,
  } = useAuthStore();

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await authApi.login(email, password);

      // Token is set via HttpOnly cookie, only store user metadata
      setAuth({
        user: data.user,
        tenant: data.tenant,
        tenants: data.tenants ?? [],
      });

      // If multiple tenants and none selected, redirect to tenant selection
      if (!data.tenant && data.tenants?.length > 1) {
        router.push('/select-tenant');
      } else {
        router.push('/dashboard');
      }

      return data;
    },
    [setAuth, router]
  );

  const register = useCallback(
    async (data: {
      email: string;
      password: string;
      name?: string;
      tenantName?: string;
    }) => {
      const { data: responseData } = await authApi.register(data);

      // Token is set via HttpOnly cookie, only store user metadata
      setAuth({
        user: responseData.user,
        tenant: responseData.tenant,
        tenants: responseData.tenants ?? [],
      });

      router.push('/dashboard');
      return responseData;
    },
    [setAuth, router]
  );

  const switchTenant = useCallback(
    async (tenantId: string) => {
      const { data } = await authApi.switchTenant(tenantId);

      // Token is set via HttpOnly cookie, only update tenant metadata
      setTenant(data.tenant);
      router.push('/dashboard');

      return data;
    },
    [setTenant, router]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore errors during logout
    } finally {
      clearAuth();
      router.push('/login');
    }
  }, [clearAuth, router]);

  const refreshTenants = useCallback(async () => {
    const { data } = await userApi.getTenants();
    useAuthStore.getState().setTenants(data);
    return data;
  }, []);

  return {
    user,
    tenant,
    tenants,
    isAuthenticated,
    login,
    register,
    switchTenant,
    logout,
    refreshTenants,
  };
}
