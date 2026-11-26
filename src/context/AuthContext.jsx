import { logError, logWarning } from '../services/loggerService';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/apiService';


// localStorage helper SOLO para datos no sensibles (nunca tokens, sesión, ni datos de usuario)
const storage = {
  get: (key) => {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    } catch { return null; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
  remove: (key) => { localStorage.removeItem(key); },
};

// Limpiar datos sensibles de localStorage al cargar (migración de seguridad)
function cleanupSensitiveLocalStorage() {
  const sensitiveKeys = ['session', 'comandas_detalles_servidos'];
  sensitiveKeys.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch {}
  });
}


const ROLE_ROUTES = {
  'Admin': ['/dashboard', '/mesas', '/delivery', '/pedidos', '/productos', '/categorias', '/clientes', '/facturacion', '/usuarios', '/roles', '/metodos-pago', '/reportes', '/configuracion', '/cocina'],
  'Mesero': ['/dashboard', '/mesas', '/delivery', '/pedidos', '/clientes', '/facturacion'],
  'Cocina': ['/dashboard', '/cocina'],
  'Cajero': ['/dashboard', '/facturacion', '/metodos-pago', '/reportes'],
  'Gerente': ['/dashboard', '/mesas', '/delivery', '/pedidos', '/productos', '/categorias', '/clientes', '/facturacion', '/metodos-pago', '/reportes', '/configuracion']
};

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos de inactividad (reducido de 60 min)
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 horas máximo de sesión

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Limpiar datos sensibles de localStorage (migración de seguridad)
    cleanupSensitiveLocalStorage();

    // Validar sesión con el backend vía HttpOnly cookie (sin localStorage)
    const validateSession = async () => {
      try {
        const res = await api.get('/auth/me');
        if (res && res.id) {
          const rolName = res.nombreRol || res.rolNombre;
          const verified = {
            id: res.id,
            username: res.username,
            nombre: res.nombre,
            email: res.email,
            rolId: res.rolId,
            nombreRol: rolName,
            rolNombre: rolName,
            puedeCancelarServido: res.puedeCancelarServido,
            foto: res.foto || null,
            rutas: res.rutas || ROLE_ROUTES[rolName] || ['/dashboard'],
            tenantSlug: res.tenantSlug,
            createdAt: Date.now()
          };

          if (isMounted) {
            setUser(verified);
          }
        }
      } catch (err) {
        // Si el servidor indica que el token expiró, no es válido o usuario inactivo
        if (err.status === 401 || err.statusCode === 401) {
          console.warn('Sesión no autorizada en servidor (/auth/me)');
          if (isMounted) {
            setUser(null);
          }
        } else {
          // Si fue error de red/servidor temporal, el usuario quedará sin sesión
          console.warn('No se pudo contactar /auth/me:', err.message);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    validateSession();

    return () => { isMounted = false; };
  }, []);

  // Monitor de inactividad de 60 minutos
  useEffect(() => {
    if (!user) return;

    let timeoutId;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.log('Sesión expirada por inactividad (60 min)');
        logout();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(ev => window.addEventListener(ev, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(ev => window.removeEventListener(ev, resetTimer));
    };
  }, [user]);

  // Obtener lista pública de empleados para la grilla visual
  const getPublicUsers = async () => {
    try {
      const dbUsers = await api.get('/auth/users-public');
      if (Array.isArray(dbUsers) && dbUsers.length > 0) {
        return dbUsers;
      }
      return [];
    } catch (err) {
      logError(err, { context: 'AuthContext_fetchUsuarios' });
      throw err;
    }
  };

  // Login con PIN numérico de 4 dígitos
  const loginWithPin = async (userId, pin) => {
    try {
      const data = await api.post('/auth/login-pin', { userId, pin });
      const rolName = data.nombreRol || data.rolNombre;
      // Solo mantener en memoria (NO localStorage)
      const session = {
        id: data.id,
        username: data.username,
        nombre: data.nombre,
        email: data.email,
        rolId: data.rolId,
        nombreRol: rolName,
        rolNombre: rolName,
        puedeCancelarServido: data.puedeCancelarServido,
        rutas: data.rutas || ROLE_ROUTES[rolName] || ['/dashboard'],
        tenantSlug: data.tenantSlug,
        createdAt: Date.now()
      };
      setUser(session);

      if (data.licenseExpiringSoon) {
        import('sweetalert2').then(({ default: Swal }) => {
          Swal.fire({
            title: 'Licencia por expirar',
            text: `Su licencia vencerá en ${data.daysUntilExpiration} día(s). Por favor renueve pronto.`,
            icon: 'warning',
            timer: 10000,
            timerProgressBar: true,
            showConfirmButton: true,
            confirmButtonText: 'Entendido'
          });
        });
      }

      return { ok: true, user: session };
    } catch (err) {
      const res = err.response || {};
      return {
        ok: false,
        error: res.error || err.message || 'PIN incorrecto',
        locked: !!res.locked,
        lockSeconds: res.lockSeconds || 0,
        attemptsLeft: res.attemptsLeft !== undefined ? res.attemptsLeft : null,
        blocked: !!res.blocked,
        contact: res.contact || null
      };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Si el servidor falla o ya expiró, continuar cerrando localmente
    }
    setUser(null);
  };

  const switchUser = () => {
    logout();
  };

  const hasRole = (...roles) => {
    const rolName = user?.rolNombre || user?.nombreRol;
    return roles.includes(rolName);
  };

  // Validación 100% en memoria de permisos de ruta (síncrona, sin peticiones de red)
  const canAccess = (ruta) => {
    if (!user) return false;
    const rolName = user.rolNombre || user.nombreRol;
    if (rolName === 'Admin') return true;
    if (!user.rutas || !Array.isArray(user.rutas)) return false;
    return user.rutas.some(r => ruta === r || ruta.startsWith(r + '/'));
  };

  // Actualizar las rutas en memoria si el admin edita su propio rol
  const updateCurrentUserRoutes = (newRoutes) => {
    setUser(prev => {
      if (!prev) return prev;
      return { ...prev, rutas: newRoutes };
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      loginWithPin,
      getPublicUsers,
      logout,
      switchUser,
      hasRole,
      canAccess,
      updateCurrentUserRoutes,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
