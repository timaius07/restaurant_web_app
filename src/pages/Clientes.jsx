import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';
import { v4 as uuid } from '../data/uuid';

const EMPTY = { nombre: '', identificacionFiscal: '', telefono: '', email: '' };

export default function Clientes() {
  const { clientes, addCliente, updateCliente, deleteCliente } = useApp();
  const [modal, setModal]   = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm]     = useState(EMPTY);
  const [busqueda, setBusqueda] = useState('');

  const lista = clientes.filter(c =>
    `${c.nombre} ${c.identificacionFiscal} ${c.email}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  const openAdd  = () => { setForm(EMPTY); setModal('add'); };
  const openEdit = (c) => { setSelected(c); setForm({ nombre: c.nombre, identificacionFiscal: c.identificacionFiscal, telefono: c.telefono, email: c.email }); setModal('edit'); };

  const handleSave = () => {
    if (!form.nombre.trim()) return toast.error('El nombre es requerido');
    if (modal === 'add') { addCliente({ ...form }); toast.success('Cliente creado'); }
    else { updateCliente(selected.id, { ...form }); toast.success('Cliente actualizado'); }
    setModal(null);
  };

  const handleDelete = (id) => {
    if (!confirm('¿Eliminar este cliente?')) return;
    deleteCliente(id); toast.success('Cliente eliminado');
  };

  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  return (
    <div className="page-container animate-fade">
      <div className="page-header-row">
        <div><h1>Clientes</h1><p style={{color:'var(--text-secondary)',fontSize:'0.9rem',marginTop:4}}>{clientes.length} clientes registrados</p></div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Nuevo Cliente</button>
      </div>

      <div className="search-bar" style={{ marginBottom: 16 }}>
        <Search size={14} className="search-icon"/>
        <input className="form-input" placeholder="Buscar por nombre, cédula o email..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Nombre</th><th>Cédula/NIT</th><th>Teléfono</th><th>Email</th><th></th></tr></thead>
            <tbody>
              {lista.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                  <td style={{ fontFamily:'monospace',fontSize:'0.85rem' }}>{c.identificacionFiscal || '—'}</td>
                  <td>{c.telefono || '—'}</td>
                  <td style={{ color:'var(--text-secondary)' }}>{c.email || '—'}</td>
                  <td>
                    <div className="td-actions">
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(c)}><Edit2 size={14}/></button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(c.id)}><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title={modal==='add' ? 'Nuevo Cliente' : 'Editar Cliente'} onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
          </>}>
          <div className="form-group"><label className="form-label">Nombre completo *</label>
            <input className="form-input" value={form.nombre} onChange={f('nombre')} placeholder="Ej: Juan Pérez" /></div>
          <div className="form-group"><label className="form-label">Cédula / NIT / DNI</label>
            <input className="form-input" value={form.identificacionFiscal} onChange={f('identificacionFiscal')} placeholder="Ej: 1-1234-5678" /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Teléfono</label>
              <input className="form-input" value={form.telefono} onChange={f('telefono')} placeholder="Ej: 8888-1234" /></div>
            <div className="form-group"><label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} onChange={f('email')} placeholder="correo@ejemplo.com" /></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
