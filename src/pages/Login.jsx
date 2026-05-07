import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UtensilsCrossed, Eye, EyeOff, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
import './Login.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = login(form.username, form.password);
    if (result.ok) {
      toast.success('¡Bienvenido!');
      navigate('/');
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  const quickLogin = (username, password) => {
    setForm({ username, password });
    setTimeout(() => {
      const result = login(username, password);
      if (result.ok) navigate('/');
    }, 100);
  };

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-blob blob1"></div>
        <div className="login-blob blob2"></div>
      </div>

      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon"><UtensilsCrossed size={28} /></div>
          <h1>Sistema de Comandas</h1>
          <p>Ingresá tus credenciales para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Usuario</label>
            <input
              className="form-input"
              type="text"
              placeholder="Ej: admin"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              required autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <div className="pass-wrapper">
              <input
                className="form-input"
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
              <button type="button" className="pass-toggle" onClick={() => setShowPass(v => !v)}>
                {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
          </div>
          <button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading} type="submit">
            <LogIn size={18}/> {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        {/* Quick access */}
        <div className="quick-access">
          <div className="quick-title">Acceso rápido (demo)</div>
          <div className="quick-btns">
            {[
              { label: '🛠️ Admin',   u: 'admin',   p: 'admin123' },
              { label: '🧑‍🍳 Mesero', u: 'mesero1', p: 'mesero123' },
              { label: '👨‍🍳 Cocina', u: 'cocina1', p: 'cocina123' },
              { label: '💰 Cajero', u: 'cajero1', p: 'cajero123' },
            ].map(({ label, u, p }) => (
              <button key={u} className="quick-btn" onClick={() => quickLogin(u, p)}>{label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
