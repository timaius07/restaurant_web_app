import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';
import { confirmDialog } from '../utils/sweetAlert';

const EMPTY = { nombre: '', activo: true };

export default function MetodosPago() {
  const { metodosPago, addMetodoPago, updateMetodoPago, deleteMetodoPago } = useApp();
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const openAdd  = () => { setForm(EMPTY); setModal('add'); };
  const openEdit = (m) => { setSelected(m); setForm({ nombre: m.nombre, activo: m.activo }); setModal('edit'); };

  const handleSave = () => {
    if (!form.nombre.trim()) return toast.error('El nombre es requerido');
    if (modal === 'add') { addMetodoPago({ ...form }); toast.success('Método creado'); }
    else { updateMetodoPago(selected.id, { ...form }); toast.success('Método actualizado'); }
    setModal(null);
  };

  const handleToggle = (m) => { updateMetodoPago(m.id, { activo: !m.activo }); };
  const handleDelete = async (id) => {
    const confirmed = await confirmDialog({
      title: '¿Eliminar este método de pago?',
      text: 'Se removerá de las opciones disponibles en facturación.',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmed) return;
    deleteMetodoPago(id);
    toast.success('Método eliminado');
  };

  return (
    <div className="page-container animate-fade">
      <div className="page-header-row">
        <div><h1>Métodos de Pago</h1></div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Nuevo Método</button>
      </div>
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Nombre</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {metodosPago.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight:600 }}>{m.nombre}</td>
                  <td>
                    <button className={`badge ${m.activo ? 'badge-success' : 'badge-muted'}`} style={{ border:'none',cursor:'pointer' }} onClick={() => handleToggle(m)}>
                      {m.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td>
                    <div className="td-actions">
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(m)}><Edit2 size={14}/></button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(m.id)}><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal && (
        <Modal title={modal==='add' ? 'Nuevo Método de Pago' : 'Editar Método'} onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
          </>}>
          <div className="form-group"><label className="form-label">Nombre *</label>
            <input className="form-input" value={form.nombre} onChange={e => setForm(p=>({...p,nombre:e.target.value}))} placeholder="Ej: Efectivo, SINPE, QR" autoFocus /></div>
          <label style={{ display:'flex',alignItems:'center',gap:8,cursor:'pointer' }}>
            <input type="checkbox" checked={form.activo} onChange={e => setForm(p=>({...p,activo:e.target.checked}))}/>
            <span className="form-label" style={{ margin:0 }}>Activo</span>
          </label>
        </Modal>
      )}
    </div>
  );
}
