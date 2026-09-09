import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storage } from '../services/storageService';
import { api } from '../services/apiService';
import { USUARIOS, ROLES } from '../data/seedData';

const AuthContext = createContext(null);

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutos de inactividad

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restaurar sesión guardada
    const session = storage.get('session');
    if (session) setUser(session);
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
    } catch (err) {
      console.warn('API backend no disponible para lista de usuarios, utilizando datos de respaldo:', err);
    }
    // Respaldo local en caso de desconexión
    const localUsers = storage.get('usuarios') || USUARIOS;
    return localUsers.map(u => {
      const rol = ROLES.find(r => String(r.id) === String(u.rolId));
      return {
        id: u.id,
        username: u.username,
        nombre: u.nombre,
        email: u.email,
        rolId: u.rolId,
        nombreRol: rol?.nombreRol || 'Empleado',
        puedeCancelarServido: !!u.puedeCancelarServido
      };
    });
  };

  // Login con PIN numérico de 4 dígitos
  const loginWithPin = async (userId, pin) => {
    try {
      const data = await api.post('/auth/login-pin', { userId, pin });
      const session = { ...data, rolNombre: data.nombreRol };
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
      const session = { ...data, rolNombre: data.nombreRol };
      storage.set('session', session);
      setUser(session);
      return { ok: true, user: session };
    } catch (err) {
      // Intentar autenticación fallback con datos locales
      const localUsers = storage.get('usuarios') || USUARIOS;
      const found = localUsers.find(
        u => u.username.toLowerCase() === username.toLowerCase() &&
        (u.passwordHash === password || u.pinHash === password)
      );
      if (found) {
        const rol = ROLES.find(r => String(r.id) === String(found.rolId));
        const session = { ...found, nombreRol: rol?.nombreRol || 'Empleado', rolNombre: rol?.nombreRol || 'Empleado' };
        storage.set('session', session);
        setUser(session);
        return { ok: true, user: session };
      }
      return { ok: false, error: err.message || 'Usuario o contraseña incorrectos' };
    }
  };

  const logout = () => {
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
