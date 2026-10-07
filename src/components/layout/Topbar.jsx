import { Sun, Moon, DollarSign, Menu, Users, Store, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useTenant } from '../../context/TenantContext';
import { useState } from 'react';
import './Topbar.css';

export default function Topbar({ collapsed, onMenuToggle }) {
  const { user, switchUser, logout } = useAuth();
  const { settings, updateSettings, logAuditAction } = useApp();
  const { tenantInfo, tenantSlug } = useTenant();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const toggleTheme = () => updateSettings({ tema: settings.tema === 'dark' ? 'light' : 'dark' });
  const toggleMoneda = () => updateSettings({ moneda: settings.moneda === 'CRC' ? 'USD' : 'CRC' });

  const handleSwitchUser = () => {
    logAuditAction('CAMBIO_USUARIO', `Usuario ${user?.nombre || ''} cerró sesión / cambió turno.`);
    switchUser();
  };

  const handleLogout = () => {
    logAuditAction('CERRAR_SESION', `Usuario ${user?.nombre || ''} cerró sesión.`);
    logout();
    setShowUserMenu(false);
  };

  const displayName = settings?.nombreRestaurante || tenantInfo?.nombre || 'Sistema de Comandas';

  return (
    <header className={`topbar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <button className="topbar-menu-btn" onClick={onMenuToggle}>
        <Menu size={20} />
      </button>

      <div className="topbar-center">
        <span className="topbar-title">{displayName}</span>
        {tenantSlug && (
          <span style={{
            fontSize: '0.75rem',
            background: 'rgba(231, 164, 31, 0.15)',
            color: '#E7A41F',
            padding: '2px 8px',
            borderRadius: '12px',
            marginLeft: '8px',
            border: '1px solid rgba(231, 164, 31, 0.3)',
            fontWeight: 500
          }}>
            /{tenantSlug}
          </span>
        )}
      </div>

      <div className="topbar-actions">
        {/* Currency toggle */}
        <button className="topbar-btn" onClick={toggleMoneda} title="Cambiar moneda">
          <DollarSign size={16} />
          <span className="topbar-btn-label">{settings.moneda}</span>
        </button>

        {/* Theme toggle */}
        <button className="topbar-btn" onClick={toggleTheme} title="Cambiar tema">
          {settings.tema === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Quick Switch User Button */}
        <button
          className="topbar-btn btn-switch-user"
          onClick={handleSwitchUser}
          title="Cambiar de usuario / Turno"
          style={{ background: 'var(--accent)', color: '#ffffff', border: 'none', fontWeight: 600 }}
        >
          <Users size={16} />
          <span className="topbar-btn-label">Cambiar Turno</span>
        </button>

        {/* User */}
        <div className="topbar-user">
          <div 
            className="topbar-avatar" 
            style={{ background: '#1494A4' }}
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            {user?.nombre?.charAt(0) || '?'}
          </div>
          <div className="topbar-user-info" onClick={() => setShowUserMenu(!showUserMenu)}>
            <span className="topbar-user-name">{user?.nombre}</span>
            <span className="topbar-user-role">{user?.rolNombre}</span>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setShowUserMenu(!showUserMenu)} />
          
          {/* User Dropdown Menu */}
          {showUserMenu && (
            <div className="topbar-user-menu">
              <button className="topbar-menu-item" onClick={handleLogout}>
                <LogOut size={16} />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
