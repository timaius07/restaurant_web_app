import { createContext, useContext, useState, useEffect } from 'react';
import { storage } from '../services/storageService';
import { USUARIOS, ROLES } from '../data/seedData';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Init users if not present
    if (!storage.get('usuarios')) storage.set('usuarios', USUARIOS);
    if (!storage.get('roles')) storage.set('roles', ROLES);
    // Restore session
    const session = storage.get('session');
    if (session) setUser(session);
    setLoading(false);
  }, []);

  const login = (username, password) => {
    const usuarios = storage.get('usuarios') || USUARIOS;
    const found = usuarios.find(u => u.username === username && u.passwordHash === password);
    if (!found) return { ok: false, error: 'Usuario o contraseña incorrectos' };
    const roles = storage.get('roles') || ROLES;
    const rol = roles.find(r => r.id === found.rolId);
    const session = { ...found, rolNombre: rol?.nombreRol || '' };
    storage.set('session', session);
    setUser(session);
    return { ok: true };
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
