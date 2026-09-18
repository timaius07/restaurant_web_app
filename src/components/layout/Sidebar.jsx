import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, UtensilsCrossed, ShoppingBag, Users, Package,
  Tag, FileText, CreditCard, Settings, ChefHat, Receipt, ChevronLeft,
  ChevronRight, LogOut, ClipboardList
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useTenant } from '../../context/TenantContext';
import './Sidebar.css';

const ROUTE_CONFIG = {
  '/dashboard':    { icon: LayoutDashboard, label: 'Dashboard' },
  '/mesas':        { icon: UtensilsCrossed, label: 'Mesas' },
  '/delivery':     { icon: ShoppingBag,     label: 'Delivery' },
  '/pedidos':      { icon: ClipboardList,   label: 'Pedidos' },
  '/productos':    { icon: Package,         label: 'Productos' },
  '/categorias':   { icon: Tag,             label: 'Categorías' },
  '/clientes':     { icon: Users,           label: 'Clientes' },
  '/facturacion':  { icon: Receipt,         label: 'Facturación' },
  '/usuarios':     { icon: Users,           label: 'Usuarios' },
  '/metodos-pago': { icon: CreditCard,      label: 'Métodos de Pago' },
  '/reportes':     { icon: FileText,        label: 'Reportes' },
  '/configuracion':{ icon: Settings,        label: 'Configuración' },
  '/cocina':       { icon: ChefHat,         label: 'Cola de Comandas' },
};

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth();
  const { settings } = useApp();
  const { tenantPath, tenantInfo } = useTenant();
  
  const items = user?.rutas?.map(ruta => {
    const config = ROUTE_CONFIG[ruta];
    if (!config) return null;
    return { to: ruta, ...config };
  }).filter(Boolean) || [];

  const restaurantName = tenantInfo?.nombre || settings.nombreRestaurante || 'Sistema de Comandas';

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        {!collapsed && (
          <div className="logo-text">
            <span className="logo-icon">🍽️</span>
            <div>
              <div className="logo-name">{restaurantName}</div>
              <div className="logo-sub">Sistema de Comandas</div>
            </div>
          </div>
        )}
        {collapsed && <span className="logo-icon-only">🍽️</span>}
        <button className="collapse-btn" onClick={onToggle}>
          {collapsed ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
        </button>
      </div>

      {/* User chip */}
      <div className={`user-chip ${collapsed ? 'collapsed' : ''}`}>
        <div className="user-avatar">{user?.nombre?.charAt(0) || '?'}</div>
        {!collapsed && (
          <div className="user-info">
            <div className="user-name">{user?.nombre}</div>
            <div className="user-role">{user?.rolNombre}</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {items.map(({ to, icon: Icon, label }) => {
          const destination = tenantPath(to);
          return (
            <NavLink
              key={to}
              to={destination}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Logout */}
      <button className="logout-btn" onClick={logout}>
        <LogOut size={18} />
        {!collapsed && <span>Cerrar Sesión</span>}
      </button>
    </aside>
  );
}
