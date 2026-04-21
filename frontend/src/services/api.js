import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 15000
});

// Request interceptor — attach token
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) config.headers['Authorization'] = `Bearer ${token}`;
    return config;
  },
  err => Promise.reject(err)
);

// Response interceptor — handle 401
api.interceptors.response.use(
  res => res,
  err => {
    const isAuthPath = ['/login', '/register', '/forgot-password'].includes(window.location.pathname);
    
    if (err.response?.status === 401 && !isAuthPath) {
      localStorage.removeItem('token');
      // Use replace to prevent back-button loops
      window.location.replace('/login');
    }
    return Promise.reject(err);
  }
);

export default api;
