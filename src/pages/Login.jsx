import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import {
  UtensilsCrossed, ShieldAlert, Utensils, Flame, CreditCard, UserCheck,
  Delete, RefreshCw, Lock, ArrowLeft, AlertTriangle, Home
} from 'lucide-react';
import toast from 'react-hot-toast';
import './Login.css';

const ROLES = [
  { id: 1, name: 'Administrador', icon: ShieldAlert, badgeClass: 'badge-admin' },
  { id: 2, name: 'Meseros',       icon: Utensils,    badgeClass: 'badge-mesero' },
  { id: 3, name: 'Cocina',        icon: Flame,        badgeClass: 'badge-cocina' },
  { id: 4, name: 'Caja',          icon: CreditCard,   badgeClass: 'badge-cajero' }
];

export default function Login() {
  const { loginWithPin, getPublicUsers } = useAuth();
  const { tenantSlug, tenantInfo, loadingTenant, tenantError, tenantPath } = useTenant();
  const navigate = useNavigate();

  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // 3-step flow state
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(null);
  const [lockCountdown, setLockCountdown] = useState(0);
  // Ref tracks lock instantly to prevent race conditions between state batches
  const isLockedRef = useRef(false);

  useEffect(() => {
    if (!tenantError) {
      loadUsers();
    }
  }, [tenantSlug, tenantError]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    const users = await getPublicUsers();
    setUsersList(users);
    setLoadingUsers(false);
  };

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
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockCountdown]);

  const handleSelectRole = (roleId) => {
    setSelectedRole(roleId);
    setSelectedUser(null);
    setPin('');
    setErrorMessage('');
    setAttemptsLeft(null);
  };

  const handleSelectUser = (u) => {
    if (lockCountdown > 0 && selectedUser?.id === u.id) return;
    setSelectedUser(u);
    setPin('');
    setErrorMessage('');
    setAttemptsLeft(null);
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
      toast.success(`¡Bienvenido/a, ${result.user.nombre}!`);
      navigate(tenantPath('/'));
    } else {
      setPin('');
      setErrorMessage(result.error || 'PIN incorrecto');
      if (result.locked && result.lockSeconds) {
        isLockedRef.current = true;
        setLockCountdown(result.lockSeconds);
      } else if (result.attemptsLeft !== null && result.attemptsLeft !== undefined) {
        setAttemptsLeft(result.attemptsLeft);
      }
    }
    setSubmitting(false);
  };

  const renderRoleIcon = (rolId) => {
    switch (String(rolId)) {
      case '1': return <ShieldAlert size={28} />;
      case '2': return <Utensils size={28} />;
      case '3': return <Flame size={28} />;
      case '4': return <CreditCard size={28} />;
      default: return <UserCheck size={28} />;
    }
  };

  if (tenantError) {
    return (
      <div className="login-page">
        <div className="login-bg">
          <div className="login-blob blob1"></div>
        </div>
        <div className="login-main-container">
          <div className="keypad-card" style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
            <AlertTriangle size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
            <h2 style={{ color: '#f8fafc', marginBottom: '0.5rem' }}>Soda no encontrada</h2>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              No se encontró ninguna soda registrada con el identificador <strong>"{tenantSlug}"</strong>.
            </p>
            <button
              className="btn-enter-soda"
              onClick={() => navigate('/')}
              style={{ margin: '0 auto', maxWidth: 260 }}
            >
              <Home size={18} /> Volver al portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  const restaurantName = tenantInfo?.nombre || 'Mi Soda';
  const filteredUsers = selectedRole
    ? usersList.filter(u => String(u.rolId) === String(selectedRole))
    : [];
  const currentRoleObj = ROLES.find(r => r.id === selectedRole);

  const getRoleBadgeClass = (rolId) => {
    switch (String(rolId)) {
      case '1': return 'badge-admin';
      case '2': return 'badge-mesero';
      case '3': return 'badge-cocina';
      case '4': return 'badge-cajero';
      default: return 'badge-default';
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-blob blob1"></div>
        <div className="login-blob blob2"></div>
      </div>

      <div className="login-header-bar">
        <div className="login-brand">
          <div className="login-logo-icon">
            <UtensilsCrossed size={26} />
          </div>
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

      <div className="login-main-container">
        {loadingTenant || loadingUsers ? (
          <div className="loading-spinner-box">
            <RefreshCw size={28} className="animate-spin" />
            <p>Cargando personal...</p>
          </div>

        ) : !selectedRole ? (
          /* PASO 1: SELECCIÓN DE CATEGORÍA / ROL */
          <div className="visual-selection-wrapper animate-fade">
            <div className="selection-heading">
              <h2>¿Quién va a usar el sistema?</h2>
              <p>Tocá tu categoría para continuar</p>
            </div>
            <div className="role-cards-grid">
              {ROLES.map(r => (
                <div
                  key={r.id}
                  className={`role-card ${r.badgeClass}`}
                  onClick={() => handleSelectRole(r.id)}
                >
                  <div className="role-card-icon">
                    <r.icon size={36} />
                  </div>
                  <div className="role-card-name">{r.name}</div>
                </div>
              ))}
            </div>
          </div>

        ) : !selectedUser ? (
          /* PASO 2: LISTA DE USUARIOS DEL ROL SELECCIONADO */
          <div className="visual-selection-wrapper animate-fade">
            <div className="selection-heading">
              <button className="btn-back-selection" onClick={() => setSelectedRole(null)}>
                <ArrowLeft size={18} /> Volver a roles
              </button>
              <h2>Seleccioná tu usuario ({currentRoleObj?.name.toUpperCase()})</h2>
              <p>Tocá tu tarjeta para ingresar tu PIN</p>
            </div>
            {filteredUsers.length === 0 ? (
              <div className="no-users-message">
                <p>No hay usuarios registrados en esta categoría.</p>
              </div>
            ) : filteredUsers.length === 1 ? (
              /* Si hay solo 1 usuario, ir directo al PIN */
              (() => { handleSelectUser(filteredUsers[0]); return null; })()
            ) : (
              <div className="user-cards-grid">
                {filteredUsers.map(u => (
                  <div
                    key={u.id}
                    className={`user-avatar-card ${getRoleBadgeClass(u.rolId)}`}
                    onClick={() => handleSelectUser(u)}
                  >
                    <div className="user-card-badge">{u.nombreRol}</div>
                    <div className="user-card-icon">{renderRoleIcon(u.rolId)}</div>
                    <div className="user-card-name">{u.nombre}</div>
                    <div className="user-card-username">@{u.username}</div>
                    <div className="user-card-hover-hint">Pulsar para ingresar PIN</div>
                  </div>
                ))}
              </div>
            )}
          </div>

        ) : (
          /* PASO 3: TECLADO NUMÉRICO TÁCTIL (ATM KEYPAD) */
          <div className="keypad-modal-wrapper animate-fade">
            <div className="keypad-card">
              <button
                className="btn-back-selection"
                onClick={() => {
                  setSelectedUser(null);
                  setPin('');
                  setErrorMessage('');
                  if (filteredUsers.length <= 1) {
                    setSelectedRole(null);
                  }
                }}
              >
                <ArrowLeft size={18} /> {filteredUsers.length <= 1 ? 'Volver a roles' : 'Elegir otro usuario'}
              </button>

              <div className="keypad-user-header">
                <div className={`keypad-avatar ${getRoleBadgeClass(selectedUser.rolId)}`}>
                  {renderRoleIcon(selectedUser.rolId)}
                </div>
                <h3>Hola, {selectedUser.nombre}</h3>
                <span className="keypad-user-role">Ingresá tu PIN de 4 dígitos</span>
              </div>

              <div className="pin-dots-display">
                {[0, 1, 2, 3].map(idx => (
                  <div
                    key={idx}
                    className={`pin-dot ${idx < pin.length ? 'filled' : ''} ${errorMessage ? 'error' : ''}`}
                  />
                ))}
              </div>

              {errorMessage && (
                <div className="pin-error-alert animate-shake">
                  <Lock size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {lockCountdown > 0 && (
                <div className="pin-lock-banner">
                  <p>Bloqueado por seguridad</p>
                  <div className="lock-timer-counter">{lockCountdown}s</div>
                </div>
              )}

              <div className="atm-keypad-grid">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <button
                    key={num}
                    className="keypad-btn"
                    disabled={submitting || lockCountdown > 0}
                    onClick={() => handleKeypadPress(num)}
                  >
                    {num}
                  </button>
                ))}
                <button
                  className="keypad-btn btn-action-clear"
                  disabled={submitting || lockCountdown > 0 || pin.length === 0}
                  onClick={() => handleKeypadPress('C')}
                  title="Borrar todo"
                >
                  C
                </button>
                <button
                  className="keypad-btn"
                  disabled={submitting || lockCountdown > 0}
                  onClick={() => handleKeypadPress('0')}
                >
                  0
                </button>
                <button
                  className="keypad-btn btn-action-del"
                  disabled={submitting || lockCountdown > 0 || pin.length === 0}
                  onClick={() => handleKeypadPress('DEL')}
                  title="Borrar dígito"
                >
                  <Delete size={22} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
