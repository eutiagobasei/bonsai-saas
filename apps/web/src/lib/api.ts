import axios from 'axios';
import { useAuthStore } from './auth-store';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies in requests
});

// Request interceptor to add auth token from memory
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const { accessToken } = useAuthStore.getState();
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Refresh token is sent automatically via HttpOnly cookie
        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const { accessToken } = response.data;

        // Update access token in memory store
        useAuthStore.getState().setAccessToken(accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
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
