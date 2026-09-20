import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/formatters';
import { Plus, Edit2, Trash2, Search, Package, LayoutGrid, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { getCategoryIcon } from '../utils/categoryIcons';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';
import { confirmDialog } from '../utils/sweetAlert';
import './Productos.css';

const EMPTY = { nombre: '', descripcion: '', precioUnitario: '', categoriaId: '', activo: true };

export default function Productos() {
  const { productos, categorias, addProducto, updateProducto, deleteProducto, settings } = useApp();
  const categoriesNavRef = useRef(null);

  const [vista, setVista] = useState('grid'); // 'grid' | 'tabla'
  const [modal, setModal] = useState(null); // 'add' | 'edit'
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busqueda, setBusqueda] = useState('');
  const [catFiltro, setCatFiltro] = useState('');

  const fmt = (v) => formatCurrency(v, settings.moneda, settings.tasaCambio);

  const scrollCategories = (direction) => {
    if (categoriesNavRef.current) {
      const scrollAmount = direction === 'left' ? -260 : 260;
      categoriesNavRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const lista = productos.filter(p =>
    (!catFiltro || String(p.categoriaId) === String(catFiltro)) &&
    `${p.nombre} ${p.descripcion}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  const countByCat = (catId) => {
    if (!catId) return productos.length;
    return productos.filter(p => String(p.categoriaId) === String(catId)).length;
  };

  const openAdd = () => {
    setForm({ ...EMPTY, categoriaId: categorias[0]?.id || '' });
    setModal('add');
  };

  const openEdit = (p) => {
    setSelected(p);
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion,
      precioUnitario: p.precioUnitario,
      categoriaId: p.categoriaId,
      activo: p.activo
    });
    setModal('edit');
  };

  const handleSave = () => {
    if (!form.nombre.trim()) return toast.error('El nombre es requerido');
    if (!form.precioUnitario || Number(form.precioUnitario) <= 0) return toast.error('Precio inválido');
    if (!form.categoriaId) return toast.error('Seleccioná una categoría');

    const data = { ...form, precioUnitario: Number(form.precioUnitario) };
    if (modal === 'add') {
      addProducto(data);
      toast.success('Producto creado');
    } else {
      updateProducto(selected.id, data);
      toast.success('Producto actualizado');
    }
    setModal(null);
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmDialog({
      title: '¿Eliminar este producto?',
      text: 'Se removerá del menú y catálogo del restaurante.',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmed) return;
    deleteProducto(id);
    toast.success('Producto eliminado');
  };

  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  return (
    <div className="page-container animate-fade">
      {/* Header Section */}
      <div className="productos-header-section">
        <div>
          <h1 className="productos-title">Gestión de Productos</h1>
          <p className="productos-subtitle">Catálogo de platillos, bebidas y postres del menú ({productos.filter(p=>p.activo).length} activos)</p>
        </div>
        <div className="productos-header-actions">
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Nuevo Producto
          </button>
        </div>
      </div>

      {/* Category Pills Nav Bar with Scroll Controls */}
      <div className="productos-categories-wrapper">
        <button
          type="button"
          className="cat-scroll-btn btn-left"
          onClick={() => scrollCategories('left')}
          title="Desplazar categorías hacia la izquierda"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="productos-categories-bar" ref={categoriesNavRef}>
          <button
            type="button"
            className={`cat-pill ${catFiltro === '' ? 'active' : ''}`}
            onClick={() => setCatFiltro('')}
          >
            <span className="cat-pill-icon">{getCategoryIcon('Todas', 15)}</span>
            <span className="cat-pill-text">Todas</span>
            <span className="cat-pill-count">{countByCat('')}</span>
          </button>
          {categorias.map(c => (
            <button
              key={c.id}
              type="button"
              className={`cat-pill ${String(catFiltro) === String(c.id) ? 'active' : ''}`}
              onClick={() => setCatFiltro(String(catFiltro) === String(c.id) ? '' : c.id)}
            >
              <span className="cat-pill-icon">{getCategoryIcon(c.nombre, 15)}</span>
              <span className="cat-pill-text">{c.nombre}</span>
              <span className="cat-pill-count">{countByCat(c.id)}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="cat-scroll-btn btn-right"
          onClick={() => scrollCategories('right')}
          title="Desplazar categorías hacia la derecha"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Controls Bar: Search & View Toggle */}
      <div className="productos-controls-bar">
        <div className="search-bar" style={{ flex: 1, minWidth: 220 }}>
          <Search size={14} className="search-icon" />
          <input
            className="form-input"
            placeholder="Buscar por nombre o descripción..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>

        <div className="view-toggle-group">
          <button
            type="button"
            className={`btn-toggle-view ${vista === 'grid' ? 'active' : ''}`}
            onClick={() => setVista('grid')}
            title="Vista de Cuadrícula"
          >
            <LayoutGrid size={15} />
            <span>Tarjetas</span>
          </button>
          <button
            type="button"
            className={`btn-toggle-view ${vista === 'tabla' ? 'active' : ''}`}
            onClick={() => setVista('tabla')}
            title="Vista de Tabla"
          >
            <List size={15} />
            <span>Tabla</span>
          </button>
        </div>
      </div>

      {/* Main View Render */}
      {lista.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 30 }}>
          <Package size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
          <p>No se encontraron productos en esta selección.</p>
        </div>
      ) : vista === 'grid' ? (
        /* Stitch Cards Grid View */
        <div className="productos-grid-stitch">
          {lista.map(p => {
            const cat = categorias.find(c => String(c.id) === String(p.categoriaId));
            return (
              <div key={p.id} className={`producto-card-stitch ${!p.activo ? 'inactivo' : ''}`}>
                <div className="producto-card-header">
                  <span className="cat-tag">
                    {getCategoryIcon(cat?.nombre, 13)} {cat?.nombre || 'General'}
                  </span>
                  <span className="status-badge-sm">
                    <span className={p.activo ? 'dot-active' : 'dot-inactive'}></span>
                    <span style={{ color: p.activo ? 'var(--success)' : 'var(--text-muted)' }}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </span>
                </div>

                <div className="producto-card-body">
                  <div className="producto-icon-container">
                    {getCategoryIcon(cat?.nombre, 24)}
                  </div>
                  <div className="producto-name">{p.nombre}</div>
                  <div className="producto-description">{p.descripcion || 'Sin descripción'}</div>
                  <div className="producto-price">{fmt(p.precioUnitario)}</div>
                </div>

                <div className="producto-card-divider"></div>

                <div className="producto-card-footer">
                  <button
                    className="btn-card-action"
                    title="Editar producto"
                    onClick={() => openEdit(p)}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    className="btn-card-action btn-action-danger"
                    title="Eliminar producto"
                    onClick={() => handleDelete(p.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.map(p => {
                  const cat = categorias.find(c => String(c.id) === String(p.categoriaId));
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{p.nombre}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {p.descripcion}
                        </div>
                      </td>
                      <td><span className="cat-tag">{cat?.nombre || 'General'}</span></td>
                      <td style={{ fontWeight: 800, color: 'var(--accent)' }}>{fmt(p.precioUnitario)}</td>
                      <td>
                        <span className={`badge ${p.activo ? 'badge-success' : 'badge-muted'}`}>
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className="td-actions">
                          <button className="btn btn-ghost btn-icon btn-sm" title="Editar" onClick={() => openEdit(p)}>
                            <Edit2 size={14} />
                          </button>
                          <button className="btn btn-danger btn-icon btn-sm" title="Eliminar" onClick={() => handleDelete(p.id)}>
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
          title={modal === 'add' ? 'Nuevo Producto' : 'Editar Producto'}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
          </>}
        >
          <div className="form-group">
            <label className="form-label">Nombre *</label>
            <input className="form-input" value={form.nombre} onChange={f('nombre')} placeholder="Ej: Casado con Pollo" />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <input className="form-input" value={form.descripcion} onChange={f('descripcion')} placeholder="Descripción breve del platillo o bebida" />
          </div>
          <div className="form-group">
            <label className="form-label">Precio Unitario (₡) *</label>
            <input className="form-input" type="number" min="0" value={form.precioUnitario} onChange={f('precioUnitario')} placeholder="5500" />
          </div>
          <div className="form-group">
            <label className="form-label">Categoría *</label>
            <select className="form-input form-select" value={form.categoriaId} onChange={f('categoriaId')}>
              <option value="">-- Seleccioná --</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.activo} onChange={e => setForm(p => ({ ...p, activo: e.target.checked }))} />
              <span className="form-label" style={{ margin: 0 }}>Producto activo</span>
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
