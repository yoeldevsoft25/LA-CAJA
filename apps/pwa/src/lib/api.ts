import axios from 'axios';

// Detectar automáticamente la URL del API basándose en la URL actual
function getApiUrl(): string {
  // Si hay una variable de entorno, usarla
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Si estamos en localhost, usar localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }

  // Si estamos accediendo desde la red (ej: 192.168.1.8:5173), usar la misma IP para el API
  const hostname = window.location.hostname;
  return `http://${hostname}:3000`;
}

const API_URL = getApiUrl();

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token JWT y bloquear peticiones offline
api.interceptors.request.use(
  (config) => {
    // Bloquear peticiones si está offline
    if (!navigator.onLine) {
      return Promise.reject({
        code: 'ERR_INTERNET_DISCONNECTED',
        message: 'Sin conexión a internet',
        isOffline: true,
      });
    }

    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Si es un error offline, no hacer nada más (ya fue manejado en el request interceptor)
    if (error.isOffline || error.code === 'ERR_INTERNET_DISCONNECTED') {
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      // Token inválido o expirado
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

