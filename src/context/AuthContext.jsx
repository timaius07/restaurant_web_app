import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/apiService';


// Temporal: localStorage helper hasta implementar cookies HttpOnly
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

// Mapeo de roles a rutas permitidas
const ROLE_ROUTES = {
  'Admin': ['/dashboard', '/mesas', '/delivery', '/pedidos', '/productos', '/categorias', '/clientes', '/facturacion', '/usuarios', '/metodos-pago', '/reportes', '/configuracion', '/cocina'],
  'Mesero': ['/dashboard', '/mesas', '/delivery', '/pedidos', '/clientes', '/facturacion'],
  'Cocina': ['/dashboard', '/cocina'],
  'Cajero': ['/dashboard', '/facturacion', '/metodos-pago', '/reportes'],
  'Gerente': ['/dashboard', '/mesas', '/delivery', '/pedidos', '/productos', '/categorias', '/clientes', '/facturacion', '/metodos-pago', '/reportes', '/configuracion']
};

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutos de inactividad

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restaurar sesión guardada
    const session = storage.get('session');
    if (session) {
      // Asegurar que la sesión restaurada tenga rutas
      if (!session.rutas && session.rolNombre) {
        session.rutas = ROLE_ROUTES[session.rolNombre] || ['/dashboard'];
        storage.set('session', session);
      }
      setUser(session);
    }
    setLoading(false);
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
      console.error('Error al obtener lista de usuarios:', err);
      throw err;
    }
  };

  // Login con PIN numérico de 4 dígitos
  const loginWithPin = async (userId, pin) => {
    try {
      const data = await api.post('/auth/login-pin', { userId, pin });
      const session = { 
        ...data, 
        rolNombre: data.nombreRol,
        rutas: ROLE_ROUTES[data.nombreRol] || ['/dashboard'] // Agregar rutas según rol
      };
      storage.set('session', session);
      setUser(session);
      return { ok: true, user: session };
    } catch (err) {
      // Manejar respuestas de rate-limiting (bloqueo por intentos fallidos)
      const res = err.response || {};
      return {
        ok: false,
        error: err.message || 'PIN incorrecto',
        locked: !!res.locked,
        lockSeconds: res.lockSeconds || 0,
        attemptsLeft: res.attemptsLeft !== undefined ? res.attemptsLeft : null
      };
    }
  };

  // Login tradicional con usuario y contraseña
  const login = async (username, password) => {
    try {
      const data = await api.post('/auth/login', { username, password });
      const session = { 
        ...data, 
        rolNombre: data.nombreRol,
        rutas: ROLE_ROUTES[data.nombreRol] || ['/dashboard'] // Agregar rutas según rol
      };
      storage.set('session', session);
      setUser(session);
      return { ok: true, user: session };
    } catch (err) {
      return { ok: false, error: err.message || 'Usuario o contraseña incorrectos' };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Si el servidor falla o ya expiró, continuar cerrando localmente
    }
    storage.remove('session');
    setUser(null);
  };

  const switchUser = () => {
    logout();
  };

  const hasRole = (...roles) => roles.includes(user?.rolNombre);

  return (
    <AuthContext.Provider value={{
      user,
      login,
      loginWithPin,
      getPublicUsers,
      logout,
      switchUser,
      hasRole,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
