import { createContext, useContext, useState, useEffect } from 'react';
import { storage } from '../services/storageService';
import { api } from '../services/apiService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session
    const session = storage.get('session');
    if (session) setUser(session);
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      const data = await api.post('/auth/login', { username, password });
      // data contains the user and rolNombre
      const session = { ...data, rolNombre: data.nombreRol }; // Our React app uses user.rolNombre
      storage.set('session', session);
      setUser(session);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: 'Usuario o contraseña incorrectos' };
    }
  };

  const logout = () => {
    storage.remove('session');
    setUser(null);
  };

  const hasRole = (...roles) => roles.includes(user?.rolNombre);

  return (
    <AuthContext.Provider value={{ user, login, logout, hasRole, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
