import { refreshToken as refreshTenantToken } from './supabaseTenantAuth';
import { logError, logWarning } from './loggerService';

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
      return error.message || 'No tienes permiso para realizar esta acción. Inicia sesión nuevamente.';
    case ERROR_CATEGORIES.VALIDATION:
      return error.message || 'Los datos proporcionados no son válidos.';
    case ERROR_CATEGORIES.SERVER:
      return 'Error en el servidor. Por favor intenta más tarde.';
    default:
      return error.message || 'Ocurrió un error inesperado.';
  }
}

export function getCurrentTenantSlug() {
  if (typeof window === 'undefined') return null;
  
  // Primero: usar el tenant de la sesión actual (del login)
  try {
    const rawSession = localStorage.getItem('session');
    if (rawSession) {
      const session = JSON.parse(rawSession);
      if (session && session.tenantSlug) {
        return session.tenantSlug;
      }
    }
  } catch {}
  
  // Segundo: usar el tenant de la URL
  const segments = window.location.pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];
  if (firstSegment && !['login', 'no-autorizado', 'portal'].includes(firstSegment)) {
    return firstSegment;
  }
  
  // Tercero: usar localStorage como fallback (para login screen)
  return localStorage.getItem('tenant_slug');
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

  // Identificador de la soda (para routing por schema y validación de contexto)
  if (slug) {
    headers['X-Tenant-Slug'] = slug;
  }

  // Token de usuario final (empleado/PIN), si existe en sesión
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

// Limpieza proactiva de tokens de tenant legados en localStorage (ahora en Cookie HttpOnly)
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('tenant_session');
  } catch {}
}

async function executeRequest(method, endpoint, data = null, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT_MS);

  try {
    const fetchOptions = {
      method,
      headers: getHeaders(options.headers),
      signal: controller.signal,
      credentials: 'include',
    };

    if (data !== null && ['POST', 'PUT', 'PATCH'].includes(method)) {
      fetchOptions.body = JSON.stringify(data);
    }

    const res = await fetch(`${API_URL}${endpoint}`, fetchOptions);
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));

      // Si la sesión de terminal fue revocada por el administrador, redirigir al portal de inicio
      if (res.status === 401 && errData.sessionRevoked && typeof window !== 'undefined') {
        localStorage.removeItem('session');
        localStorage.removeItem('tenant_slug');
        window.location.href = '/';
        const error = new Error(errData.error || 'Sesión de terminal revocada');
        error.status = 401;
        throw error;
      }
      const category = classifyError(new Error(errData.error), res.status);
      const userMessage = getUserFriendlyMessage(new Error(errData.error || `Error en ${method} ${endpoint}`), category, res.status);
      const error = new Error(userMessage);
      error.category = category;
      error.response = errData;
      error.status = res.status;
      error.originalMessage = errData.error;

      // Registrar error HTTP en LaunchDarkly
      logError(error, {
        method,
        endpoint,
        status: res.status,
        apiError: errData.error || null,
        category
      });

      throw error;
    }

    if (options.responseType === 'blob') return res.blob();
    return res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.status || err.originalMessage) throw err;
    if (err.name === 'AbortError') {
      const userMessage = getUserFriendlyMessage(err, ERROR_CATEGORIES.TIMEOUT);
      const error = new Error(userMessage);
      error.category = ERROR_CATEGORIES.TIMEOUT;
      error.status = null;
      logWarning(`Timeout en petición ${method} ${endpoint}`, { method, endpoint });
      throw error;
    }
    const category = classifyError(err, null);
    const userMessage = getUserFriendlyMessage(err, category, null);
    const error = new Error(userMessage);
    error.category = category;
    error.status = null;
    logError(err, { method, endpoint, category, context: 'api_network_error' });
    throw error;
  }
}

export const api = {
  get: (endpoint, options = {}) => executeRequest('GET', endpoint, null, options),
  post: (endpoint, data, options = {}) => executeRequest('POST', endpoint, data, options),
  put: (endpoint, data, options = {}) => executeRequest('PUT', endpoint, data, options),
  patch: (endpoint, data, options = {}) => executeRequest('PATCH', endpoint, data, options),
  delete: (endpoint, options = {}) => executeRequest('DELETE', endpoint, null, options),
};

export default api;
