import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import './AccessDenied.css';

export default function AccessDenied({ ruta, rolRequerido }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { tenantPath } = useTenant();

  // Calcular ruta predeterminada autorizada para el botón de regreso
  const homeByRole = {
    Admin: '/dashboard',
    Mesero: '/mesas',
    Cocina: '/cocina',
    Cajero: '/pedidos',
  };

  const defaultHome = user?.rutas && user.rutas.length > 0
    ? user.rutas[0]
    : (homeByRole[user?.rolNombre] || '/dashboard');

  const attemptedPath = ruta || location.pathname;

  return (
    <div className="access-denied-container animate-fade">
      <div className="access-denied-card">
        <div className="access-denied-icon-wrapper">
          <ShieldAlert size={48} className="access-denied-icon" />
        </div>

        <span className="access-denied-code">ERROR 403 — PROHIBIDO</span>
        <h1 className="access-denied-title">Acceso no autorizado</h1>

        <p className="access-denied-desc">
          Tu cuenta <strong>{user?.nombre || user?.username}</strong> con rol{' '}
          <span className="access-denied-role-badge">{user?.rolNombre || 'Usuario'}</span>{' '}
          no tiene los permisos necesarios para ingresar a este sector del sistema.
        </p>

        <div className="access-denied-path-box">
          <span className="access-denied-path-label">Ruta restringida:</span>
          <code className="access-denied-path-code">{attemptedPath}</code>
        </div>

        <p className="access-denied-hint">
          Si consideras que deberías tener acceso a este módulo, por favor comunícate con el Administrador para que habilite la casilla correspondiente en la configuración de roles.
        </p>

        <div className="access-denied-actions">
          <button
            type="button"
            className="btn btn-primary access-denied-btn"
            onClick={() => navigate(tenantPath(defaultHome))}
          >
            <ArrowLeft size={16} />
            <span>Volver a mi área autorizada</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary access-denied-btn"
            onClick={logout}
          >
            <LogOut size={16} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
    </div>
  );
}
