import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, ArrowRight } from 'lucide-react';
import logoTicoMenu from '../assets/logo-ticomenu.png';
import { useTenantAuth } from '../context/TenantAuthContext';
import './LandingPortal.css';

export default function LandingPortal() {
  const [sodaCode, setSodaCode] = useState('');
  const [tenantPassword, setTenantPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [lockCountdown, setLockCountdown] = useState(0);
  const navigate = useNavigate();
  const { loginSoda } = useTenantAuth();

  // Rate limiting en frontend: 3 intentos / 15 min
  useEffect(() => {
    if (lockCountdown <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setLockCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setAttemptsLeft(3);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lockCountdown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Verificar rate limiting
    if (lockCountdown > 0) {
      setError(`Demasiados intentos. Espera ${lockCountdown} segundos.`);
      return;
    }

    const cleanSlug = sodaCode.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');

    if (!cleanSlug) {
      setError('Por favor ingresa el código de la soda');
      return;
    }

    if (!tenantPassword) {
      setError('Por favor ingresa la contraseña');
      return;
    }

    setLoading(true);

    try {
      const result = await loginSoda(cleanSlug, tenantPassword);

      if (!result.success) {
        setError('Credenciales inválidas');
        setAttemptsLeft(prev => prev - 1);

        if (attemptsLeft - 1 <= 0) {
          setLockCountdown(900); // 15 minutos
          setError('Demasiados intentos. Espera 15 minutos.');
        }

        return;
      }

      // Login exitoso, redirigir al login interno
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
      {/* Fondo decorativo */}
      <div className="landing-bg">
        <div className="landing-blob lb1" />
        <div className="landing-blob lb2" />
      </div>

      <div className="landing-card">
        {/* Logo TicoMenu */}
        <div className="landing-logo-block">
          <img
            src={logoTicoMenu}
            alt="TicoMenu — Gestión Gastronómica Ágil"
            className="landing-logo-img"
          />
        </div>

        {/* Tab visual (solo visual, modo único por ahora) */}
        <div className="landing-tabs">
          <span className="landing-tab active">Iniciar Sesión</span>
        </div>

        <form className="landing-form" onSubmit={handleSubmit}>
          <div className="landing-field">
            <label className="landing-label">CÓDIGO DE INGRESO</label>
            <div className="soda-input-wrapper">
              <Store size={18} className="soda-input-icon" />
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

          <div className="landing-field">
            <div className="landing-label-row">
              <label className="landing-label">CONTRASEÑA DEL RESTAURANTE</label>
            </div>
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
            <div className="landing-error">
              {error}
            </div>
          )}

          <button type="submit" className="btn-enter-soda" disabled={!sodaCode.trim() || loading}>
            <span>{loading ? 'Verificando...' : 'Iniciar Sesión'}</span>
            <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
