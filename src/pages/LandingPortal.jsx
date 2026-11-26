import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import logoTicoMenu from '../assets/logo-ticomenu.png';
import imgFacade from '../assets/login-collage-facade.jpg';
import imgWaiter from '../assets/login-collage-waiter.jpg';
import imgKitchen from '../assets/login-collage-kitchen.jpg';
import imgCashier from '../assets/login-collage-cashier.jpg';
import { useTenantAuth } from '../context/TenantAuthContext';
import './LandingPortal.css';

export default function LandingPortal() {
  const [sodaCode, setSodaCode] = useState('');
  const [tenantPassword, setTenantPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      {/* Lado izquierdo: Collage de 4 imágenes con overlay teal */}
      <div className="landing-left-panel">
        <div className="landing-collage-grid">
          <div className="landing-collage-cell cell-facade">
            <img src={imgFacade} alt="Restaurante TicoMenu" className="landing-collage-img" />
          </div>
          <div className="landing-collage-cell cell-waiter">
            <img src={imgWaiter} alt="Servicio y atención al cliente" className="landing-collage-img" />
          </div>
          <div className="landing-collage-cell cell-kitchen">
            <img src={imgKitchen} alt="Cocina y elaboración gastronómica" className="landing-collage-img" />
          </div>
          <div className="landing-collage-cell cell-cashier">
            <img src={imgCashier} alt="Terminal y facturación" className="landing-collage-img" />
          </div>
        </div>
        <div className="landing-collage-overlay" />
      </div>

      {/* Lado derecho: Formulario de login */}
      <div className="landing-right-panel">
        <div className="landing-card">
          {/* Logo TicoMenu */}
          <div className="landing-logo-block">
            <img
              src={logoTicoMenu}
              alt="TicoMenu"
              className="landing-logo-img"
            />
          </div>

          {/* Tagline */}
          <div className="landing-tagline">
            Gestioná pedidos, mesas, cocina y facturación sin complicaciones.
          </div>

          <br></br>
          <br></br>
          
          <form className="landing-form" onSubmit={handleSubmit}>
            <div className="landing-field">
              <div className="soda-input-wrapper">
                <input
                  type="text"
                  className="soda-input"
                  placeholder="sodalatica"
                  value={sodaCode}
                  onChange={(e) => setSodaCode(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="landing-field">
              <div className="soda-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="soda-input"
                  placeholder="Contraseña de la terminal"
                  autoComplete="current-password"
                  value={tenantPassword}
                  onChange={(e) => setTenantPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="landing-error">
                {error}
              </div>
            )}

            <button type="submit" className="btn-enter-soda" disabled={!sodaCode.trim() || loading}>
              {loading ? 'Verificando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="landing-support-link">
            ¿Necesitas registrar una nueva soda? <a href="mailto:soporte@ticomenu.cr">¡Contactar soporte!</a>
          </div>
        </div>
      </div>
    </div>
  );
}
