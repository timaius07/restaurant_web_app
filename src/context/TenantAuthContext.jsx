import { logError, logWarning } from '../services/loggerService';
import { createContext, useContext, useState, useEffect } from 'react';
import {
  loginSoda,
  refreshToken,
  logoutSoda,
  saveSession,
  getSession,
  clearSession
} from '../services/supabaseTenantAuth';

const TenantAuthContext = createContext(null);

export function TenantAuthProvider({ children }) {
  const [tenantSession, setTenantSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar sesión al montar el componente
  useEffect(() => {
    const session = getSession();
    if (session) {
      setTenantSession(session);
    }
    setLoading(false);
  }, []);

  // Listener para refrescar token antes de expirar
  useEffect(() => {
    if (!tenantSession) return;

    const refreshTokenBeforeExpiry = async () => {
      try {
        const result = await refreshToken(tenantSession.refresh_token);
        if (result.success) {
          const newSession = {
            access_token: result.data.access_token,
            refresh_token: result.data.refresh_token,
            expires_in: result.data.expires_in,
            tenant: tenantSession.tenant
          };
          saveSession(newSession);
          setTenantSession(newSession);
        } else {
          // Si falla el refresh, hacer logout
          await handleLogout();
        }
      } catch (err) {
        logError(err, { context: 'TenantAuthContext_refreshToken' });
        await handleLogout();
      }
    };

    // Refrescar token 5 minutos antes de expirar
    const refreshInterval = setInterval(() => {
      refreshTokenBeforeExpiry();
    }, (tenantSession.expires_in - 300) * 1000); // 5 minutos antes

    return () => clearInterval(refreshInterval);
  }, [tenantSession]);

  const handleLogin = async (slug, password) => {
    setLoading(true);
    setError(null);

    try {
      const result = await loginSoda(slug, password);

      if (!result.success) {
        setError(result.error);
        return { success: false, error: result.error };
      }

      const session = {
        access_token: result.data.access_token,
        refresh_token: result.data.refresh_token,
        expires_in: result.data.expires_in,
        tenant: result.data.tenant
      };

      saveSession(session);
      setTenantSession(session);

      return { success: true, tenant: result.data.tenant };
    } catch (err) {
      const errorMessage = 'Error de conexión';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutSoda();
    } catch (err) {
      logError(err, { context: 'TenantAuthContext_logout' });
    } finally {
      clearSession();
      setTenantSession(null);
      setError(null);
    }
  };

  const value = {
    tenantSession,
    loading,
    error,
    loginSoda: handleLogin,
    logoutSoda: handleLogout,
    isAuthenticated: !!tenantSession
  };

  return (
    <TenantAuthContext.Provider value={value}>
      {children}
    </TenantAuthContext.Provider>
  );
}

export function useTenantAuth() {
  const context = useContext(TenantAuthContext);
  if (!context) {
    throw new Error('useTenantAuth debe usarse dentro de TenantAuthProvider');
  }
  return context;
}
