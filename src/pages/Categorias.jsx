import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { getCategoryIcon } from '../utils/categoryIcons';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';
import { confirmDialog } from '../utils/sweetAlert';
import './Categorias.css';

export default function Categorias() {
  const { categorias, addCategoria, updateCategoria, deleteCategoria, productos } = useApp();
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [nombre, setNombre] = useState('');
  const [formErrors, setFormErrors] = useState({});

  const openAdd  = () => { setNombre(''); setFormErrors({}); setModal('add'); };
  const openEdit = (c) => { setSelected(c); setNombre(c.nombre); setFormErrors({}); setModal('edit'); };

  const validateField = (value) => {
    const errors = { ...formErrors };
    
    if (!value.trim()) {
      errors.nombre = 'El nombre es requerido';
    } else if (value.length > 100) {
      errors.nombre = 'Máximo 100 caracteres';
    } else {
      delete errors.nombre;
    }
    
    setFormErrors(errors);
  };

  const isFormValid = () => {
    return nombre.trim() && Object.keys(formErrors).length === 0;
  };

  const handleSave = () => {
    if (modal === 'add') { addCategoria({ nombre }); toast.success('Categoría creada'); }
    else { updateCategoria(selected.id, { nombre }); toast.success('Categoría actualizada'); }
    setModal(null);
  };

  const handleDelete = async (id) => {
    const usada = productos.some(p => p.categoriaId === id);
    if (usada) return toast.error('No se puede eliminar: hay productos en esta categoría');
    const confirmed = await confirmDialog({
      title: '¿Eliminar esta categoría?',
      text: 'La categoría será eliminada del menú.',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmed) return;
    deleteCategoria(id);
    toast.success('Categoría eliminada');
  };

  return (
    <div className="page-container animate-fade">
      <div className="page-header-row">
        <div><h1>Categorías</h1><p style={{color:'var(--text-secondary)',fontSize:'0.9rem',marginTop:4}}>{categorias.length} categorías</p></div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Nueva Categoría</button>
      </div>
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Categoría</th><th>Productos</th><th>Acciones</th></tr></thead>
            <tbody>
              {categorias.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight:600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ display: 'inline-flex', padding: 6, borderRadius: '50%', background: 'var(--bg-hover)', color: 'var(--accent)' }}>
                        {getCategoryIcon(c.nombre, 18)}
                      </span>
                      <span>{c.nombre}</span>
                    </div>
                  </td>
                  <td><span className="badge badge-muted">{productos.filter(p => p.categoriaId === c.id).length}</span></td>
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
        <Modal title={modal==='add' ? 'Nueva Categoría' : 'Editar Categoría'} onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!isFormValid()}>Guardar</button>
          </>}>
          <div className="form-group"><label className="form-label">Nombre *</label>
            <input 
              className="form-input" 
              value={nombre} 
              onChange={e => {
                setNombre(e.target.value);
                validateField(e.target.value);
              }} 
              placeholder="Ej: Bebidas" 
              autoFocus 
            />
            {formErrors.nombre && <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: 4 }}>{formErrors.nombre}</div>}
          </div>
        </Modal>
      )}
    </div>
  );
}
