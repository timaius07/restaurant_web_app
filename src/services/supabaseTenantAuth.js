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

/**
 * Login de soda directamente con Supabase Auth (sin intermediario)
 * El password viaja encriptado vía TLS/HTTPS directamente a Supabase.
 * El backend nunca ve la contraseña y la sesión se autentica mediante JWT.
 * 
 * @param {string} slug - Slug o email de la soda
 * @param {string} password - Contraseña de la soda
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
async function loginSoda(slug, password) {
  try {
    const cleanSlug = slug.trim().toLowerCase();
    
    // Convención Opción A: email del tenant basado en su slug (${slug}@sodas.com)
    // Si ya incluye @ (por ejemplo marvicamvar@gmail.com), se usa directamente
    const email = cleanSlug.includes('@') ? cleanSlug : `${cleanSlug}@sodas.com`;

    let { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    // Fallback de compatibilidad: si es sodademo y está registrado con su correo personal
    if (error && (cleanSlug === 'sodademo' || email === 'sodademo@sodas.com')) {
      const fallback = await supabase.auth.signInWithPassword({
        email: 'marvicamvar@gmail.com',
        password
      });
      if (!fallback.error) {
        data = fallback.data;
        error = null;
      }
    }

    if (error) {
      logWarning('Error en Supabase signInWithPassword: ' + error.message, { context: 'supabase_auth' });
      return { success: false, error: 'Credenciales inválidas' };
    }

    const user = data.user;
    const session = data.session;
    const userMetadata = user?.user_metadata || {};
    const appMetadata = user?.app_metadata || {};

    const tenantSlug = userMetadata.tenant_slug || appMetadata.tenant_slug || cleanSlug;
    const dbSchema = userMetadata.db_schema || appMetadata.db_schema || `soda_${tenantSlug.replace(/-/g, '_')}`;
    const nombre = userMetadata.nombre || appMetadata.nombre || tenantSlug;

    return {
      success: true,
      data: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        tenant: {
          slug: tenantSlug,
          db_schema: dbSchema,
          nombre: nombre
        }
      }
    };
  } catch (error) {
    logError(error, { context: 'supabase_loginSoda' });
    return { success: false, error: error.message || 'Error de conexión' };
  }
}

/**
 * Refresca el token de una soda directamente en Supabase
 * @param {string} refreshToken - Token de refresh
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
async function refreshToken(refreshTokenStr) {
  try {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshTokenStr
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const session = data.session;
    if (typeof window !== 'undefined') {
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

    return {
      success: true,
      data: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in
      }
    };
  } catch (error) {
    logError(error, { context: 'supabase_refreshToken' });
    return { success: false, error: error.message || 'Error de conexión' };
  }
}

/**
 * Logout de una soda directamente en Supabase
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function logoutSoda() {
  try {
    const { error } = await supabase.auth.signOut();
    clearSession();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    logError(error, { context: 'supabase_logoutSoda' });
    clearSession();
    return { success: false, error: error.message || 'Error de conexión' };
  }
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
 * Guarda la sesión de soda en localStorage
 * @param {object} session - Datos de la sesión
 */
function saveSession(session) {
  localStorage.setItem('tenant_session', JSON.stringify(session));
}

/**
 * Obtiene la sesión de soda desde localStorage
 * @returns {object|null}
 */
function getSession() {
  const session = localStorage.getItem('tenant_session');
  return session ? JSON.parse(session) : null;
}

/**
 * Limpia la sesión de soda de localStorage
 */
function clearSession() {
  localStorage.removeItem('tenant_session');
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
