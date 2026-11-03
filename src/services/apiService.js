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

  // Prioridad 1: Usar token de Supabase si hay sesión de tenant
  try {
    const rawTenantSession = localStorage.getItem('tenant_session');
    if (rawTenantSession) {
      const tenantSession = JSON.parse(rawTenantSession);
      if (tenantSession && tenantSession.access_token) {
        headers['Authorization'] = `Bearer ${tenantSession.access_token}`;
        // No enviar X-Tenant-Slug si ya estamos usando Supabase JWT
        return headers;
      }
    }
  } catch {}

  // Prioridad 2: Usar X-Tenant-Slug para usuarios finales (JWT custom)
  if (slug) {
    headers['X-Tenant-Slug'] = slug;
  }

  // Prioridad 3: Usar token de usuario final (JWT custom)
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

let refreshPromise = null;

async function tryRefreshToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      if (typeof window === 'undefined') return false;
      const raw = localStorage.getItem('tenant_session');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed?.refresh_token) return false;

      const res = await fetch(`${API_URL}/supabase/tenant/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: parsed.refresh_token })
      });

      if (!res.ok) return false;

      const data = await res.json();
      if (!data.success) return false;

      const newSession = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        tenant: parsed.tenant
      };
      localStorage.setItem('tenant_session', JSON.stringify(newSession));
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
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
      // Si recibimos 401 y no hemos reintentado todavía, intentar refresh token de Supabase
      // EXCEPTO en endpoints de login (no tiene sentido reintentar login con refresh)
      if (res.status === 401 && !options._retry && typeof window !== 'undefined' && !endpoint.includes('/auth/login')) {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
          // Reintentar la petición una sola vez con el nuevo token
          return executeRequest(method, endpoint, data, { ...options, _retry: true });
        }

        // Si el refresh falló, limpiar solo tenant_session (mantener slug para login interno)
        const hadSession = !!localStorage.getItem('session');
        const hadTenantSession = !!localStorage.getItem('tenant_session');
        if (hadSession && !endpoint.includes('/auth/login')) {
          localStorage.removeItem('session');
        }
        if (hadTenantSession && !endpoint.includes('/supabase/tenant/auth/login')) {
          localStorage.removeItem('tenant_session');
          // NO limpiar tenant_slug para permitir login interno
          // Redirigir a la página de login de slug (solo si no es endpoint de login interno)
          if (!endpoint.includes('/auth/login-pin')) {
            window.location.href = '/';
          }
        }
      }

      const errData = await res.json().catch(() => ({}));
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
