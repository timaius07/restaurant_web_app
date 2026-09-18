const getDefaultApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:5000/api';
  }
  // En producción usar ruta relativa (proxy reverso nginx)
  return '/api';
};

const API_URL = getDefaultApiUrl();

const DEFAULT_TIMEOUT_MS = 30000; // 30 segundos

// Categorías de error para mejor manejo en UI
const ERROR_CATEGORIES = {
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  HTTP: 'http',
  VALIDATION: 'validation',
  AUTH: 'auth',
  SERVER: 'server'
};

function classifyError(err, status) {
  if (err.name === 'AbortError') return ERROR_CATEGORIES.TIMEOUT;
  if (!err.message && !status) return ERROR_CATEGORIES.NETWORK;
  if (status === 401 || status === 403) return ERROR_CATEGORIES.AUTH;
  if (status === 400) return ERROR_CATEGORIES.VALIDATION;
  if (status >= 500) return ERROR_CATEGORIES.SERVER;
  return ERROR_CATEGORIES.HTTP;
}

function getUserFriendlyMessage(error, category, status) {
  switch (category) {
    case ERROR_CATEGORIES.TIMEOUT:
      return 'El servidor está tardando mucho en responder. Por favor intenta nuevamente.';
    case ERROR_CATEGORIES.NETWORK:
      return 'No hay conexión con el servidor. Verifica tu conexión a internet.';
    case ERROR_CATEGORIES.AUTH:
      return 'No tienes permiso para realizar esta acción. Inicia sesión nuevamente.';
    case ERROR_CATEGORIES.VALIDATION:
      return error.message || 'Los datos proporcionados no son válidos.';
    case ERROR_CATEGORIES.SERVER:
      return 'Error en el servidor. Por favor intenta más tarde.';
    default:
      return error.message || 'Ocurrió un error inesperado.';
  }
}

export function getCurrentTenantSlug() {
  if (typeof window === 'undefined') return 'sodalatica';
  const segments = window.location.pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];
  if (firstSegment && !['login', 'no-autorizado', 'portal'].includes(firstSegment)) {
    return firstSegment;
  }
  return localStorage.getItem('tenant_slug') || 'sodalatica';
}

export function setTenantSlug(slug) {
  if (typeof window === 'undefined') return;
  if (slug) {
    localStorage.setItem('tenant_slug', slug);
  } else {
    localStorage.removeItem('tenant_slug');
  }
}

function getHeaders(customHeaders = {}) {
  const slug = getCurrentTenantSlug();
  const headers = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };
  if (slug) {
    headers['X-Tenant-Slug'] = slug;
  }
  try {
    const rawSession = localStorage.getItem('session');
    if (rawSession) {
      const session = JSON.parse(rawSession);
      if (session && session.token) {
        headers['Authorization'] = `Bearer ${session.token}`;
      }
    }
  } catch {}
  return headers;
}

export const api = {
  get: async (endpoint, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT_MS);
    
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        headers: getHeaders(options.headers),
        signal: controller.signal,
        credentials: 'include',
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 401 && typeof window !== 'undefined') {
          // Si el servidor rechaza el token por inválido o expirado
          const hadSession = !!localStorage.getItem('session');
          if (hadSession && !endpoint.includes('/auth/login')) {
            localStorage.removeItem('session');
          }
        }
        const category = classifyError(new Error(errData.error), res.status);
        const userMessage = getUserFriendlyMessage(new Error(errData.error || `Error fetching ${endpoint}`), category, res.status);
        const error = new Error(userMessage);
        error.category = category;
        error.response = errData;
        error.status = res.status;
        error.originalMessage = errData.error;
        throw error;
      }
      return res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const userMessage = getUserFriendlyMessage(err, ERROR_CATEGORIES.TIMEOUT);
        const error = new Error(userMessage);
        error.category = ERROR_CATEGORIES.TIMEOUT;
        error.status = null;
        throw error;
      }
      const category = classifyError(err, null);
      const userMessage = getUserFriendlyMessage(err, category, null);
      const error = new Error(userMessage);
      error.category = category;
      error.status = null;
      throw error;
    }
  },
  post: async (endpoint, data, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT_MS);
    
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: getHeaders(options.headers),
        body: JSON.stringify(data),
        signal: controller.signal,
        credentials: 'include',
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 401 && typeof window !== 'undefined') {
          const hadSession = !!localStorage.getItem('session');
          if (hadSession && !endpoint.includes('/auth/login')) {
            localStorage.removeItem('session');
          }
        }
        const category = classifyError(new Error(errData.error), res.status);
        const userMessage = getUserFriendlyMessage(new Error(errData.error || `Error posting to ${endpoint}`), category, res.status);
        const error = new Error(userMessage);
        error.category = category;
        error.response = errData;
        error.status = res.status;
        error.originalMessage = errData.error;
        throw error;
      }
      return res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const userMessage = getUserFriendlyMessage(err, ERROR_CATEGORIES.TIMEOUT);
        const error = new Error(userMessage);
        error.category = ERROR_CATEGORIES.TIMEOUT;
        error.status = null;
        throw error;
      }
      const category = classifyError(err, null);
      const userMessage = getUserFriendlyMessage(err, category, null);
      const error = new Error(userMessage);
      error.category = category;
      error.status = null;
      throw error;
    }
  },
  put: async (endpoint, data, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT_MS);
    
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'PUT',
        headers: getHeaders(options.headers),
        body: JSON.stringify(data),
        signal: controller.signal,
        credentials: 'include',
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 401 && typeof window !== 'undefined') {
          const hadSession = !!localStorage.getItem('session');
          if (hadSession && !endpoint.includes('/auth/login')) {
            localStorage.removeItem('session');
          }
        }
        const category = classifyError(new Error(errData.error), res.status);
        const userMessage = getUserFriendlyMessage(new Error(errData.error || `Error putting to ${endpoint}`), category, res.status);
        const error = new Error(userMessage);
        error.category = category;
        error.response = errData;
        error.status = res.status;
        error.originalMessage = errData.error;
        throw error;
      }
      return res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const userMessage = getUserFriendlyMessage(err, ERROR_CATEGORIES.TIMEOUT);
        const error = new Error(userMessage);
        error.category = ERROR_CATEGORIES.TIMEOUT;
        error.status = null;
        throw error;
      }
      const category = classifyError(err, null);
      const userMessage = getUserFriendlyMessage(err, category, null);
      const error = new Error(userMessage);
      error.category = category;
      error.status = null;
      throw error;
    }
  },
  delete: async (endpoint, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT_MS);
    
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'DELETE',
        headers: getHeaders(options.headers),
        signal: controller.signal,
        credentials: 'include',
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 401 && typeof window !== 'undefined') {
          const hadSession = !!localStorage.getItem('session');
          if (hadSession && !endpoint.includes('/auth/login')) {
            localStorage.removeItem('session');
          }
        }
        const category = classifyError(new Error(errData.error), res.status);
        const userMessage = getUserFriendlyMessage(new Error(errData.error || `Error deleting ${endpoint}`), category, res.status);
        const error = new Error(userMessage);
        error.category = category;
        error.response = errData;
        error.status = res.status;
        error.originalMessage = errData.error;
        throw error;
      }
      return res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const userMessage = getUserFriendlyMessage(err, ERROR_CATEGORIES.TIMEOUT);
        const error = new Error(userMessage);
        error.category = ERROR_CATEGORIES.TIMEOUT;
        error.status = null;
        throw error;
      }
      const category = classifyError(err, null);
      const userMessage = getUserFriendlyMessage(err, category, null);
      const error = new Error(userMessage);
      error.category = category;
      error.status = null;
      throw error;
    }
  },
};
