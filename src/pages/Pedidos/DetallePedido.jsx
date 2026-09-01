import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { Plus, Trash2, ArrowLeft, Send, X, Receipt } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import SearchableSelect from '../../components/ui/SearchableSelect';
import toast from 'react-hot-toast';
import { confirmDialog } from '../../utils/sweetAlert';
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
  const [addForm, setAddForm] = useState({ productoId: '', cantidad: 1, notas: '' });

  const pedido  = pedidos.find(p => p.id === Number(id));
  const detalles = detallePedidos.filter(d => d.pedidoId === Number(id));
  const mesa    = mesas.find(m => m.id === pedido?.mesaId);
  const cliente = clientes.find(c => c.id === pedido?.clienteId);
  const fmt     = (v) => formatCurrency(v, settings.moneda, settings.tasaCambio);

  if (!pedido) return (
    <div className="page-container"><p style={{ color: 'var(--text-secondary)' }}>Pedido no encontrado.</p>
      <button className="btn btn-secondary" onClick={() => navigate('/pedidos')}><ArrowLeft size={14}/> Volver</button>
    </div>
  );

  // Normativa Costa Rica (MEIC): Los precios de los alimentos preparados ya incluyen el 13% IVA
  const totalProductos = detalles.reduce((s, d) => s + d.precioMomento * d.cantidad, 0);
  const subtotalSinIVA = Math.round(totalProductos / 1.13);
  const montoIVA = totalProductos - subtotalSinIVA; // Desglose informativo 13% IVA

  const handleAddProducto = () => {
    if (!addForm.productoId) return toast.error('Seleccioná un producto');
    if (addForm.cantidad < 1) return toast.error('Cantidad inválida');
    addDetalle(id, addForm.productoId, Number(addForm.cantidad), addForm.notas);
    toast.success('Producto agregado');
    setAddForm({ productoId: '', cantidad: 1, notas: '' });
    setShowAddModal(false);
  };

  const handleRemove = async (did) => {
    const confirmed = await confirmDialog({
      title: '¿Quitar este producto?',
      text: 'El producto se eliminará de la comanda de este pedido.',
      confirmButtonText: 'Sí, quitar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmed) return;
    deleteDetalle(did);
    toast.success('Producto removido');
  };

  const handleEnviarCocina = () => {
    if (detalles.length === 0) return toast.error('Agregá al menos un producto');
    updatePedido(id, { estado: 'Preparando' });
    toast.success('Pedido enviado a cocina 🍳');
  };

  const handleCancelar = async () => {
    const confirmed = await confirmDialog({
      title: '¿Cancelar este pedido?',
      text: 'El estado del pedido cambiará a Cancelado.',
      confirmButtonText: 'Sí, cancelar pedido',
      cancelButtonText: 'Volver'
    });
    if (!confirmed) return;
    cancelarPedido(id);
    toast.error('Pedido cancelado');
    navigate('/pedidos');
  };

  const canEdit = ['Abierto', 'Preparando'].includes(pedido.estado) && hasRole('Admin', 'Mesero');
  const canCancel = canEdit || (pedido.estado === 'Servido' && (hasRole('Admin') || user?.puedeCancelarServido));
  const canFacturar = ['Servido', 'Preparando', 'Abierto'].includes(pedido.estado) && hasRole('Admin', 'Cajero', 'Mesero');

  const prodsFiltrados = productos.filter(p => !catFiltro || p.categoriaId === Number(catFiltro));

  return (
    <div className="page-container animate-fade">
      <div className="page-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/pedidos')}><ArrowLeft size={18}/></button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0 }}>Pedido — {pedido.tipoPedido === 'Delivery' ? 'Delivery' : `Mesa ${mesa?.numeroMesa || '—'}`}</h1>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {canFacturar && (
                  <button className="btn btn-primary" onClick={() => navigate(`/facturacion?pedidoId=${id}`)}>
                    <Receipt size={16}/> Facturar
                  </button>
                )}
                {canCancel && (
                  <button className="btn btn-danger btn-sm" onClick={handleCancelar}>
                    <X size={14}/> Cancelar
                  </button>
                )}
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 4 }}>
              Cliente: {cliente?.nombre} · {new Date(pedido.fechaApertura).toLocaleString('es-CR')}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {canEdit && (
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={16}/> Agregar
            </button>
          )}
          <span className={`badge ${ESTADO_BADGE[pedido.estado] || 'badge-muted'}`}>{pedido.estado}</span>
        </div>
      </div>

      <div className="detalle-layout">
        {/* Productos */}
        <div className="card detalle-products-card">
          <div className="card-title-row" style={{ marginBottom: 16 }}>
            <div className="card-title">Productos del Pedido</div>
            {pedido.estado === 'Abierto' && hasRole('Admin', 'Mesero') && (
              <button className="btn btn-warning btn-sm" onClick={handleEnviarCocina}><Send size={14}/> Enviar a Cocina</button>
            )}
          </div>
          {detalles.length === 0 ? (
            <div className="empty-state"><p>No hay productos en este pedido.</p></div>
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
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{fmt(subtotalSinIVA)}</span>
          </div>
          <div className="summary-row">
            <span>IVA (13%)</span>
            <span>{fmt(montoIVA)}</span>
          </div>
          <div className="divider"></div>
          <div className="summary-row total">
            <span>Total</span>
            <span style={{ color: 'var(--accent)', fontWeight: 800 }}>{fmt(totalProductos)}</span>
          </div>
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
            <label className="form-label">Producto</label>
            <SearchableSelect 
              options={prodsFiltrados.map(p => ({ value: p.id, label: `${p.nombre} — ${fmt(p.precioUnitario)}` }))}
              value={addForm.productoId}
              onChange={val => setAddForm(f => ({ ...f, productoId: val }))}
              placeholder="-- Seleccioná un producto --"
            />
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
