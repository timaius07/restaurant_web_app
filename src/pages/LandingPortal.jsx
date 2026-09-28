import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, ArrowRight, Utensils } from 'lucide-react';
import './LandingPortal.css';

export default function LandingPortal() {
  const [sodaCode, setSodaCode] = useState('');
  const [tenantPassword, setTenantPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    const cleanSlug = sodaCode.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    
    if (!cleanSlug) {
      setError('Por favor ingresa el código de la soda');
      return;
    }

    setLoading(true);
    
    try {
      // Verificar contraseña del tenant
      const { api } = await import('../services/apiService');
      await api.post('/public/tenant/verify', {
        slug: cleanSlug,
        password: tenantPassword
      });
      
      // Si la verificación es exitosa, navegar al login
      navigate(`/${cleanSlug}/login`);
    } catch (err) {
      if (err.status === 404) {
        setError('Soda no encontrada o inactiva');
      } else if (err.status === 401) {
        setError('Contraseña incorrecta');
      } else {
        setError('Error al verificar la soda. Intenta nuevamente.');
      }
    } finally {
      setLoading(false);
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

          <div>
            <label className="landing-label">Contraseña del restaurante</label>
            <div className="soda-input-wrapper">
              <input
                type="password"
                className="soda-input"
                placeholder="Contraseña de acceso"
                value={tenantPassword}
                onChange={(e) => setTenantPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="landing-error" style={{ color: '#ef4444', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn-enter-soda" disabled={!sodaCode.trim() || loading}>
            <span>{loading ? 'Verificando...' : 'Ingresar al Restaurante'}</span>
            <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
