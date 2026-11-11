import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { RefreshCw, Lock, AlertTriangle, Home, Delete } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRoles } from '../context/RolesContext';
import logoTicoMenu from '../assets/icono-ticomenu-ls.png';
import defaultMale from '../assets/default-male.jpg';
import defaultFemale from '../assets/default-female.jpg';
import loginBackground from '../assets/login-background.jpeg';
import TenantBlockedScreen from '../components/layout/TenantBlockedScreen';
import './Login.css';

const AVATAR_BG_COLORS = [
  '#4ee2a8', // Verde menta
  '#ff8447', // Naranja
  '#40bca5', // Turquesa
  '#f6ba43', // Amarillo cálido
  '#38bdf8', // Celeste
  '#ec4899', // Rosa
];

export default function Login() {
  const { loginWithPin, getPublicUsers } = useAuth();
  const { tenantSlug, tenantInfo, loadingTenant, tenantError, tenantPath } = useTenant();
  const { roles, loadingRoles } = useRoles();
  const navigate = useNavigate();

  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Usuario seleccionado para el modal de PIN
  const [selectedUser, setSelectedUser] = useState(null);

  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(null);
  const [lockCountdown, setLockCountdown] = useState(0);
  const isLockedRef = useRef(false);
  const fetchingRef = useRef(false);
  const fetchedSlugRef = useRef(null);
  const userLockMapRef = useRef(new Map());

  const loadUsers = async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoadingUsers(true);
    try {
      const users = await getPublicUsers();
      setUsersList(users || []);
      fetchedSlugRef.current = tenantSlug;
    } catch {
      setUsersList([]);
      fetchedSlugRef.current = null;
    } finally {
      setLoadingUsers(false);
      fetchingRef.current = false;
    }
  };

  useEffect(() => {
    if (!loadingTenant && tenantSlug && !tenantError) {
      if (fetchedSlugRef.current === tenantSlug) return;
      loadUsers();
    }
  }, [tenantSlug, tenantError, loadingTenant]);

  // Timer regresivo para el bloqueo temporal por rate-limiting
  useEffect(() => {
    if (lockCountdown <= 0) {
      isLockedRef.current = false;
      return;
    }
    isLockedRef.current = true;
    const interval = setInterval(() => {
      setLockCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          isLockedRef.current = false;
          setErrorMessage('');
          if (selectedUser) {
            userLockMapRef.current.delete(selectedUser.id);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockCountdown, selectedUser]);

  // Soporte para teclado físico (0-9, Backspace, Escape) cuando el modal de PIN está abierto
  useEffect(() => {
    if (!selectedUser) return;

    const handleKeyDown = (e) => {
      if (submitting || lockCountdown > 0 || isLockedRef.current) return;

      if (e.key >= '0' && e.key <= '9') {
        handleKeypadPress(e.key);
      } else if (e.key === 'Backspace') {
        handleKeypadPress('DEL');
      } else if (e.key === 'Escape') {
        handleCloseModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedUser, pin, submitting, lockCountdown]);

  const handleSelectUser = (u) => {
    if (u.activo === 0) {
      toast.error('Este usuario se encuentra inactivo o bloqueado por seguridad.');
      return;
    }
    setSelectedUser(u);
    setPin('');
    setErrorMessage('');
    setAttemptsLeft(null);

    // Verificar si este usuario específico tiene un bloqueo temporal activo
    const lockUntil = userLockMapRef.current.get(u.id) || 0;
    const remainingMs = lockUntil - Date.now();
    if (remainingMs > 0) {
      const remainingSecs = Math.ceil(remainingMs / 1000);
      setLockCountdown(remainingSecs);
      isLockedRef.current = true;
      setErrorMessage(`Usuario bloqueado temporalmente por varios intentos fallidos.`);
    } else {
      userLockMapRef.current.delete(u.id);
      setLockCountdown(0);
      isLockedRef.current = false;
    }
  };

  const handleCloseModal = () => {
    setSelectedUser(null);
    setPin('');
    setErrorMessage('');
    setAttemptsLeft(null);
    setLockCountdown(0);
    isLockedRef.current = false;
  };

  const handleKeypadPress = (val) => {
    if (submitting || lockCountdown > 0 || isLockedRef.current) return;

    if (val === 'C') {
      setPin('');
      setErrorMessage('');
      return;
    }

    if (val === 'DEL') {
      setPin(prev => prev.slice(0, -1));
      setErrorMessage('');
      return;
    }

    if (pin.length < 4) {
      const newPin = pin + val;
      setPin(newPin);
      setErrorMessage('');

      // Auto-submit al completar 4 dígitos
      if (newPin.length === 4) {
        submitPin(newPin);
      }
    }
  };

  const submitPin = async (pinValue) => {
    if (!selectedUser) return;
    setSubmitting(true);
    const result = await loginWithPin(selectedUser.id, pinValue);
    if (result.ok) {
      userLockMapRef.current.delete(selectedUser.id);
      toast.success(`¡Bienvenido/a, ${result.user.nombre}!`);
      navigate(tenantPath('/'));
    } else {
      setPin('');
      setErrorMessage(result.error || 'PIN incorrecto');
      if (result.blocked) {
        isLockedRef.current = false;
        setLockCountdown(0);
        userLockMapRef.current.delete(selectedUser.id);
        setSelectedUser(null);
        setPin('');
        setErrorMessage('');
        await loadUsers();
        if (result.contact === 'admin' || result.contact === 'administrador') {
          toast.error('Tu usuario ha sido bloqueado por seguridad. Contacta al Administrador.', { duration: 5000 });
        } else {
          toast.error('Tu usuario ha sido bloqueado por seguridad. Contacta a soporte.', { duration: 5000 });
        }
      } else if (result.locked && result.lockSeconds) {
        userLockMapRef.current.set(selectedUser.id, Date.now() + result.lockSeconds * 1000);
        isLockedRef.current = true;
        setLockCountdown(result.lockSeconds);
      } else if (result.attemptsLeft !== null && result.attemptsLeft !== undefined) {
        setAttemptsLeft(result.attemptsLeft);
      }
    }
    setSubmitting(false);
  };

  const getRoleName = (user) => {
    if (user.nombreRol) return user.nombreRol;
    const rol = roles.find(r => String(r.id) === String(user.rolId));
    return rol?.nombreRol || 'Usuario';
  };

  // Resolución de avatar: por foto de BD o fallback seguro
  const getUserAvatar = (user) => {
    if (!user) return defaultMale;

    const foto = user.foto;
    if (typeof foto === 'string' && foto.trim() !== '') {
      const lower = foto.toLowerCase();
      if (lower.includes('female') || lower.includes('mujer')) return defaultFemale;
      if (lower.includes('male') || lower.includes('hombre')) return defaultMale;
      return foto;
    }

    // Si no viene foto en el response, fallback por género si existe
    const genero = String(user.genero || user.gender || '').toLowerCase();
    if (genero.startsWith('f') || genero === 'mujer' || genero === 'female') {
      return defaultFemale;
    }

    return defaultMale;
  };

  const getAvatarBg = (index) => {
    return AVATAR_BG_COLORS[index % AVATAR_BG_COLORS.length];
  };

  if (tenantError) {
    return <TenantBlockedScreen tenantSlug={tenantSlug} />;
  }

  const restaurantName = tenantInfo?.nombre || 'Mi Soda';

  return (
    <div className="login-page login-page-restaurant">
      {/* Fondo con ambiente de restaurante suavemente difuminado */}
      <div
        className="login-restaurant-backdrop"
        style={{ backgroundImage: `url(${loginBackground})` }}
      />
      <div className="login-backdrop-overlay" />

      {/* Header bar */}
      <div className="login-header-bar">
        <div className="login-brand">
          <img
            src={logoTicoMenu}
            alt="TicoMenu"
            className="login-logo-icon-img"
          />
          <div>
            <h1>{restaurantName}</h1>
            <p>Sistema de Comandas</p>
          </div>
        </div>

        <button
          className="btn-back-home"
          onClick={() => navigate('/')}
          title="Volver a la pantalla principal"
        >
          <Home size={18} />
          <span>Volver al inicio</span>
        </button>
      </div>

      {/* Contenedor principal de usuarios */}
      <div className="login-main-container">
        {loadingTenant || loadingUsers || loadingRoles ? (
          <div className="loading-spinner-box">
            <RefreshCw size={32} className="animate-spin" />
            <p>Cargando personal del restaurante...</p>
          </div>
        ) : usersList.length === 0 ? (
          <div className="no-users-card">
            <p>No hay usuarios registrados en el sistema para esta soda.</p>
          </div>
        ) : (
          <div className="users-showcase-container animate-fade">
            <div className="users-showcase-grid">
              {usersList.map((u, idx) => {
                const isSelected = selectedUser?.id === u.id;
                const isInactive = u.activo === 0;
                const avatarSrc = getUserAvatar(u);

                return (
                  <div
                    key={u.id}
                    className={`user-card-chic ${isSelected ? 'selected' : ''} ${isInactive ? 'inactive' : ''}`}
                    onClick={() => handleSelectUser(u)}
                  >
                    {/* Círculo de avatar con fondo de color pastel/vibrante */}
                    <div
                      className="user-avatar-circle"
                      style={{ backgroundColor: getAvatarBg(idx) }}
                    >
                      <img
                        src={avatarSrc}
                        alt={u.nombre}
                        className="user-avatar-img"
                        onError={(e) => {
                          e.target.src = defaultMale;
                        }}
                      />
                    </div>

                    {/* Nombre del usuario en mayúsculas y negrita */}
                    <div className="user-name-bold">
                      {u.nombre ? u.nombre.toUpperCase() : 'USUARIO'}
                    </div>

                    {/* Rol del usuario */}
                    <div className="user-role-sub">
                      {getRoleName(u).toUpperCase()}
                    </div>

                    {/* Badge / Pill de estado */}
                    <div className={`user-status-pill ${isInactive ? 'status-bloqueado' : 'status-activo'}`}>
                      {isInactive ? 'Bloqueado' : 'Activo'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE PIN (OVERLAY CENTRADO TIPO IMAGEN DE REFERENCIA) */}
      {selectedUser && (
        <div className="pin-modal-backdrop animate-fade" onClick={handleCloseModal}>
          <div
            className="pin-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Título: ¡HOLA [NOMBRE]! */}
            <div className="pin-modal-title">
              ¡HOLA {selectedUser.nombre ? selectedUser.nombre.toUpperCase() : 'USUARIO'}!
            </div>

            {/* 4 Puntos de progreso del PIN con colores del logo */}
            <div className="pin-dots-row">
              {[0, 1, 2, 3].map(idx => {
                const DOT_BRAND_COLORS = ['#0A2540', '#64748B', '#E7A41F', '#E7A41F'];
                const isFilled = idx < pin.length;
                return (
                  <div
                    key={idx}
                    className={`pin-dot-circle ${isFilled ? 'filled' : ''} ${errorMessage ? 'error' : ''}`}
                    style={isFilled && !errorMessage ? { backgroundColor: DOT_BRAND_COLORS[idx], borderColor: DOT_BRAND_COLORS[idx] } : {}}
                  />
                );
              })}
            </div>

            {/* Mensaje de error si falló */}
            {errorMessage && (
              <div className="pin-error-text animate-shake">
                <Lock size={14} style={{ display: 'inline', marginRight: 4 }} />
                {errorMessage}
                {attemptsLeft !== null && ` (${attemptsLeft} intentos restantes)`}
              </div>
            )}

            {/* Banner de bloqueo por rate limit */}
            {lockCountdown > 0 && (
              <div className="pin-lock-text">
                Bloqueado temporalmente ({lockCountdown}s)
              </div>
            )}

            {/* Teclado numérico circular con colores de marca */}
            <div className="pin-keypad-grid">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <button
                  key={num}
                  type="button"
                  className="pin-circle-btn"
                  disabled={submitting || lockCountdown > 0}
                  onClick={() => handleKeypadPress(num)}
                >
                  {num}
                </button>
              ))}

              {/* Fila 4: 0 (teal), Borrar dígito a dígito (teal), Cancel (gold) */}
              <button
                type="button"
                className="pin-circle-btn pin-btn-zero"
                disabled={submitting || lockCountdown > 0}
                onClick={() => handleKeypadPress('0')}
              >
                0
              </button>

              <button
                type="button"
                className="pin-text-action-btn btn-delete"
                disabled={submitting || lockCountdown > 0 || pin.length === 0}
                onClick={() => handleKeypadPress('DEL')}
                title="Borrar dígito"
              >
                <Delete size={26} strokeWidth={2.2} />
              </button>

              <button
                type="button"
                className="pin-text-action-btn btn-cancel"
                onClick={handleCloseModal}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
