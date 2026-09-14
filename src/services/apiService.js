const getDefaultApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:5000/api';
  }
  return 'http://150.136.175.75:5000/api';
};

const API_URL = getDefaultApiUrl();

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
  return headers;
}

export const api = {
  get: async (endpoint, options = {}) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      headers: getHeaders(options.headers),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const error = new Error(errData.error || `Error fetching ${endpoint}`);
      error.response = errData;
      error.status = res.status;
      throw error;
    }
    return res.json();
  },
  post: async (endpoint, data, options = {}) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: getHeaders(options.headers),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const error = new Error(errData.error || `Error posting to ${endpoint}`);
      error.response = errData;
      error.status = res.status;
      throw error;
    }
    return res.json();
  },
  put: async (endpoint, data, options = {}) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: getHeaders(options.headers),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const error = new Error(errData.error || `Error putting to ${endpoint}`);
      error.response = errData;
      error.status = res.status;
      throw error;
    }
    return res.json();
  },
  delete: async (endpoint, options = {}) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getHeaders(options.headers),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const error = new Error(errData.error || `Error deleting ${endpoint}`);
      error.response = errData;
      error.status = res.status;
      throw error;
    }
    return res.json();
  },
};
