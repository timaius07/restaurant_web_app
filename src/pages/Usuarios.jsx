import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Edit2, Trash2, Search, UserCheck, LayoutGrid, List, ShieldAlert, Utensils, Flame, CreditCard, Lock } from 'lucide-react';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';
import { confirmDialog } from '../utils/sweetAlert';
import { ROLES } from '../data/seedData';
import './Usuarios.css';

const EMPTY = { username: '', passwordHash: '', email: '', rolId: '1', nombre: '', puedeCancelarServido: false };

export default function Usuarios() {
  const { usuarios = [], addUsuario, updateUsuario, deleteUsuario } = useApp();
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busqueda, setBusqueda] = useState('');
  const [rolFiltro, setRolFiltro] = useState('todos');
  const [vista, setVista] = useState('tarjetas'); // 'tarjetas' | 'tabla'

  const openAdd = () => { setForm(EMPTY); setModal('add'); };
  const openEdit = (u) => {
    setSelected(u);
    setForm({
      username: u.username,
      passwordHash: '',
      email: u.email || '',
      rolId: String(u.rolId),
      nombre: u.nombre,
      puedeCancelarServido: !!u.puedeCancelarServido
    });
    setModal('edit');
  };

  const handleSave = () => {
    if (!form.username.trim() || !form.nombre.trim()) return toast.error('Nombre y usuario son requeridos');
    if (modal === 'add') {
      if (!form.passwordHash) return toast.error('La contraseña es requerida');
      addUsuario({ ...form });
      toast.success('Usuario creado');
    } else {
      const changes = { ...form };
      if (!changes.passwordHash) delete changes.passwordHash;
      updateUsuario(selected.id, changes);
      toast.success('Usuario actualizado');
    }
    setModal(null);
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmDialog({
      title: '¿Eliminar este usuario?',
      text: 'El usuario perderá acceso al sistema.',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmed) return;
    deleteUsuario(id);
    toast.success('Usuario eliminado');
  };

  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const roles = ROLES;

  const listaFiltrada = usuarios.filter(u => {
    const matchBusqueda = `${u.nombre} ${u.username} ${u.email}`.toLowerCase().includes(busqueda.toLowerCase());
    const matchRol = rolFiltro === 'todos' || String(u.rolId) === String(rolFiltro);
    return matchBusqueda && matchRol;
  });

  const getRoleBadgeClass = (rolId) => {
    switch (String(rolId)) {
      case '1': return 'badge-danger';
      case '2': return 'badge-info';
      case '3': return 'badge-warning';
      case '4': return 'badge-success';
      default: return 'badge-muted';
    }
  };

  const getAvatarClass = (rolId) => {
    switch (String(rolId)) {
      case '1': return 'avatar-admin';
      case '2': return 'avatar-mesero';
      case '3': return 'avatar-cocina';
      case '4': return 'avatar-cajero';
      default: return 'avatar-default';
    }
  };

  const renderRoleIcon = (rolId) => {
    switch (String(rolId)) {
      case '1': return <ShieldAlert size={26} />;
      case '2': return <Utensils size={26} />;
      case '3': return <Flame size={26} />;
      case '4': return <CreditCard size={26} />;
      default: return <UserCheck size={26} />;
    }
  };

  return (
    <div className="page-container animate-fade">
      {/* Header Section */}
      <div className="usuarios-header-section">
        <div>
          <h1 className="usuarios-title">Gestión de Usuarios</h1>
          <p className="usuarios-subtitle">
            Administración de personal, cajeros, cocineros y permisos ({usuarios.length} activos)
          </p>
        </div>
        <div className="usuarios-header-actions">
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Nuevo Usuario
          </button>
        </div>
      </div>

      {/* Role Filter Pills */}
      <div className="usuarios-roles-bar">
        <button
          className={`role-pill ${rolFiltro === 'todos' ? 'active' : ''}`}
          onClick={() => setRolFiltro('todos')}
        >
          Todos ({usuarios.length})
        </button>
        {roles.map(r => {
          const cant = usuarios.filter(u => String(u.rolId) === String(r.id)).length;
          let pillClass = '';
          let dotClass = '';
          if (String(r.id) === '1') { pillClass = 'role-pill-admin'; dotClass = 'dot-red'; }
          if (String(r.id) === '2') { pillClass = 'role-pill-mesero'; dotClass = 'dot-blue'; }
          if (String(r.id) === '3') { pillClass = 'role-pill-cocina'; dotClass = 'dot-orange'; }
          if (String(r.id) === '4') { pillClass = 'role-pill-cajero'; dotClass = 'dot-green'; }

          return (
            <button
              key={r.id}
              className={`role-pill ${pillClass} ${rolFiltro === String(r.id) ? 'active' : ''}`}
              onClick={() => setRolFiltro(String(r.id))}
            >
              <span className={`status-dot ${dotClass}`} style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }}></span>
              {r.nombreRol} ({cant})
            </button>
          );
        })}
      </div>

      {/* Controls Bar: Search & View Switcher */}
      <div className="usuarios-controls-bar">
        <div className="search-bar" style={{ flex: 1, maxWidth: 420 }}>
          <Search size={14} className="search-icon" />
          <input
            className="form-input"
            placeholder="Buscar usuario por nombre, usuario o email..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', padding: 3, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          <button
            className={`btn btn-sm ${vista === 'tarjetas' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '6px 12px' }}
            onClick={() => setVista('tarjetas')}
          >
            <LayoutGrid size={14} /> Tarjetas
          </button>
          <button
            className={`btn btn-sm ${vista === 'tabla' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '6px 12px' }}
            onClick={() => setVista('tabla')}
          >
            <List size={14} /> Tabla
          </button>
        </div>
      </div>

      {/* Content */}
      {listaFiltrada.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <UserCheck size={44} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
            <p>No se encontraron usuarios en esta categoría o búsqueda.</p>
          </div>
        </div>
      ) : vista === 'tarjetas' ? (
        /* Tarjetas View (Stitch Style) */
        <div className="usuarios-grid-stitch">
          {listaFiltrada.map(u => {
            const rol = roles.find(r => String(r.id) === String(u.rolId));
            return (
              <div key={u.id} className="usuario-card-stitch">
                <div className="usuario-card-header">
                  <span className={`badge ${getRoleBadgeClass(u.rolId)}`}>
                    {rol?.nombreRol || 'Usuario'}
                  </span>
                  <span className="user-username-tag">@{u.username}</span>
                </div>

                <div className="usuario-card-body">
                  <div className={`usuario-avatar-container ${getAvatarClass(u.rolId)}`}>
                    {renderRoleIcon(u.rolId)}
                  </div>

                  <div className="usuario-full-name">{u.nombre}</div>
                  <div className="usuario-email">{u.email || 'Sin correo registrado'}</div>

                  {u.puedeCancelarServido && (
                    <span className="permiso-tag">
                      <Lock size={10} /> Cancela servidos
                    </span>
                  )}
                </div>

                <div className="usuario-card-divider" />

                <div className="usuario-card-footer">
                  <button className="btn btn-ghost btn-icon btn-sm" title="Editar" onClick={() => openEdit(u)}>
                    <Edit2 size={14} />
                  </button>
                  <button className="btn btn-danger btn-icon btn-sm" title="Eliminar" onClick={() => handleDelete(u.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Tabla View */
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Usuario</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Permisos</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map(u => {
                  const rol = roles.find(r => String(r.id) === String(u.rolId));
                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.nombre}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>@{u.username}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{u.email || '—'}</td>
                      <td>
                        <span className={`badge ${getRoleBadgeClass(u.rolId)}`}>
                          {rol?.nombreRol || 'Usuario'}
                        </span>
                      </td>
                      <td>
                        {u.puedeCancelarServido ? (
                          <span className="badge badge-purple">
                            <Lock size={10} /> Cancelar Servidos
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Estándar</span>
                        )}
                      </td>
                      <td>
                        <div className="td-actions">
                          <button className="btn btn-ghost btn-icon btn-sm" title="Editar" onClick={() => openEdit(u)}>
                            <Edit2 size={14} />
                          </button>
                          <button className="btn btn-danger btn-icon btn-sm" title="Eliminar" onClick={() => handleDelete(u.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Add / Edit */}
      {modal && (
        <Modal
          title={modal === 'add' ? 'Nuevo Usuario' : 'Editar Usuario'}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
          </>}
        >
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nombre completo *</label>
              <input className="form-input" value={form.nombre} onChange={f('nombre')} placeholder="Juan Pérez" />
            </div>
            <div className="form-group">
              <label className="form-label">Usuario *</label>
              <input className="form-input" value={form.username} onChange={f('username')} placeholder="juan99" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{modal === 'edit' ? 'Nueva Contraseña' : 'Contraseña *'}</label>
              <input className="form-input" type="password" value={form.passwordHash} onChange={f('passwordHash')} placeholder={modal === 'edit' ? 'Dejar vacío para no cambiar' : '••••••••'} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} onChange={f('email')} placeholder="correo@soda.cr" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Rol *</label>
            <select className="form-input form-select" value={form.rolId} onChange={f('rolId')}>
              {roles.map(r => <option key={r.id} value={r.id}>{r.nombreRol}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
            <input type="checkbox" id="chkCancelar" checked={form.puedeCancelarServido} onChange={f('puedeCancelarServido')} style={{ width: 16, height: 16 }} />
            <label htmlFor="chkCancelar" style={{ margin: 0, cursor: 'pointer' }}>Permitir cancelar pedidos servidos</label>
          </div>
        </Modal>
      )}
    </div>
  );
}

