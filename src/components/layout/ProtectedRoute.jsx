import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import AccessDenied from './AccessDenied';

export default function ProtectedRoute({ children, ruta, roles }) {
  const { user, loading, canAccess } = useAuth();
  const { tenantPath } = useTenant();

  if (loading) return null;
  if (!user) return <Navigate to={tenantPath('/login')} replace />;

  // 1. Verificación por roles fijos si se especifica (ej: roles=['Admin'])
  if (roles && !roles.includes(user.rolNombre)) {
    return <AccessDenied ruta={ruta} rolRequerido={roles.join(', ')} />;
  }

  // 2. Verificación dinámica en memoria por ruta asignada (user.rutas)
  if (ruta && !canAccess(ruta)) {
    return <AccessDenied ruta={ruta} />;
  }

  return children;
}
