import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { Plus, Trash2, ArrowLeft, Send, X } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';
import './DetallePedido.css';

const ESTADO_BADGE = {
  Abierto:    'badge-info',
  Preparando: 'badge-warning',
  Servido:    'badge-purple',
  Pagado:     'badge-success',
  Cancelado:  'badge-danger',
};

export default function DetallePedido() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pedidos, detallePedidos, productos, categorias, mesas, clientes,
          addDetalle, updateDetalle, deleteDetalle, updatePedido, cancelarPedido, settings } = useApp();
  const { user, hasRole } = useAuth();

  const [showAddModal, setShowAddModal] = useState(false);
  const [catFiltro, setCatFiltro] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [addForm, setAddForm] = useState({ productoId: '', cantidad: 1, notas: '' });

  const pedido  = pedidos.find(p => p.id === id);
  const detalles = detallePedidos.filter(d => d.pedidoId === id);
  const mesa    = mesas.find(m => m.id === pedido?.mesaId);
  const cliente = clientes.find(c => c.id === pedido?.clienteId);
  const fmt     = (v) => formatCurrency(v, settings.moneda, settings.tasaCambio);

  if (!pedido) return (
    <div className="page-container"><p style={{ color: 'var(--text-secondary)' }}>Pedido no encontrado.</p>
      <button className="btn btn-secondary" onClick={() => navigate('/pedidos')}><ArrowLeft size={14}/> Volver</button>
    </div>
  );

  const subtotal = detalles.reduce((s, d) => s + d.precioMomento * d.cantidad, 0);
  const impuesto = Math.round(subtotal * (settings.tasaImpuesto / 100));
  const total    = subtotal + impuesto;

  const prodsFiltrados = productos.filter(p => p.activo
    && (!catFiltro || p.categoriaId === catFiltro)
    && (!busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  );

  const handleAddProducto = () => {
    if (!addForm.productoId) return toast.error('Seleccioná un producto');
    if (addForm.cantidad < 1) return toast.error('Cantidad inválida');
    addDetalle(id, addForm.productoId, Number(addForm.cantidad), addForm.notas);
    toast.success('Producto agregado');
    setAddForm({ productoId: '', cantidad: 1, notas: '' });
    setShowAddModal(false);
  };

  const handleRemove = (did) => {
    if (!confirm('¿Quitar este producto?')) return;
    deleteDetalle(did);
  };

  const handleEnviarCocina = () => {
    if (detalles.length === 0) return toast.error('Agregá al menos un producto');
    updatePedido(id, { estado: 'Preparando' });
    toast.success('Pedido enviado a cocina 🍳');
  };

  const handleCancelar = () => {
    if (!confirm('¿Cancelar este pedido?')) return;
    cancelarPedido(id);
    toast.error('Pedido cancelado');
    navigate('/pedidos');
  };

  const canEdit = ['Abierto', 'Preparando'].includes(pedido.estado) && hasRole('Admin', 'Mesero');
  const canCancel = canEdit || (pedido.estado === 'Servido' && (hasRole('Admin') || user?.puedeCancelarServido));

  return (
    <div className="page-container animate-fade">
      <div className="page-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/pedidos')}><ArrowLeft size={18}/></button>
          <div>
            <h1>Pedido — Mesa {mesa?.numeroMesa}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 2 }}>
              Cliente: {cliente?.nombre} · {new Date(pedido.fechaApertura).toLocaleString('es-CR')}
            </p>
          </div>
          <span className={`badge ${ESTADO_BADGE[pedido.estado]}`}>{pedido.estado}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canCancel && (
            <button className="btn btn-danger btn-sm" onClick={handleCancelar}><X size={14}/> Cancelar</button>
          )}
          {canEdit && (
            <>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}><Plus size={14}/> Agregar</button>
              {pedido.estado === 'Abierto' && detalles.length > 0 && (
                <button className="btn btn-success btn-sm" onClick={handleEnviarCocina}><Send size={14}/> Enviar a Cocina</button>
              )}
            </>
          )}
          {pedido.estado === 'Servido' && hasRole('Admin','Cajero') && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/facturacion?pedidoId=${id}`)}>
              Facturar
            </button>
          )}
        </div>
      </div>

      <div className="detalle-layout">
        {/* Líneas del pedido */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Productos del Pedido</div>
          {detalles.length === 0 ? (
            <div className="empty-state"><p>No hay productos. Agregá uno para comenzar.</p></div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Producto</th><th>Cant.</th><th>P. Unit.</th><th>Subtotal</th><th>Notas</th>{canEdit && <th></th>}</tr></thead>
                <tbody>
                  {detalles.map(d => {
                    const prod = productos.find(p => p.id === d.productoId);
                    return (
                      <tr key={d.id}>
                        <td style={{ fontWeight: 600 }}>{prod?.nombre || '—'}</td>
                        <td>
                          {canEdit ? (
                            <input type="number" min="1" className="form-input" style={{ width: 64, padding: '4px 8px' }}
                              value={d.cantidad}
                              onChange={e => updateDetalle(d.id, { cantidad: Number(e.target.value) })} />
                          ) : d.cantidad}
                        </td>
                        <td>{fmt(d.precioMomento)}</td>
                        <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{fmt(d.precioMomento * d.cantidad)}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{d.notas || '—'}</td>
                        {canEdit && (
                          <td><button className="btn btn-danger btn-icon btn-sm" onClick={() => handleRemove(d.id)}><Trash2 size={14}/></button></td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Resumen */}
        <div className="card detalle-summary">
          <div className="card-title" style={{ marginBottom: 16 }}>Resumen</div>
          <div className="summary-row"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
          <div className="summary-row"><span>IVA ({settings.tasaImpuesto}%)</span><span>{fmt(impuesto)}</span></div>
          <div className="divider"></div>
          <div className="summary-row total"><span>Total</span><span>{fmt(total)}</span></div>
        </div>
      </div>

      {/* Modal agregar producto */}
      {showAddModal && (
        <Modal title="Agregar Producto" onClose={() => setShowAddModal(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleAddProducto}>Agregar</button>
          </>}>
          <div className="form-group">
            <label className="form-label">Categoría</label>
            <select className="form-input form-select" value={catFiltro} onChange={e => setCatFiltro(e.target.value)}>
              <option value="">Todas</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Buscar producto</label>
            <input className="form-input" placeholder="Escribí el nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Producto</label>
            <select className="form-input form-select" value={addForm.productoId} onChange={e => setAddForm(f=>({...f, productoId: e.target.value}))}>
              <option value="">-- Seleccioná --</option>
              {prodsFiltrados.map(p => <option key={p.id} value={p.id}>{p.nombre} — {fmt(p.precioUnitario)}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cantidad</label>
              <input className="form-input" type="number" min="1" value={addForm.cantidad} onChange={e => setAddForm(f=>({...f, cantidad: e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Notas (opcional)</label>
              <input className="form-input" placeholder="Ej: sin cebolla" value={addForm.notas} onChange={e => setAddForm(f=>({...f, notas: e.target.value}))} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
