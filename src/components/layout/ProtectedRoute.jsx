import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const { tenantPath } = useTenant();

  if (loading) return null;
  if (!user) return <Navigate to={tenantPath('/login')} replace />;
  if (roles && !roles.includes(user.rolNombre)) return <Navigate to={tenantPath('/no-autorizado')} replace />;
  return children;
}
