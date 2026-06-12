import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const assetsApi = {
  getAll: (params?: any) => api.get('/assets', { params }),
  getById: (id: string) => api.get(`/assets/${id}`),
};

export const ticketsApi = {
  getAll: () => api.get('/tickets'),
  getById: (id: string) => api.get(`/tickets/${id}`),
  create: (data: any) => api.post('/tickets', data),
  update: (id: number, data: any) => api.patch(`/tickets/${id}`, data),
};

export const kanbanApi = {
  getConfig: () => api.get('/kanban/config'),
  updateConfig: (data: any) => api.put('/kanban/config', data),
};

export const costsApi = {
  create: (data: any) => api.post('/kanban/super-costs', data),
};

export const documentsApi = {
  getForAsset: (itemtype: string, itemsId: string) => api.get(`/documents/asset/${itemtype}/${itemsId}`),
};

export default api;
