import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Save, RotateCcw,
  Lock, LayoutDashboard, UtensilsCrossed,
  ShoppingBag, ClipboardList, Package, Tag, Receipt,
  CreditCard, FileText, Settings, ChefHat, KeyRound,
  AlertCircle, UserCog, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import { confirmDialog } from '../utils/sweetAlert';
import './RolesPermisos.css';

// Lista maestra de todos los módulos disponibles en el sistema
export const SYSTEM_MODULES = [
  { id: 1,  ruta: '/dashboard',     nombre: 'Dashboard',        icon: LayoutDashboard, desc: 'Métricas, resumen diario y gráficas de venta' },
  { id: 2,  ruta: '/mesas',         nombre: 'Mesas',            icon: UtensilsCrossed, desc: 'Plano del salón y estado de mesas en tiempo real' },
  { id: 3,  ruta: '/delivery',      nombre: 'Delivery',         icon: ShoppingBag,     desc: 'Pedidos para llevar y entregas a domicilio' },
  { id: 4,  ruta: '/pedidos',       nombre: 'Pedidos',          icon: ClipboardList,   desc: 'Listado y creación de órdenes activas' },
  { id: 5,  ruta: '/productos',     nombre: 'Productos',        icon: Package,         desc: 'Catálogo de platillos, bebidas y precios' },
  { id: 6,  ruta: '/categorias',    nombre: 'Categorías',       icon: Tag,             desc: 'Organización del menú en categorías' },
  { id: 7,  ruta: '/clientes',      nombre: 'Clientes',         icon: Users,           desc: 'Directorio y registro tributario de clientes' },
  { id: 8,  ruta: '/facturacion',   nombre: 'Facturación',      icon: Receipt,         desc: 'Cobro de cuentas, comprobantes y arqueos' },
  { id: 9,  ruta: '/usuarios',      nombre: 'Usuarios',         icon: Users,           desc: 'Gestión de empleados, PINs y contraseñas' },
  { id: 10, ruta: '/roles',         nombre: 'Roles y Permisos', icon: KeyRound,        desc: 'Configuración de accesos y seguridad del sistema' },
  { id: 11, ruta: '/metodos-pago',  nombre: 'Métodos de Pago',  icon: CreditCard,      desc: 'Administración de formas de pago aceptadas' },
  { id: 12, ruta: '/reportes',      nombre: 'Reportes',         icon: FileText,        desc: 'Cierres de caja, ventas y exportación de reportes' },
  { id: 13, ruta: '/configuracion', nombre: 'Configuración',    icon: Settings,        desc: 'Datos del restaurante, moneda, tema e impuestos' },
  { id: 14, ruta: '/cocina',        nombre: 'Cola de Comandas', icon: ChefHat,         desc: 'Pantalla de cocina y preparación de platillos' },
  { id: 15, ruta: '/cancelar-servidos', nombre: 'Cancelar Servidos', icon: Lock, desc: 'Permite cancelar pedidos que ya fueron servidos' },
];

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Sub-componente: tabla de permisos reutilizable
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PermisosTable({ rutasActivas, onToggle, isLockedModule }) {
  return (
    <div className="table-wrapper">
      <table className="roles-permissions-table">
        <thead>
          <tr>
            <th style={{ width: 60, textAlign: 'center' }}>#</th>
            <th>Módulo</th>
            <th style={{ width: 140, textAlign: 'center' }}>Ver</th>
          </tr>
        </thead>
        <tbody>
          {SYSTEM_MODULES.map(mod => {
            const active = rutasActivas.has(mod.ruta);
            const IconComponent = mod.icon;
            const locked = isLockedModule ? isLockedModule(mod.ruta) : false;
            return (
              <tr key={mod.id} className={active ? 'row-active' : ''}>
                <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {mod.id}
                </td>
                <td>
                  <div className="module-info-cell">
                    <div className={`module-icon-box ${active ? 'active' : ''}`}>
                      <IconComponent size={18} />
                    </div>
                    <div>
                      <div className="module-title-row">
                        <span className="module-name">{mod.nombre}</span>
                        <code className="module-route-tag">{mod.ruta}</code>
                        {locked && (
                          <span className="module-locked-badge" title="Módulo crítico obligatorio">
                            <Lock size={12} /> Bloqueado
                          </span>
                        )}
                      </div>
                      <div className="module-desc">{mod.desc}</div>
                    </div>
                  </div>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <label className={`switch-toggle-label ${locked ? 'disabled' : ''}`}>
                    <input
                      type="checkbox"
                      checked={active}
                      disabled={locked}
                      onChange={() => onToggle(mod.ruta)}
                    />
                    <span className="switch-toggle-slider" />
                  </label>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Tab 1: Por Rol
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function TabPorRol({ user, updateCurrentUserRoutes }) {
  const [roles, setRoles] = useState([]);
  const [selectedRolId, setSelectedRolId] = useState(null);
  const [permisosMap, setPermisosMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchRolesData(); }, []);

  const fetchRolesData = async () => {
    setLoading(true);
    try {
      const data = await api.get('/roles');
      setRoles(data);
      const map = {};
      data.forEach(r => { map[r.id] = new Set(r.rutas || []); });
      setPermisosMap(map);
      if (data.length > 0) setSelectedRolId(data[0].id);
    } catch {
      toast.error('No se pudieron cargar los roles y permisos');
    } finally {
      setLoading(false);
    }
  };

  const selectedRol = roles.find(r => r.id === selectedRolId);
  const currentRutas = (selectedRolId && permisosMap[selectedRolId]) ? permisosMap[selectedRolId] : new Set();

  const isLockedAdmin = (ruta) =>
    (selectedRol?.nombreRol === 'Admin' || selectedRolId === 1) &&
    (ruta === '/roles' || ruta === '/usuarios');

  const toggleModule = (ruta) => {
    if (!selectedRolId) return;
    if (isLockedAdmin(ruta)) {
      toast('El Administrador no puede desactivar Roles ni Usuarios.', { icon: 'ðŸ”’' });
      return;
    }
    setPermisosMap(prev => {
      const newSet = new Set(prev[selectedRolId] || []);
      newSet.has(ruta) ? newSet.delete(ruta) : newSet.add(ruta);
      return { ...prev, [selectedRolId]: newSet };
    });
  };

  const handleSelectAll = (activateAll) => {
    if (!selectedRolId) return;
    setPermisosMap(prev => {
      let newSet = activateAll
        ? new Set(SYSTEM_MODULES.map(m => m.ruta))
        : new Set();
      if (!activateAll && (selectedRol?.nombreRol === 'Admin' || selectedRolId === 1)) {
        newSet.add('/roles'); newSet.add('/usuarios'); newSet.add('/dashboard');
      }
      return { ...prev, [selectedRolId]: newSet };
    });
  };

  const handleSave = async () => {
    if (!selectedRolId || saving) return;
    setSaving(true);
    const toastId = toast.loading('Guardando permisos del rol...');
    try {
      const rutasArray = Array.from(currentRutas);
      const res = await api.put(`/roles/${selectedRolId}/permisos`, { rutas: rutasArray });
      if (user?.rolId === selectedRolId) updateCurrentUserRoutes(res.rutas);
      toast.success(`Permisos guardados para el rol ${selectedRol?.nombreRol}`, { id: toastId });
    } catch (err) {
      toast.error(err.message || 'Error al guardar permisos', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--text-secondary)', padding: 24 }}>Cargando roles...</p>;

  return (
    <>
      <div className="roles-tabs-container">
        {roles.map(rol => (
          <button
            key={rol.id}
            type="button"
            className={`role-tab-button ${rol.id === selectedRolId ? 'active' : ''}`}
            onClick={() => setSelectedRolId(rol.id)}
          >
            <span className="role-tab-name">{rol.nombreRol}</span>
            <span className="role-tab-badge">{rol.totalUsuarios} {rol.totalUsuarios === 1 ? 'usuario' : 'usuarios'}</span>
          </button>
        ))}
      </div>

      <div className="card roles-table-card">
        <div className="roles-table-toolbar">
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Módulos del Sistema para: <span style={{ color: 'var(--accent)' }}>{selectedRol?.nombreRol}</span>
            </h3>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {currentRutas.size} de {SYSTEM_MODULES.length} módulos habilitados
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => handleSelectAll(true)}>Habilitar Todos</button>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => handleSelectAll(false)}>Desmarcar Todos</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', fontWeight: 700 }}
            >
              <Save size={15} />
              <span>{saving ? 'Guardando...' : 'Guardar'}</span>
            </button>
          </div>
        </div>

        <PermisosTable rutasActivas={currentRutas} onToggle={toggleModule} isLockedModule={isLockedAdmin} />

        <div className="roles-footer-note">
          <AlertCircle size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
          <span>Los cambios aplican a <strong>todos los usuarios</strong> de ese rol que no tengan permisos personalizados.</span>
        </div>
      </div>
    </>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Tab 2: Por Usuario
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function TabPorUsuario() {
  const [usuarios, setUsuarios] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [rutasUsuario, setRutasUsuario] = useState(new Set());
  const [rutasRolBase, setRutasRolBase] = useState(new Set());
  const [hasCustom, setHasCustom] = useState(false);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const [loadingPermisos, setLoadingPermisos] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/usuarios')
      .then(data => { setUsuarios(data); setLoadingUsuarios(false); })
      .catch(() => { toast.error('No se pudieron cargar los usuarios'); setLoadingUsuarios(false); });
  }, []);

  const loadUserPermisos = useCallback(async (usuarioId) => {
    setLoadingPermisos(true);
    try {
      const data = await api.get(`/roles/usuario/${usuarioId}/permisos`);
      setHasCustom(data.hasCustom);
      setRutasUsuario(new Set(data.rutas));
      setRutasRolBase(new Set(data.rutasRolBase || []));
    } catch {
      toast.error('Error al cargar permisos del usuario');
    } finally {
      setLoadingPermisos(false);
    }
  }, []);

  const handleSelectUser = (id) => {
    setSelectedUserId(id);
    loadUserPermisos(id);
  };

  const toggleModule = (ruta) => {
    setRutasUsuario(prev => {
      const newSet = new Set(prev);
      newSet.has(ruta) ? newSet.delete(ruta) : newSet.add(ruta);
      return newSet;
    });
  };

  const handleSelectAll = (activateAll) => {
    setRutasUsuario(activateAll ? new Set(SYSTEM_MODULES.map(m => m.ruta)) : new Set());
  };

  const handleSave = async () => {
    if (!selectedUserId || saving) return;
    setSaving(true);
    const toastId = toast.loading('Guardando permisos del usuario...');
    try {
      await api.put(`/roles/usuario/${selectedUserId}/permisos`, { rutas: Array.from(rutasUsuario) });
      setHasCustom(true);
      const u = usuarios.find(u => u.id === selectedUserId);
      toast.success(`Permisos personalizados guardados para ${u?.nombre}`, { id: toastId });
    } catch (err) {
      toast.error(err.message || 'Error al guardar', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleResetToRole = async () => {
    if (!selectedUserId || saving) return;
    const u = usuarios.find(u => u.id === selectedUserId);

    const confirmed = await confirmDialog({
      title: `¿Eliminar permisos personalizados de ${u?.nombre}?`,
      text: `Volverá a usar los permisos del rol "${u?.nombreRol}".`,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmed) return;
    setSaving(true);
    const toastId = toast.loading('Restaurando permisos del rol...');
    try {
      await api.delete(`/roles/usuario/${selectedUserId}/permisos`);
      setHasCustom(false);
      setRutasUsuario(new Set(rutasRolBase));
      toast.success(`${u?.nombre} ahora hereda los permisos del rol ${u?.nombreRol}`, { id: toastId });
    } catch (err) {
      toast.error(err.message || 'Error al restaurar', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const selectedUser = usuarios.find(u => u.id === selectedUserId);

  if (loadingUsuarios) return <p style={{ color: 'var(--text-secondary)', padding: 24 }}>Cargando usuarios...</p>;

  return (
    <>
      {/* Grid de selección de usuario */}
      <div className="user-selector-card card">
        <div className="user-selector-header">
          <UserCog size={20} color="var(--accent)" />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Seleccionar Usuario</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Elegí un usuario para configurar sus accesos de forma individual</div>
          </div>
        </div>
        <div className="user-selector-grid">
          {usuarios.map(u => (
            <button
              key={u.id}
              type="button"
              className={`user-chip-btn ${u.id === selectedUserId ? 'active' : ''}`}
              onClick={() => handleSelectUser(u.id)}
            >
              <div className="user-chip-avatar">{u.nombre.charAt(0).toUpperCase()}</div>
              <div className="user-chip-info">
                <span className="user-chip-name">{u.nombre}</span>
                <span className="user-chip-role">{u.nombreRol}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Panel de permisos */}
      {selectedUserId && (
        <div className="card roles-table-card" style={{ marginTop: 0 }}>
          {loadingPermisos ? (
            <p style={{ padding: 24, color: 'var(--text-secondary)' }}>Cargando permisos...</p>
          ) : (
            <>
              <div className="roles-table-toolbar">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Accesos de: <span style={{ color: 'var(--accent)' }}>{selectedUser?.nombre}</span>
                    </h3>
                    {hasCustom ? (
                      <span className="custom-permisos-badge">
                        <Shield size={11} /> Personalizado
                      </span>
                    ) : (
                      <span className="heredado-badge">Hereda rol: {selectedUser?.nombreRol}</span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {rutasUsuario.size} de {SYSTEM_MODULES.length} módulos habilitados
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {hasCustom && (
                    <button
                      type="button"
                      className="btn btn-sm btn-danger-outline"
                      onClick={handleResetToRole}
                      disabled={saving}
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <RotateCcw size={13} /> Usar Permisos del Rol
                    </button>
                  )}
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => handleSelectAll(true)}>Habilitar Todos</button>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => handleSelectAll(false)}>Desmarcar Todos</button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', fontWeight: 700 }}
                  >
                    <Save size={15} />
                    <span>{saving ? 'Guardando...' : 'Guardar'}</span>
                  </button>
                </div>
              </div>

              <PermisosTable rutasActivas={rutasUsuario} onToggle={toggleModule} isLockedModule={() => false} />

              <div className="roles-footer-note">
                <AlertCircle size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
                <span>
                  {hasCustom
                    ? `${selectedUser?.nombre} tiene permisos personalizados que sobreescriben los del rol "${selectedUser?.nombreRol}".`
                    : `${selectedUser?.nombre} hereda los permisos del rol "${selectedUser?.nombreRol}". Al guardar, se crearán permisos personalizados para este usuario.`}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {!selectedUserId && (
        <div className="empty-user-hint">
          <UserCog size={40} color="var(--text-muted)" style={{ opacity: 0.4 }} />
          <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>Seleccioná un usuario para configurar sus permisos individuales</p>
        </div>
      )}
    </>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Componente Principal
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function RolesPermisos() {
  const { user, updateCurrentUserRoutes } = useAuth();
  const [activeTab, setActiveTab] = useState('rol');

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="roles-header-icon-box">
            <KeyRound size={22} color="var(--accent)" />
          </div>
          <div>
            <h1>Roles y Permisos</h1>
            <p>Configura a qué sectores del dashboard tiene acceso cada rol o usuario individual</p>
          </div>
        </div>
      </div>

      {/* Tabs principales */}
      <div className="main-mode-tabs">
        <button
          type="button"
          className={`main-mode-tab ${activeTab === 'rol' ? 'active' : ''}`}
          onClick={() => setActiveTab('rol')}
        >
          <Shield size={16} />
          <div>
            <span className="mode-tab-title">Por Rol</span>
            <span className="mode-tab-sub">Aplica a todos los usuarios del rol</span>
          </div>
        </button>
        <button
          type="button"
          className={`main-mode-tab ${activeTab === 'usuario' ? 'active' : ''}`}
          onClick={() => setActiveTab('usuario')}
        >
          <UserCog size={16} />
          <div>
            <span className="mode-tab-title">Por Usuario</span>
            <span className="mode-tab-sub">Permisos individuales por persona</span>
          </div>
        </button>
      </div>

      {activeTab === 'rol' && <TabPorRol user={user} updateCurrentUserRoutes={updateCurrentUserRoutes} />}
      {activeTab === 'usuario' && <TabPorUsuario />}
    </div>
  );
}

