import { useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { TenantProvider, useTenant } from './context/TenantContext';
import { RolesProvider } from './context/RolesContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';

// Lazy loading de páginas para mejorar performance
const LandingPortal = lazy(() => import('./pages/LandingPortal'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Mesas = lazy(() => import('./pages/Mesas'));
const Delivery = lazy(() => import('./pages/Delivery'));
const ListaPedidos = lazy(() => import('./pages/Pedidos/ListaPedidos'));
const DetallePedido = lazy(() => import('./pages/Pedidos/DetallePedido'));
const ColaComandas = lazy(() => import('./pages/ColaComandas'));
const Facturacion = lazy(() => import('./pages/Facturacion'));
const Clientes = lazy(() => import('./pages/Clientes'));
const Productos = lazy(() => import('./pages/Productos'));
const Categorias = lazy(() => import('./pages/Categorias'));
const Usuarios = lazy(() => import('./pages/Usuarios'));
const MetodosPago = lazy(() => import('./pages/MetodosPago'));
const Configuracion = lazy(() => import('./pages/Configuracion'));
const Reportes = lazy(() => import('./pages/Reportes'));

import './styles/globals.css';

// Componente de loading para Suspense
function PageLoader() {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid var(--border)',
        borderTop: '3px solid var(--accent)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <p style={{ color: 'var(--text-secondary)' }}>Cargando...</p>
    </div>
  );
}

// Redirección al módulo inicial según el rol del usuario
function RoleRedirect() {
  const { user } = useAuth();
  const { tenantPath } = useTenant();
  if (!user) return <Navigate to={tenantPath('/login')} replace />;
  const homeByRole = { Admin: '/dashboard', Mesero: '/mesas', Cocina: '/cocina', Cajero: '/pedidos' };
  const target = homeByRole[user.rolNombre] || '/login';
  return <Navigate to={tenantPath(target)} replace />;
}

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <Topbar collapsed={collapsed} onMenuToggle={() => setCollapsed(v => !v)} />
      <main className={`main-content ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <Outlet />
      </main>
    </>
  );
}

function TenantWrapper() {
  return (
    <TenantProvider>
      <RolesProvider>
        <Outlet />
      </RolesProvider>
    </TenantProvider>
  );
}

function TenantRoutes() {
  const { tenantPath } = useTenant();

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<RoleRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard"     element={<ProtectedRoute roles={['Admin']}><Dashboard /></ProtectedRoute>} />
          <Route path="/mesas"         element={<ProtectedRoute roles={['Admin','Mesero']}><Mesas /></ProtectedRoute>} />
          <Route path="/delivery"      element={<ProtectedRoute roles={['Admin','Mesero','Cajero']}><Delivery /></ProtectedRoute>} />
          <Route path="/pedidos"       element={<ProtectedRoute roles={['Admin','Mesero','Cajero']}><ListaPedidos /></ProtectedRoute>} />
          <Route path="/pedidos/:id"   element={<ProtectedRoute roles={['Admin','Mesero','Cajero']}><DetallePedido /></ProtectedRoute>} />
          <Route path="/cocina"        element={<ProtectedRoute roles={['Admin','Cocina']}><ColaComandas /></ProtectedRoute>} />
          <Route path="/facturacion"   element={<ProtectedRoute roles={['Admin','Cajero']}><Facturacion /></ProtectedRoute>} />
          <Route path="/clientes"      element={<ProtectedRoute roles={['Admin','Mesero']}><Clientes /></ProtectedRoute>} />
          <Route path="/productos"     element={<ProtectedRoute roles={['Admin']}><Productos /></ProtectedRoute>} />
          <Route path="/categorias"    element={<ProtectedRoute roles={['Admin']}><Categorias /></ProtectedRoute>} />
          <Route path="/usuarios"      element={<ProtectedRoute roles={['Admin']}><Usuarios /></ProtectedRoute>} />
          <Route path="/metodos-pago"  element={<ProtectedRoute roles={['Admin']}><MetodosPago /></ProtectedRoute>} />
          <Route path="/reportes"      element={<ProtectedRoute roles={['Admin']}><Reportes /></ProtectedRoute>} />
          <Route path="/configuracion" element={<ProtectedRoute roles={['Admin']}><Configuracion /></ProtectedRoute>} />
          <Route path="/no-autorizado" element={
            <div className="page-container" style={{ textAlign:'center', paddingTop:80 }}>
              <h2 style={{ color:'var(--danger)' }}>🚫 Acceso no autorizado</h2>
              <p style={{ color:'var(--text-secondary)', marginTop:8 }}>No tenés permisos para ver esta página.</p>
            </div>
          } />
          <Route path="*" element={<Navigate to={tenantPath('/')} replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <AppProvider>
          <Toaster position="top-right" toastOptions={{
            style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
            success: { iconTheme: { primary: 'var(--success)', secondary: '#fff' } },
            error:   { iconTheme: { primary: 'var(--danger)',  secondary: '#fff' } },
          }} />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Landing / Portal de acceso para seleccionar o ingresar soda */}
              <Route path="/" element={<LandingPortal />} />

              {/* Rutas con Tenant Slug: ej /sodalatica/login, /sodalatica/dashboard */}
              <Route path="/:tenantSlug/*" element={<TenantWrapper />}>
                <Route path="*" element={<TenantRoutes />} />
              </Route>

              {/* Redirecciones de conveniencia hacia el tenant por defecto (sodalatica) */}
              <Route path="/login"       element={<Navigate to="/sodalatica/login" replace />} />
              <Route path="/dashboard"   element={<Navigate to="/sodalatica/dashboard" replace />} />
              <Route path="/mesas"       element={<Navigate to="/sodalatica/mesas" replace />} />
              <Route path="/pedidos"     element={<Navigate to="/sodalatica/pedidos" replace />} />
              <Route path="/facturacion" element={<Navigate to="/sodalatica/facturacion" replace />} />
              <Route path="*"            element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
