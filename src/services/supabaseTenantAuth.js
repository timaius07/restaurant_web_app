import { logError, logWarning } from './loggerService';
import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase desde variables de entorno (Vite + Infisical)
const supabaseUrl = 
  import.meta.env.F_SUP_URL || 
  import.meta.env.VITE_SUP_URL || 
  import.meta.env.VITE_SUPABASE_URL;

const supabaseAnonKey = 
  import.meta.env.F_SUP_ANON_PBL_KEY || 
  import.meta.env.VITE_SUP_ANON_PBL_KEY || 
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan credenciales de Supabase en las variables de entorno. Se requieren: F_SUP_URL / VITE_SUPABASE_URL y F_SUP_ANON_PBL_KEY / VITE_SUPABASE_ANON_KEY');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Listener automático de Supabase para refresh de tokens en background
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') && session) {
      const raw = localStorage.getItem('tenant_session');
      if (raw) {
        try {
          const current = JSON.parse(raw);
          current.access_token = session.access_token;
          current.refresh_token = session.refresh_token;
          current.expires_in = session.expires_in;
          localStorage.setItem('tenant_session', JSON.stringify(current));
        } catch {}
      }
    }
  });
}

const getDefaultApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:5000/api';
  }
  return '/api';
};

/**
 * Login de soda a través de la API (establece Cookie HttpOnly tenant_token con sesión segura)
 * 
 * @param {string} slug - Slug de la soda
 * @param {string} password - Contraseña de la soda
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
async function loginSoda(slug, password) {
  try {
    const cleanSlug = slug.trim().toLowerCase();
    const apiUrl = getDefaultApiUrl();

    const response = await fetch(`${apiUrl}/supabase/tenant/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ slug: cleanSlug, password })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Credenciales inválidas'
      };
    }

    return {
      success: true,
      data: {
        tenant: data.tenant
      }
    };
  } catch (error) {
    logError(error, { context: 'supabase_loginSoda' });
    return { success: false, error: error.message || 'Error de conexión con el servidor' };
  }
}

/**
 * Refresca la sesión de la soda (no-op para cookies HttpOnly de 30 días)
 */
async function refreshToken() {
  return { success: true };
}

/**
 * Cierra la sesión de la soda y limpia cookies HttpOnly
 */
async function logoutSoda() {
  try {
    const apiUrl = getDefaultApiUrl();
    await fetch(`${apiUrl}/supabase/tenant/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    }).catch(() => {});
  } catch {}
  clearSession();
  return { success: true };
}

/**
 * Cambia la contraseña de una soda en Supabase
 * @param {string} slug - Slug de la soda
 * @param {string} oldPassword - Contraseña actual
 * @param {string} newPassword - Nueva contraseña
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function changePassword(slug, oldPassword, newPassword) {
  try {
    const cleanSlug = slug.trim().toLowerCase();
    const email = cleanSlug.includes('@') ? cleanSlug : `${cleanSlug}@sodas.com`;

    // 1. Reautenticar para verificar la contraseña actual
    let authRes = await supabase.auth.signInWithPassword({
      email,
      password: oldPassword
    });

    if (authRes.error && cleanSlug === 'sodademo') {
      authRes = await supabase.auth.signInWithPassword({
        email: 'marvicamvar@gmail.com',
        password: oldPassword
      });
    }

    if (authRes.error) {
      return { success: false, error: 'La contraseña actual es incorrecta' };
    }

    // 2. Actualizar a la nueva contraseña
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error) {
    logError(error, { context: 'supabase_changePassword' });
    return { success: false, error: error.message || 'Error de conexión' };
  }
}

/**
 * Guarda metadatos no sensibles de la soda (los tokens sensibles se almacenan exclusivamente en Cookies HttpOnly)
 * @param {object} session - Datos del tenant
 */
function saveSession(session) {
  try {
    localStorage.removeItem('tenant_session');
    if (session?.tenant) {
      localStorage.setItem('tenant_meta', JSON.stringify({ tenant: session.tenant }));
    }
  } catch {}
}

/**
 * Obtiene los metadatos de la soda desde localStorage
 * @returns {object|null}
 */
function getSession() {
  try {
    localStorage.removeItem('tenant_session');
    const raw = localStorage.getItem('tenant_meta');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Limpia la sesión de soda y cualquier residuo de tokens
 */
function clearSession() {
  try {
    localStorage.removeItem('tenant_session');
    localStorage.removeItem('tenant_meta');
  } catch {}
}

export {
  loginSoda,
  refreshToken,
  logoutSoda,
  changePassword,
  saveSession,
  getSession,
  clearSession
};
