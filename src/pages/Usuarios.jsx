import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useTenant } from '../context/TenantContext';
import { Plus, Edit2, Trash2, Search, UserCheck, LayoutGrid, List, ShieldAlert, Utensils, Flame, CreditCard, Lock, Eye, EyeOff, KeyRound, User, Phone, Camera, X, Upload } from 'lucide-react';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';
import { confirmDialog } from '../utils/sweetAlert';
import { useRoles } from '../context/RolesContext';
import defaultMale from '../assets/default-male.jpg';
import defaultFemale from '../assets/default-female.jpg';
import './Usuarios.css';

const EMPTY = { username: '', pinHash: '', telefono: '', rolId: '1', nombre: '', foto: '', activo: 1 };

export default function Usuarios() {
  const navigate = useNavigate();
  const { tenantPath } = useTenant();
  const { usuarios = [], addUsuario, updateUsuario, deleteUsuario } = useApp();
  const { roles, getRoleBadgeClass, getAvatarClass, getRoleIcon, getRolePillClass, getRoleDotClass } = useRoles();
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busqueda, setBusqueda] = useState('');
  const [rolFiltro, setRolFiltro] = useState('todos');
  const [vista, setVista] = useState('tarjetas'); // 'tarjetas' | 'tabla'
  const [showPin, setShowPin] = useState(false);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [fotoFile, setFotoFile] = useState(null);
  const [selectedFotoOption, setSelectedFotoOption] = useState('custom'); // 'male' | 'female' | 'custom'
  const [formErrors, setFormErrors] = useState({});

  const openAdd = () => {
    setForm(EMPTY);
    setFotoPreview(null);
    setFotoFile(null);
    setSelectedFotoOption('custom');
    setFormErrors({});
    setModal('add');
  };
  const openEdit = (u) => {
    setSelected(u);
    setForm({
      username: u.username,
      pinHash: '',          // leave blank = don't change
      telefono: u.telefono || '',
      rolId: String(u.rolId),
      nombre: u.nombre,
      foto: u.foto || '',
      activo: u.activo !== undefined ? u.activo : 1
    });
    setFotoPreview(u.foto || null);
    setShowPin(false);
    setSelectedFotoOption(u.foto ? 'custom' : 'male');
    setFormErrors({});
    setModal('edit');
  };

  const TELEFONO_REGEX = /^\d{4}-\d{4}$/;

  const validateField = (field, value) => {
    const errors = { ...formErrors };
    
    switch (field) {
      case 'nombre':
        if (!value.trim()) {
          errors.nombre = 'El nombre es requerido';
        } else if (value.length > 30) {
          errors.nombre = 'Máximo 30 caracteres';
        } else {
          delete errors.nombre;
        }
        break;
      case 'username':
        if (!value.trim()) {
          errors.username = 'El usuario es requerido';
        } else if (value.length > 25) {
          errors.username = 'Máximo 25 caracteres';
        } else {
          delete errors.username;
        }
        break;
      case 'telefono':
        if (value && value.trim()) {
          if (value.length > 20) {
            errors.telefono = 'Máximo 20 caracteres';
          } else if (!TELEFONO_REGEX.test(value.trim())) {
            errors.telefono = 'Formato inválido (ej: 8765-4321)';
          } else {
            delete errors.telefono;
          }
        } else {
          delete errors.telefono;
        }
        break;
      case 'pinHash':
        if (modal === 'add') {
          if (!value) {
            errors.pinHash = 'El PIN es requerido';
          } else if (!/^\d{4}$/.test(value)) {
            errors.pinHash = 'Debe ser 4 dígitos';
          } else {
            delete errors.pinHash;
          }
        } else {
          if (value && !/^\d{4}$/.test(value)) {
            errors.pinHash = 'Debe ser 4 dígitos';
          } else {
            delete errors.pinHash;
          }
        }
        break;
      case 'rolId':
        if (!value) {
          errors.rolId = 'El rol es requerido';
        } else {
          delete errors.rolId;
        }
        break;
      default:
        break;
    }
    
    setFormErrors(errors);
  };

  const isFormValid = () => {
    const hasRequiredFields = form.nombre.trim() && form.username.trim() && form.rolId;
    const pinValid = modal === 'add' ? form.pinHash && /^\d{4}$/.test(form.pinHash) : true;
    const noErrors = Object.keys(formErrors).length === 0;
    return hasRequiredFields && pinValid && noErrors;
  };

  const handleSave = async () => {
    const telefonoTrimmed = (form.telefono || '').trim();
    
    try {
      if (modal === 'add') {
        await addUsuario({ ...form, telefono: telefonoTrimmed });
      } else {
        const changes = { ...form, telefono: telefonoTrimmed };
        if (!changes.pinHash) delete changes.pinHash; // blank = don't overwrite
        await updateUsuario(selected.id, changes);
      }
      setModal(null);
    } catch {
      // El error y el toast ya fueron manejados por AppContext
    }
  };


  const handleDelete = async (id) => {
    const confirmed = await confirmDialog({
      title: '¿Eliminar este usuario?',
      text: 'El usuario perderá acceso al sistema.',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmed) return;
    try {
      await deleteUsuario(id);
    } catch {
      // El error y el toast ya fueron manejados por AppContext
    }
  };

  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleFotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar que sea imagen
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona una imagen válida');
      return;
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar los 5MB');
      return;
    }

    try {
      // Redimensionar y comprimir imagen
      const compressedImage = await compressImage(file, 300, 400, 0.8); // 300x400px, calidad 80%
      setFotoPreview(compressedImage);
      setFotoFile(compressedImage);
      setForm(p => ({ ...p, foto: compressedImage }));
      setSelectedFotoOption('custom');
    } catch (err) {
      console.error('Error al procesar imagen:', err);
      toast.error('Error al procesar la imagen');
    }
  };

  const handleSelectDefaultFoto = (option) => {
    setSelectedFotoOption(option);
    if (option === 'male') {
      setFotoPreview(defaultMale);
      setForm(p => ({ ...p, foto: defaultMale }));
    } else if (option === 'female') {
      setFotoPreview(defaultFemale);
      setForm(p => ({ ...p, foto: defaultFemale }));
    }
  };

  const compressImage = (file, maxWidth, maxHeight, quality) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calcular nuevas dimensiones manteniendo aspect ratio
          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Comprimir como JPEG con calidad especificada
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleRemoveFoto = () => {
    setFotoPreview(null);
    setFotoFile(null);
    setForm(p => ({ ...p, foto: '' }));
  };

  const listaFiltrada = usuarios.filter(u => {
    const matchBusqueda = `${u.nombre} ${u.username} ${u.telefono || ''}`.toLowerCase().includes(busqueda.toLowerCase());
    const matchRol = rolFiltro === 'todos' || String(u.rolId) === String(rolFiltro);
    return matchBusqueda && matchRol;
  });

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
        <div className="usuarios-header-actions" style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(tenantPath('/roles'))}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <KeyRound size={16} /> Permisos de Roles
          </button>
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
          const pillClass = getRolePillClass(r.id);
          const dotClass = getRoleDotClass(r.id);

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
            placeholder="Buscar usuario por nombre, usuario o teléfono..."
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
              <div key={u.id} className={`usuario-card-stitch ${u.activo === 0 ? 'inactivo' : ''}`}>
                <div className="usuario-card-header">
                  <span className={`badge ${getRoleBadgeClass(u.rolId)}`}>
                    {rol?.nombreRol || 'Usuario'}
                  </span>
                  
                  <span className="user-username-tag">@{u.username}</span>
                </div>

                <div className="usuario-card-body">
                  <div className={`usuario-avatar-container ${getAvatarClass(u.rolId)}`}>
                    {getRoleIcon(u.rolId)}
                  </div>

                  <div className="usuario-full-name">{u.nombre}</div>
                  <div className="usuario-email">{u.telefono || 'Sin teléfono registrado'}</div>
                </div>

                <div className="usuario-card-divider" />

                <div className="usuario-card-footer">
                  <span className={`usuario-status-tag ${u.activo !== 0 ? 'activo' : 'inactivo'}`}>{u.activo !== 0 ? 'Activo' : 'Bloqueado'}</span>
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
                  <th>Teléfono</th>
                  <th>Rol</th>
                  <th>Estado</th>
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
                      <td style={{ color: 'var(--text-secondary)' }}>{u.telefono || '—'}</td>
                      <td>
                        <span className={`badge ${getRoleBadgeClass(u.rolId)}`}>
                          {rol?.nombreRol || 'Usuario'}
                        </span>
                      </td>
                      <td>
                        <span className={`usuario-status-tag ${u.activo !== 0 ? 'activo' : 'inactivo'}`}>{u.activo !== 0 ? 'Activo' : 'Bloqueado'}</span>
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
            <button className="btn btn-primary" onClick={handleSave} disabled={!isFormValid()}>Guardar</button>
          </>}
        >
          {/* Foto de perfil */}
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Foto de perfil</label>
            
            {/* Carrusel de opciones */}
            <div className="foto-carousel">
              <div
                className={`carousel-option ${selectedFotoOption === 'male' ? 'active' : ''}`}
                onClick={() => handleSelectDefaultFoto('male')}
              >
                <img src={defaultMale} alt="Hombre" className="carousel-option-img" />
                <span className="carousel-option-label">Hombre</span>
              </div>
              
              <div
                className={`carousel-option ${selectedFotoOption === 'female' ? 'active' : ''}`}
                onClick={() => handleSelectDefaultFoto('female')}
              >
                <img src={defaultFemale} alt="Mujer" className="carousel-option-img" />
                <span className="carousel-option-label">Mujer</span>
              </div>
              
              <div
                className={`carousel-option ${selectedFotoOption === 'custom' ? 'active' : ''}`}
                onClick={() => setSelectedFotoOption('custom')}
              >
                <label className="carousel-custom-option">
                  <Upload size={32} />
                  <span>Subir foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFotoChange}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

            {/* Preview de foto seleccionada */}
            {fotoPreview && (
              <div className="foto-preview-container">
                <img
                  src={fotoPreview}
                  alt="Foto de perfil"
                  className="foto-preview-display"
                />
                {selectedFotoOption === 'custom' && (
                  <button
                    type="button"
                    className="btn-remove-foto"
                    onClick={handleRemoveFoto}
                    title="Eliminar foto"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            )}
            
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Selecciona una imagen default o sube una personalizada. Las imágenes se redimensionan automáticamente a 300x400px.
            </div>
          </div>
          {/* Fila 1: Nombre y Usuario */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nombre completo *</label>
              <div className="input-with-icon">
                <User size={16} className="input-icon" />
                <input 
                  className="form-input" 
                  value={form.nombre} 
                  onChange={e => {
                    f('nombre')(e);
                    validateField('nombre', e.target.value);
                  }} 
                  placeholder="Juan Pérez" 
                />
              </div>
              {formErrors.nombre && <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: 4 }}>{formErrors.nombre}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Usuario *</label>
              <div className="input-with-icon">
                <UserCheck size={16} className="input-icon" />
                <input 
                  className="form-input" 
                  value={form.username} 
                  onChange={e => {
                    f('username')(e);
                    validateField('username', e.target.value);
                  }} 
                  placeholder="juan99" 
                />
              </div>
              {formErrors.username && <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: 4 }}>{formErrors.username}</div>}
            </div>
          </div>

          {/* Fila 2: Teléfono y Rol */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <div className="input-with-icon">
                <Phone size={16} className="input-icon" />
                <input
                  className="form-input"
                  type="tel"
                  inputMode="numeric"
                  maxLength={9}
                  value={form.telefono}
                  onChange={(e) => {
                    // Solo dígitos y guión; insertar guión automáticamente tras 4 dígitos
                    const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 8);
                    const formatted = raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
                    setForm(p => ({ ...p, telefono: formatted }));
                    validateField('telefono', formatted);
                  }}
                  placeholder="8765-4321"
                />
              </div>
              {formErrors.telefono && <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: 4 }}>{formErrors.telefono}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Rol *</label>
              <select 
                className="form-input form-select" 
                value={form.rolId} 
                onChange={e => {
                  f('rolId')(e);
                  validateField('rolId', e.target.value);
                }}
              >
                {roles.map(r => <option key={r.id} value={r.id}>{r.nombreRol}</option>)}
              </select>
              {formErrors.rolId && <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: 4 }}>{formErrors.rolId}</div>}
            </div>
          </div>
          
          {/* Fila 3: PIN expandido al 100% */}
          <div className="form-group" style={{ width: '100%' }}>
            <label className="form-label">
              {modal === 'edit' ? 'Nuevo PIN (dejar vacío para no cambiar)' : 'PIN de 4 dígitos *'}
            </label>
            <div className="input-with-icon" style={{ position: 'relative' }}>
              <Lock size={16} className="input-icon" />
              <input
                className="form-input"
                type={showPin ? 'text' : 'password'}
                maxLength={4}
                value={form.pinHash}
                onChange={(e) => {
                  const nums = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setForm(p => ({ ...p, pinHash: nums }));
                  validateField('pinHash', nums);
                }}
                onKeyDown={(e) => {
                  if (e.key.length === 1 && !/\d/.test(e.key) && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                  }
                }}
                placeholder={modal === 'edit' ? 'Dejar vacío para no cambiar' : 'Ingresa 4 dígitos numéricos'}
                style={{
                  fontFamily: form.pinHash ? 'monospace' : 'inherit',
                  letterSpacing: form.pinHash ? '6px' : 'normal',
                  fontWeight: form.pinHash ? 700 : 400,
                  paddingRight: 40,
                  width: '100%'
                }}
                inputMode="numeric"
                pattern="\d{4}"
              />
              {formErrors.pinHash && <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: 4 }}>{formErrors.pinHash}</div>}
              <button
                type="button"
                onClick={() => setShowPin(v => !v)}
                style={{
                  position: 'absolute',
                  right: 12,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 4
                }}
                title={showPin ? 'Ocultar PIN' : 'Ver PIN'}
              >
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Fila 4: Toggle Switch Activo */}
          <div className="usuario-toggle-container">
            <div className="usuario-toggle-info">
              <div className="usuario-toggle-title">USUARIO ACTIVO</div>
              <div className="usuario-toggle-desc">
                {form.activo
                  ? 'El usuario está habilitado para iniciar turno con su PIN.'
                  : 'El usuario está inactivo o bloqueado. Actívalo para permitir su acceso.'}
              </div>
            </div>
            <label className={`toggle-switch ${form.activo ? 'active' : ''}`}>
              <input
                type="checkbox"
                checked={form.activo === 1 || form.activo === true}
                onChange={e => setForm(p => ({ ...p, activo: e.target.checked ? 1 : 0 }))}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </Modal>

      )}
    </div>
  );
}

