import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
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
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`,
          { refreshToken }
        );

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
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

  logout: (refreshToken?: string) =>
    api.post('/auth/logout', { refreshToken }),
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
