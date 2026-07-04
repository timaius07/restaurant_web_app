import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';

// Pages
import Login         from './pages/Login';
import Dashboard     from './pages/Dashboard';
import Mesas         from './pages/Mesas';
import Delivery      from './pages/Delivery';
import ListaPedidos  from './pages/Pedidos/ListaPedidos';
import DetallePedido from './pages/Pedidos/DetallePedido';
import ColaComandas  from './pages/ColaComandas';
import Facturacion   from './pages/Facturacion';
import Clientes      from './pages/Clientes';
import Productos     from './pages/Productos';
import Categorias    from './pages/Categorias';
import Usuarios      from './pages/Usuarios';
import MetodosPago   from './pages/MetodosPago';
import Configuracion from './pages/Configuracion';
import Reportes      from './pages/Reportes';

import './styles/globals.css';

// Redirect to the correct home page based on role
function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const homeByRole = { Admin: '/dashboard', Mesero: '/mesas', Cocina: '/cocina', Cajero: '/pedidos' };
  return <Navigate to={homeByRole[user.rolNombre] || '/login'} replace />;
}

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <Topbar collapsed={collapsed} onMenuToggle={() => setCollapsed(v => !v)} />
      <main className={`main-content ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <Routes>
          <Route path="/" element={<RoleRedirect />} />
          <Route path="/dashboard"    element={<ProtectedRoute roles={['Admin']}><Dashboard /></ProtectedRoute>} />
          <Route path="/mesas"        element={<ProtectedRoute roles={['Admin','Mesero']}><Mesas /></ProtectedRoute>} />
          <Route path="/delivery"     element={<ProtectedRoute roles={['Admin','Mesero','Cajero']}><Delivery /></ProtectedRoute>} />
          <Route path="/pedidos"      element={<ProtectedRoute roles={['Admin','Mesero','Cajero']}><ListaPedidos /></ProtectedRoute>} />
          <Route path="/pedidos/:id"  element={<ProtectedRoute roles={['Admin','Mesero','Cajero']}><DetallePedido /></ProtectedRoute>} />
          <Route path="/cocina"       element={<ProtectedRoute roles={['Admin','Cocina']}><ColaComandas /></ProtectedRoute>} />
          <Route path="/facturacion"  element={<ProtectedRoute roles={['Admin','Cajero']}><Facturacion /></ProtectedRoute>} />
          <Route path="/clientes"     element={<ProtectedRoute roles={['Admin','Mesero']}><Clientes /></ProtectedRoute>} />
          <Route path="/productos"    element={<ProtectedRoute roles={['Admin']}><Productos /></ProtectedRoute>} />
          <Route path="/categorias"   element={<ProtectedRoute roles={['Admin']}><Categorias /></ProtectedRoute>} />
          <Route path="/usuarios"     element={<ProtectedRoute roles={['Admin']}><Usuarios /></ProtectedRoute>} />
          <Route path="/metodos-pago" element={<ProtectedRoute roles={['Admin']}><MetodosPago /></ProtectedRoute>} />
          <Route path="/reportes"     element={<ProtectedRoute roles={['Admin']}><Reportes /></ProtectedRoute>} />
          <Route path="/configuracion"element={<ProtectedRoute roles={['Admin']}><Configuracion /></ProtectedRoute>} />
          <Route path="/no-autorizado" element={
            <div className="page-container" style={{ textAlign:'center',paddingTop:80 }}>
              <h2 style={{ color:'var(--danger)' }}>🚫 Acceso no autorizado</h2>
              <p style={{ color:'var(--text-secondary)',marginTop:8 }}>No tenés permisos para ver esta página.</p>
            </div>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
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
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*"     element={<AppLayout />} />
          </Routes>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
