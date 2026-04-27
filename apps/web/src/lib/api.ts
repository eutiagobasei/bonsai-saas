import axios from 'axios';
import { useAuthStore } from './auth-store';

/**
 * Axios instance configured for secure API communication.
 *
 * SECURITY: Authentication is handled via HttpOnly cookies.
 * - Access tokens are sent automatically via cookies (not visible to JS)
 * - No Authorization header needed (tokens protected from XSS)
 * - withCredentials: true ensures cookies are sent with cross-origin requests
 */
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include HttpOnly cookies in requests
});

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retrying, attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Refresh tokens via HttpOnly cookie (automatic)
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        // New access token is set via HttpOnly cookie, retry original request
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear auth state and redirect to login
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// CRUD API Factory
export interface CrudApi<T, CreateDto = Partial<T>, UpdateDto = Partial<T>> {
  getAll: (options?: Record<string, unknown>) => Promise<{ data: T[] }>;
  getById: (id: string) => Promise<{ data: T }>;
  create: (data: CreateDto) => Promise<{ data: T }>;
  update: (id: string, data: UpdateDto) => Promise<{ data: T }>;
  delete: (id: string) => Promise<void>;
}

export function createCrudApi<T, CreateDto = Partial<T>, UpdateDto = Partial<T>>(
  basePath: string
): CrudApi<T, CreateDto, UpdateDto> {
  return {
    getAll: (options?: Record<string, unknown>) => {
      const params = new URLSearchParams();
      if (options) {
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            params.append(key, String(value));
          }
        });
      }
      const queryString = params.toString();
      return api.get<T[]>(`${basePath}${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id: string) => api.get<T>(`${basePath}/${id}`),
    create: (data: CreateDto) => api.post<T>(basePath, data),
    update: (id: string, data: UpdateDto) => api.patch<T>(`${basePath}/${id}`, data),
    delete: (id: string) => api.delete(`${basePath}/${id}`),
  };
}

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  register: (data: { email: string; password: string; name?: string; tenantName?: string }) =>
    api.post('/auth/register', data),

  switchTenant: (tenantId: string) =>
    api.post('/auth/switch-tenant', { tenantId }),

  logout: () =>
    api.post('/auth/logout'),
};

// User API
export const userApi = {
  getProfile: () => api.get('/users/me'),
  getTenants: () => api.get('/users/me/tenants'),
  updateProfile: (data: { name?: string }) => api.patch('/users/me', data),
};

// Tenant API
export const tenantApi = {
  getCurrent: () => api.get('/tenants/current'),
  getMembers: () => api.get('/tenants/current/members'),
  inviteMember: (email: string, role?: string) =>
    api.post('/tenants/current/members', { email, role }),
  removeMember: (memberId: string) =>
    api.delete(`/tenants/current/members/${memberId}`),
  updateMemberRole: (memberId: string, role: string) =>
    api.patch(`/tenants/current/members/${memberId}/role`, { role }),
  update: (data: { name?: string }) => api.patch('/tenants/current', data),
  create: (name: string) => api.post('/tenants', { name }),
};

// Supply Category API
export interface SupplyCategory {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  color?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    supplies: number;
  };
}

export interface CreateSupplyCategoryData {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateSupplyCategoryData {
  name?: string;
  description?: string;
  color?: string;
  isActive?: boolean;
}

export const supplyCategoryApi = {
  getAll: (options?: { includeInactive?: boolean } | boolean) => {
    const includeInactive = typeof options === 'boolean' ? options : options?.includeInactive;
    return api.get<SupplyCategory[]>(`/supply-categories?includeInactive=${includeInactive ?? false}`);
  },
  getById: (id: string) =>
    api.get<SupplyCategory>(`/supply-categories/${id}`),
  create: (data: CreateSupplyCategoryData) =>
    api.post<SupplyCategory>('/supply-categories', data),
  update: (id: string, data: UpdateSupplyCategoryData) =>
    api.patch<SupplyCategory>(`/supply-categories/${id}`, data),
  delete: (id: string) =>
    api.delete(`/supply-categories/${id}`),
};

// Supply API
export interface Supply {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string;
  description?: string;
  unit: string;
  minStock?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category: SupplyCategory;
}

export interface CreateSupplyData {
  name: string;
  categoryId: string;
  unit: string;
  description?: string;
  minStock?: number;
}

export interface UpdateSupplyData {
  name?: string;
  categoryId?: string;
  unit?: string;
  description?: string;
  minStock?: number;
  isActive?: boolean;
}

export const supplyApi = {
  getAll: (options?: { categoryId?: string; includeInactive?: boolean }) => {
    const params = new URLSearchParams();
    if (options?.categoryId) params.append('categoryId', options.categoryId);
    if (options?.includeInactive) params.append('includeInactive', 'true');
    return api.get<Supply[]>(`/supplies?${params.toString()}`);
  },
  getById: (id: string) =>
    api.get<Supply>(`/supplies/${id}`),
  create: (data: CreateSupplyData) =>
    api.post<Supply>('/supplies', data),
  update: (id: string, data: UpdateSupplyData) =>
    api.patch<Supply>(`/supplies/${id}`, data),
  delete: (id: string) =>
    api.delete(`/supplies/${id}`),
};

// ============================================
// Admin API (Super Admin only)
// ============================================

export interface AdminStats {
  totalTenants: number;
  totalUsers: number;
  tenantsThisMonth: number;
  usersThisMonth: number;
  activeTenants: number;
}

export interface AdminTenant {
  id: string;
  name: string;
  slug: string;
  plan: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt: string;
  updatedAt: string;
  _count: {
    members: number;
  };
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  isSuperAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    tenantMemberships: number;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AdminPaginationOptions {
  page?: number;
  limit?: number;
  search?: string;
}

export const adminApi = {
  // Stats
  getStats: () => api.get<AdminStats>('/admin/stats'),

  // Tenants
  getTenants: (options?: AdminPaginationOptions) => {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', String(options.page));
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.search) params.append('search', options.search);
    return api.get<PaginatedResponse<AdminTenant>>(`/admin/tenants?${params.toString()}`);
  },
  getTenantById: (id: string) => api.get<AdminTenant>(`/admin/tenants/${id}`),
  updateTenant: (id: string, data: Partial<Pick<AdminTenant, 'name' | 'plan' | 'status'>>) =>
    api.patch<AdminTenant>(`/admin/tenants/${id}`, data),
  deleteTenant: (id: string) => api.delete(`/admin/tenants/${id}`),

  // Users
  getUsers: (options?: AdminPaginationOptions) => {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', String(options.page));
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.search) params.append('search', options.search);
    return api.get<PaginatedResponse<AdminUser>>(`/admin/users?${params.toString()}`);
  },
  getUserById: (id: string) => api.get<AdminUser>(`/admin/users/${id}`),
  updateUser: (id: string, data: Partial<Pick<AdminUser, 'email' | 'name' | 'isSuperAdmin'>>) =>
    api.patch<AdminUser>(`/admin/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
};
