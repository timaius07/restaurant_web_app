import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, ArrowRight, Utensils } from 'lucide-react';
import './LandingPortal.css';

export default function LandingPortal() {
  const [sodaCode, setSodaCode] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanSlug = sodaCode.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (cleanSlug) {
      navigate(`/${cleanSlug}/login`);
    }
  };

  return (
    <div className="landing-container">
      <div className="landing-card">
        <div className="landing-logo">🍽️</div>
        <h1 className="landing-title">Acceso al Sistema</h1>
        <p className="landing-subtitle">
          Ingresá el nombre de tu soda o restaurante para acceder al menú y las comandas.
        </p>

        <form className="landing-form" onSubmit={handleSubmit}>
          <div>
            <label className="landing-label">Código de ingreso</label>
            <div className="soda-input-wrapper">
              <Store size={20} className="soda-input-icon" />
              <input
                type="text"
                className="soda-input"
                placeholder="ej: sodademo"
                value={sodaCode}
                onChange={(e) => setSodaCode(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <button type="submit" className="btn-enter-soda" disabled={!sodaCode.trim()}>
            <span>Ingresar al Restaurante</span>
            <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
