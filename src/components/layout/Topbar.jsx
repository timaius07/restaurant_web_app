import { Sun, Moon, DollarSign, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import './Topbar.css';

export default function Topbar({ collapsed, onMenuToggle }) {
  const { user } = useAuth();
  const { settings, updateSettings } = useApp();

  const toggleTheme = () => updateSettings({ tema: settings.tema === 'dark' ? 'light' : 'dark' });
  const toggleMoneda = () => updateSettings({ moneda: settings.moneda === 'CRC' ? 'USD' : 'CRC' });

  return (
    <header className={`topbar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <button className="topbar-menu-btn" onClick={onMenuToggle}>
        <Menu size={20} />
      </button>

      <div className="topbar-center">
        <span className="topbar-title">{settings.nombreRestaurante}</span>
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

        {/* User */}
        <div className="topbar-user">
          <div className="topbar-avatar">{user?.nombre?.charAt(0) || '?'}</div>
          <div className="topbar-user-info">
            <span className="topbar-user-name">{user?.nombre}</span>
            <span className="topbar-user-role">{user?.rolNombre}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
