import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/formatters';
import { Plus, Edit2, Trash2, Search, Package } from 'lucide-react';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';

const EMPTY = { nombre: '', descripcion: '', precioUnitario: '', categoriaId: '', activo: true };

export default function Productos() {
  const { productos, categorias, addProducto, updateProducto, deleteProducto, settings } = useApp();
  const [modal, setModal]   = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm]     = useState(EMPTY);
  const [busqueda, setBusqueda] = useState('');
  const [catFiltro, setCatFiltro] = useState('');
  const fmt = (v) => formatCurrency(v, settings.moneda, settings.tasaCambio);

  const lista = productos.filter(p =>
    (!catFiltro || p.categoriaId == catFiltro) &&
    `${p.nombre} ${p.descripcion}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  const openAdd  = () => { setForm(EMPTY); setModal('add'); };
  const openEdit = (p) => { setSelected(p); setForm({ nombre: p.nombre, descripcion: p.descripcion, precioUnitario: p.precioUnitario, categoriaId: p.categoriaId, activo: p.activo }); setModal('edit'); };

  const handleSave = () => {
    if (!form.nombre.trim()) return toast.error('El nombre es requerido');
    if (!form.precioUnitario || Number(form.precioUnitario) <= 0) return toast.error('Precio inválido');
    if (!form.categoriaId) return toast.error('Seleccioná una categoría');
    const data = { ...form, precioUnitario: Number(form.precioUnitario) };
    if (modal === 'add') { addProducto(data); toast.success('Producto creado'); }
    else { updateProducto(selected.id, data); toast.success('Producto actualizado'); }
    setModal(null);
  };

  const handleDelete = (id) => {
    if (!confirm('¿Eliminar este producto?')) return;
    deleteProducto(id); toast.success('Producto eliminado');
  };

  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  return (
    <div className="page-container animate-fade">
      <div className="page-header-row">
        <div><h1>Productos</h1><p style={{color:'var(--text-secondary)',fontSize:'0.9rem',marginTop:4}}>{productos.filter(p=>p.activo).length} activos</p></div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Nuevo Producto</button>
      </div>

      <div style={{ display:'flex',gap:12,marginBottom:16,flexWrap:'wrap' }}>
        <div className="search-bar" style={{ flex:1,minWidth:200 }}>
          <Search size={14} className="search-icon"/>
          <input className="form-input" placeholder="Buscar producto..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <select className="form-input form-select" style={{ width:180 }} value={catFiltro} onChange={e => setCatFiltro(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {lista.map(p => {
                const cat = categorias.find(c => c.id === p.categoriaId);
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                      <div style={{ fontSize:'0.78rem',color:'var(--text-muted)',marginTop:2 }}>{p.descripcion}</div>
                    </td>
                    <td><span className="badge badge-muted">{cat?.nombre}</span></td>
                    <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmt(p.precioUnitario)}</td>

                    <td><span className={`badge ${p.activo ? 'badge-success' : 'badge-muted'}`}>{p.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td>
                      <div className="td-actions">
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(p)}><Edit2 size={14}/></button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(p.id)}><Trash2 size={14}/></button>
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
        <Modal title={modal==='add' ? 'Nuevo Producto' : 'Editar Producto'} onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
          </>}>
          <div className="form-group"><label className="form-label">Nombre *</label>
            <input className="form-input" value={form.nombre} onChange={f('nombre')} placeholder="Ej: Casado con Pollo"/></div>
          <div className="form-group"><label className="form-label">Descripción</label>
            <input className="form-input" value={form.descripcion} onChange={f('descripcion')} placeholder="Descripción breve"/></div>
          <div className="form-group"><label className="form-label">Precio Unitario (₡) *</label>
            <input className="form-input" type="number" min="0" value={form.precioUnitario} onChange={f('precioUnitario')} placeholder="5500"/></div>
          <div className="form-group"><label className="form-label">Categoría *</label>
            <select className="form-input form-select" value={form.categoriaId} onChange={f('categoriaId')}>
              <option value="">-- Seleccioná --</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></div>
          <div className="form-group">
            <label style={{ display:'flex',alignItems:'center',gap:8,cursor:'pointer' }}>
              <input type="checkbox" checked={form.activo} onChange={e => setForm(p => ({...p, activo: e.target.checked}))} />
              <span className="form-label" style={{ margin:0 }}>Producto activo</span>
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
