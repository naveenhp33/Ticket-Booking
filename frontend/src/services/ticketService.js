import api from './api';

export const ticketService = {
  getAll: (params) => api.get('/tickets', { params }),
  getOne: (id) => api.get(`/tickets/${id}`),
  getStats: () => api.get('/dashboard/employee'),
  create: (formData) => api.post('/tickets', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateStatus: (id, data) => api.patch(`/tickets/${id}/status`, data),
  assign: (id, agentId) => api.patch(`/tickets/${id}/assign`, { agentId }),
  updatePriority: (id, data) => api.patch(`/tickets/${id}/priority`, data),
  reopen: (id, reason) => api.patch(`/tickets/${id}/reopen`, { reason }),
  submitFeedback: (id, data) => api.post(`/tickets/${id}/feedback`, data),
  suggestPriority: (data) => api.post('/tickets/suggest-priority', data),
  findSimilar: (params) => api.get('/tickets/similar', { params }),
  delete: (id) => api.delete(`/tickets/${id}`)
};

export const commentService = {
  getAll: (ticketId) => api.get(`/comments/${ticketId}`),
  add: (ticketId, formData) => api.post(`/comments/${ticketId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  edit: (id, data) => api.put(`/comments/${id}`, data),
  delete: (id) => api.delete(`/comments/${id}`)
};

export const notificationService = {
  getAll: (params) => api.get('/notifications', { params }),
  markRead: (data) => api.patch('/notifications/read', data),
  delete: (id) => api.delete(`/notifications/${id}`)
};

export const dashboardService = {
  employee: () => api.get('/dashboard/employee'),
  admin: () => api.get('/dashboard/admin'),
  workload: () => api.get('/dashboard/workload')
};

export const userService = {
  getAll: (params) => api.get('/users', { params }),
  getAgents: (params) => api.get('/users/agents', { params }),
  getOne: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  getStats: (id) => api.get(`/users/${id}/stats`),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data)
};

export const knowledgeService = {
  search: (params) => api.get('/knowledge/search', { params }),
  getAll: (params) => api.get('/knowledge', { params }),
  getOne: (id) => api.get(`/knowledge/${id}`),
  create: (data) => api.post('/knowledge', data),
  update: (id, data) => api.put(`/knowledge/${id}`, data),
  rate: (id, helpful) => api.post(`/knowledge/${id}/rate`, { helpful })
};
