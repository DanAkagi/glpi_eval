import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const authApi = {
  login: (code: string) => api.post('/auth/login', { code }),
  logout: () => api.post('/auth/logout'),
  status: () => api.get('/auth/status'),
};

export const statsApi = {
  get: () => api.get('/stats'),
};

export const importApi = {
  assets: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/assets', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  tickets: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/tickets', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  costs: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/costs', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  images: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/images', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  all: (files: { assets: File; tickets: File; costs: File; images: File }) => {
    const formData = new FormData();
    formData.append('assets', files.assets);
    formData.append('tickets', files.tickets);
    formData.append('costs', files.costs);
    formData.append('images', files.images);
    return api.post('/import/all', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export const resetApi = {
  reset: () => api.post('/reset'),
};

export const ticketsApi = {
  getAll: () => api.get('/tickets'),
  getById: (id: string) => api.get(`/tickets/${id}`),
  create: (data: any) => api.post('/tickets', data),
};

export const assetsApi = {
  getAll: (params?: any) => api.get('/assets', { params }),
  getById: (id: string) => api.get(`/assets/${id}`),
};

export const documentsApi = {
  getForAsset: (itemtype: string, itemsId: string) => api.get(`/documents/asset/${itemtype}/${itemsId}`),
};

export default api;
