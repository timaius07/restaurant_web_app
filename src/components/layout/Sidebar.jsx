import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, UtensilsCrossed, ShoppingBag, Users, Package,
  Tag, FileText, CreditCard, Settings, ChefHat, Receipt, ChevronLeft,
  ChevronRight, LogOut, ClipboardList, KeyRound
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useTenant } from '../../context/TenantContext';
import iconoTicoMenu from '../../assets/icono-ticomenu-ls.png';
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
  '/roles':        { icon: KeyRound,        label: 'Roles y Permisos' },
  '/metodos-pago': { icon: CreditCard,      label: 'Métodos de Pago' },
  '/reportes':     { icon: FileText,        label: 'Reportes' },
  '/configuracion':{ icon: Settings,        label: 'Configuración' },
  '/cocina':       { icon: ChefHat,         label: 'Cola de Comandas' },
};

// Orden fijo de navegación (independiente del orden en BD)
const FIXED_ROUTE_ORDER = [
  '/dashboard',
  '/mesas',
  '/delivery',
  '/pedidos',
  '/productos',
  '/categorias',
  '/clientes',
  '/facturacion',
  '/usuarios',
  '/roles',
  '/metodos-pago',
  '/reportes',
  '/configuracion',
  '/cocina',
];

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth();
  const { settings } = useApp();
  const { tenantPath, tenantInfo } = useTenant();
  
  // Generar items usando el orden fijo predefinido
  const userRutasSet = new Set(user?.rutas || []);
  const items = FIXED_ROUTE_ORDER
    .filter(ruta => userRutasSet.has(ruta) && ROUTE_CONFIG[ruta])
    .map(ruta => {
      const config = ROUTE_CONFIG[ruta];
      if (!config) return null;
      return { to: ruta, ...config };
    })
    .filter(Boolean);

  const restaurantName = settings?.nombreRestaurante || tenantInfo?.nombre || 'Sistema de Comandas';

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        {!collapsed && (
          <div className="logo-text">
            <img src={iconoTicoMenu} alt="TicoMenu" className="logo-icon-img" />
            <div>
              <div className="logo-name">{restaurantName}</div>
              <div className="logo-sub">Sistema de Comandas</div>
            </div>
          </div>
        )}
        {collapsed && (
          <img src={iconoTicoMenu} alt="TicoMenu" className="logo-icon-img logo-icon-only-img" />
        )}
        <button className="collapse-btn" onClick={onToggle}>
          {collapsed ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
        </button>
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
