import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';
import { ROLES } from '../data/seedData';

const EMPTY = { username:'', passwordHash:'', email:'', rolId:'1', nombre:'', puedeCancelarServido: false };

export default function Usuarios() {
  const { getUsuarios, addUsuario, updateUsuario, deleteUsuario } = useApp();
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm]   = useState(EMPTY);
  const [usuarios, setUsuarios] = useState(() => getUsuarios());

  const refresh = () => setUsuarios(getUsuarios());

  const openAdd  = () => { setForm(EMPTY); setModal('add'); };
  const openEdit = (u) => { setSelected(u); setForm({ username:u.username, passwordHash:'', email:u.email, rolId:u.rolId, nombre:u.nombre, puedeCancelarServido: !!u.puedeCancelarServido }); setModal('edit'); };

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
    refresh(); setModal(null);
  };

  const handleDelete = (id) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    deleteUsuario(id); refresh(); toast.success('Usuario eliminado');
  };

  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const roles = ROLES;

  return (
    <div className="page-container animate-fade">
      <div className="page-header-row">
        <div><h1>Usuarios</h1><p style={{color:'var(--text-secondary)',fontSize:'0.9rem',marginTop:4}}>{usuarios.length} usuarios registrados</p></div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Nuevo Usuario</button>
      </div>
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Nombre</th><th>Usuario</th><th>Email</th><th>Rol</th><th></th></tr></thead>
            <tbody>
              {usuarios.map(u => {
                const rol = roles.find(r => r.id === u.rolId);
                const ROLE_BADGE = { Admin:'badge-danger', Mesero:'badge-info', Cocina:'badge-warning', Cajero:'badge-success' };
                return (
                  <tr key={u.id}>
                    <td style={{ fontWeight:600 }}>{u.nombre}</td>
                    <td style={{ fontFamily:'monospace',fontSize:'0.85rem',color:'var(--text-secondary)' }}>{u.username}</td>
                    <td style={{ color:'var(--text-secondary)' }}>{u.email}</td>
                    <td><span className={`badge ${ROLE_BADGE[rol?.nombreRol] || 'badge-muted'}`}>{rol?.nombreRol}</span></td>
                    <td>
                      <div className="td-actions">
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(u)}><Edit2 size={14}/></button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(u.id)}><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {modal && (
        <Modal title={modal==='add' ? 'Nuevo Usuario' : 'Editar Usuario'} onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
          </>}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Nombre completo *</label>
              <input className="form-input" value={form.nombre} onChange={f('nombre')} placeholder="Juan Pérez"/></div>
            <div className="form-group"><label className="form-label">Usuario *</label>
              <input className="form-input" value={form.username} onChange={f('username')} placeholder="juan99"/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">{modal==='edit' ? 'Nueva Contraseña' : 'Contraseña *'}</label>
              <input className="form-input" type="password" value={form.passwordHash} onChange={f('passwordHash')} placeholder={modal==='edit'?'Dejar vacío para no cambiar':'••••••••'}/></div>
            <div className="form-group"><label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} onChange={f('email')} placeholder="correo@soda.cr"/></div>
          </div>
          <div className="form-group"><label className="form-label">Rol *</label>
            <select className="form-input form-select" value={form.rolId} onChange={f('rolId')}>
              {roles.map(r => <option key={r.id} value={r.id}>{r.nombreRol}</option>)}
            </select></div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
            <input type="checkbox" id="chkCancelar" checked={form.puedeCancelarServido} onChange={f('puedeCancelarServido')} style={{ width: 16, height: 16 }} />
            <label htmlFor="chkCancelar" style={{ margin: 0, cursor: 'pointer' }}>Permitir cancelar pedidos servidos</label>
          </div>
        </Modal>
      )}
    </div>
  );
}
