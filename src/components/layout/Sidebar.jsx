import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, UtensilsCrossed, ShoppingBag, Users, Package,
  Tag, FileText, CreditCard, Settings, ChefHat, Receipt, ChevronLeft,
  ChevronRight, LogOut, ClipboardList
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import './Sidebar.css';

const NAV_ITEMS = {
  Admin:   [
    { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/mesas',        icon: UtensilsCrossed,  label: 'Mesas' },
    { to: '/delivery',     icon: ShoppingBag,      label: 'Delivery' },
    { to: '/pedidos',      icon: ClipboardList,    label: 'Pedidos' },
    { to: '/productos',    icon: Package,          label: 'Productos' },
    { to: '/categorias',   icon: Tag,              label: 'Categorías' },
    { to: '/clientes',     icon: Users,            label: 'Clientes' },
    { to: '/facturacion',  icon: Receipt,          label: 'Facturación' },
    { to: '/usuarios',     icon: Users,            label: 'Usuarios' },
    { to: '/metodos-pago', icon: CreditCard,       label: 'Métodos de Pago' },
    { to: '/reportes',     icon: FileText,         label: 'Reportes' },
    { to: '/configuracion',icon: Settings,         label: 'Configuración' },
  ],
  Mesero: [
    { to: '/mesas',   icon: UtensilsCrossed, label: 'Mesas' },
    { to: '/delivery',icon: ShoppingBag,     label: 'Delivery' },
    { to: '/pedidos', icon: ClipboardList,   label: 'Mis Pedidos' },
    { to: '/clientes',icon: Users,           label: 'Clientes' },
  ],
  Cocina: [
    { to: '/cocina', icon: ChefHat, label: 'Cola de Comandas' },
  ],
  Cajero: [
    { to: '/delivery',    icon: ShoppingBag,   label: 'Delivery' },
    { to: '/pedidos',     icon: ClipboardList, label: 'Pedidos' },
    { to: '/facturacion', icon: Receipt,        label: 'Facturación' },
  ],
};

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth();
  const { settings } = useApp();
  const items = NAV_ITEMS[user?.rolNombre] || [];

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        {!collapsed && (
          <div className="logo-text">
            <span className="logo-icon">🍽️</span>
            <div>
              <div className="logo-name">{settings.nombreRestaurante}</div>
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
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon size={18} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <button className="logout-btn" onClick={logout}>
        <LogOut size={18} />
        {!collapsed && <span>Cerrar Sesión</span>}
      </button>
    </aside>
  );
}
