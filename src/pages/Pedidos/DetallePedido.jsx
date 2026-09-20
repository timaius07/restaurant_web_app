import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
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
  const { tenantPath } = useTenant();
  const { pedidos, detallePedidos, productos, categorias, mesas, clientes,
          addDetalle, updateDetalle, deleteDetalle, updatePedido, cancelarPedido, settings } = useApp();
  const { user, hasRole } = useAuth();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showFacturados, setShowFacturados] = useState(false);
  const [catFiltro, setCatFiltro] = useState('');
  const [addForm, setAddForm] = useState({ productoId: '', cantidad: 1, notas: '' });

  const pedido  = pedidos.find(p => p.id === Number(id));
  const todosDetalles = detallePedidos.filter(d => Number(d.pedidoId) === Number(id));

  // Productos pendientes de facturar en este pedido
  const detallesPendientes = todosDetalles
    .map(d => {
      const cantFacturada = d.cantidadFacturada || 0;
      const cantPendiente = Math.max(0, d.cantidad - cantFacturada);
      return {
        ...d,
        cantFacturada,
        cantPendiente
      };
    })
    .filter(d => d.cantPendiente > 0);

  // Productos ya facturados por separado en este pedido
  const detallesFacturados = todosDetalles
    .map(d => ({
      ...d,
      cantFacturada: d.cantidadFacturada || 0
    }))
    .filter(d => d.cantFacturada > 0);

  const mesa    = mesas.find(m => m.id === pedido?.mesaId);
  const cliente = clientes.find(c => c.id === pedido?.clienteId);
  const fmt     = (v) => formatCurrency(v, settings.moneda, settings.tasaCambio);

  if (!pedido) return (
    <div className="page-container"><p style={{ color: 'var(--text-secondary)' }}>Pedido no encontrado.</p>
      <button className="btn btn-secondary" onClick={() => navigate(tenantPath('/pedidos'))}><ArrowLeft size={14}/> Volver</button>
    </div>
  );

  // Normativa Costa Rica (MEIC): Los precios de los alimentos preparados ya incluyen el 13% IVA
  // Calculado únicamente sobre los productos pendientes de cobro
  const totalProductos = detallesPendientes.reduce((s, d) => s + d.precioMomento * d.cantPendiente, 0);
  const subtotalSinIVA = Math.round(totalProductos / 1.13);
  const montoIVA = totalProductos - subtotalSinIVA; // Desglose informativo 13% IVA

  const handleAddProducto = () => {
    if (!addForm.productoId) return toast.error('Seleccioná un producto');
    if (addForm.cantidad < 1) return toast.error('Cantidad inválida');
    const prodObj = productos.find(p => p.id === Number(addForm.productoId));
    addDetalle(id, addForm.productoId, Number(addForm.cantidad), addForm.notas);
    toast.success(`"${prodObj?.nombre || 'Producto'}" agregado al pedido 🛒`);
    setAddForm({ productoId: '', cantidad: 1, notas: '' });
  };

  const handleRemove = async (detalle) => {
    const confirmed = await confirmDialog({
      title: '¿Quitar este producto?',
      text: 'El producto pendiente se eliminará de la comanda de este pedido.',
      confirmButtonText: 'Sí, quitar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmed) return;

    if (detalle.cantFacturada > 0) {
      // Si ya tiene una fracción facturada, reducimos la cantidad total a lo ya facturado para que el pendiente quede en 0
      await updateDetalle(detalle.id, { cantidad: detalle.cantFacturada });
    } else {
      await deleteDetalle(detalle.id);
    }
    toast.success('Producto removido');
  };

  const handleEnviarCocina = () => {
    if (detallesPendientes.length === 0) return toast.error('Agregá al menos un producto pendiente');
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
    navigate(tenantPath('/pedidos'));
  };

  const canEdit = ['Abierto', 'Preparando'].includes(pedido.estado) && hasRole('Admin', 'Mesero');
  const canCancel = canEdit || (pedido.estado === 'Servido' && (hasRole('Admin') || user?.puedeCancelarServido));
  const canFacturar = ['Servido', 'Preparando', 'Abierto'].includes(pedido.estado) && hasRole('Admin', 'Cajero', 'Mesero') && detallesPendientes.length > 0;

  const prodsFiltrados = productos.filter(p => !catFiltro || p.categoriaId === Number(catFiltro));

  return (
    <div className="page-container animate-fade">
      <div className="page-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate(tenantPath('/pedidos'))}><ArrowLeft size={18}/></button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0 }}>Pedido — {pedido.tipoPedido === 'Delivery' ? 'Delivery' : `Mesa ${mesa?.numeroMesa || '—'}`}</h1>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {canFacturar && (
                  <button className="btn btn-primary" onClick={() => navigate(tenantPath(`/facturacion?pedidoId=${id}`))}>
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
            <div className="card-title">Productos del Pedido {detallesPendientes.length > 0 && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 400 }}>({detallesPendientes.length} pendiente{detallesPendientes.length > 1 ? 's' : ''})</span>}</div>
            {pedido.estado === 'Abierto' && hasRole('Admin', 'Mesero') && detallesPendientes.length > 0 && (
              <button className="btn btn-warning btn-sm" onClick={handleEnviarCocina}><Send size={14}/> Enviar a Cocina</button>
            )}
          </div>
          {detallesPendientes.length === 0 ? (
            <div className="empty-state">
              <p>{todosDetalles.length > 0 ? 'Todos los productos de este pedido ya han sido facturados.' : 'No hay productos en este pedido.'}</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Producto</th><th>Cant.</th><th>P. Unit.</th><th>Subtotal</th><th>Notas</th>{canEdit && <th></th>}</tr></thead>
                <tbody>
                  {detallesPendientes.map(d => {
                    const prod = productos.find(p => p.id === d.productoId);
                    return (
                      <tr key={d.id}>
                        <td style={{ fontWeight: 600 }}>{prod?.nombre || '—'}</td>
                        <td>
                          {canEdit ? (
                            <input
                              type="number"
                              min="1"
                              className="form-input"
                              style={{ width: 64, padding: '4px 8px' }}
                              value={d.cantPendiente}
                              onChange={e => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val) && val >= 1) {
                                  updateDetalle(d.id, { cantidad: d.cantFacturada + val });
                                }
                              }}
                            />
                          ) : d.cantPendiente}
                        </td>
                        <td>{fmt(d.precioMomento)}</td>
                        <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{fmt(d.precioMomento * d.cantPendiente)}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{d.notas || '—'}</td>
                        {canEdit && (
                          <td><button className="btn btn-danger btn-icon btn-sm" onClick={() => handleRemove(d)} title="Quitar producto"><Trash2 size={14}/></button></td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Sección de productos ya facturados por separado */}
          {detallesFacturados.length > 0 && (
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px dashed var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <Receipt size={16} style={{ color: 'var(--accent)' }} />
                  <span>Productos ya facturados por separado ({detallesFacturados.reduce((s, d) => s + d.cantFacturada, 0)} item{detallesFacturados.reduce((s, d) => s + d.cantFacturada, 0) > 1 ? 's' : ''})</span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                  onClick={() => setShowFacturados(v => !v)}
                >
                  {showFacturados ? 'Ocultar facturados' : 'Ver productos facturados'}
                </button>
              </div>

              {showFacturados && (
                <div className="table-wrapper" style={{ marginTop: 12 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Cant. Cobrada</th>
                        <th>P. Unit.</th>
                        <th>Total Facturado</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detallesFacturados.map(d => {
                        const prod = productos.find(p => p.id === d.productoId);
                        return (
                          <tr key={`fact-${d.id}`} style={{ opacity: 0.85 }}>
                            <td style={{ fontWeight: 600 }}>{prod?.nombre || '—'}</td>
                            <td>{d.cantFacturada}</td>
                            <td>{fmt(d.precioMomento)}</td>
                            <td style={{ fontWeight: 600, color: 'var(--success)' }}>
                              {fmt(d.precioMomento * d.cantFacturada)}
                            </td>
                            <td><span className="badge badge-success">Cobrado</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Resumen */}
        <div className="card detalle-summary">
          <div className="card-title" style={{ marginBottom: 16 }}>Resumen Pendiente</div>
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
            <span>Total Pendiente</span>
            <span style={{ color: 'var(--accent)', fontWeight: 800 }}>{fmt(totalProductos)}</span>
          </div>
        </div>
      </div>

      {/* Modal agregar producto */}
      {showAddModal && (() => {
        const selectedProdObj = productos.find(p => p.id === Number(addForm.productoId));
        const subtotalPreview = selectedProdObj ? selectedProdObj.precioUnitario * (Number(addForm.cantidad) || 1) : 0;

        return (
          <Modal 
            title="Agregar Producto" 
            onClose={() => setShowAddModal(false)}
            size="xl"
            footer={<>
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Listo / Cerrar</button>
              <button className="btn btn-primary" onClick={handleAddProducto}>+ Agregar al Pedido</button>
            </>}
          >
            <div className="form-group">
              <label className="form-label">Filtrar por Categoría</label>
              <div className="modal-category-pills">
                <button
                  type="button"
                  className={`cat-pill ${!catFiltro ? 'active' : ''}`}
                  onClick={() => setCatFiltro('')}
                >
                  Todas ({productos.length})
                </button>
                {categorias.map(c => {
                  const count = productos.filter(p => p.categoriaId === c.id).length;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`cat-pill ${String(catFiltro) === String(c.id) ? 'active' : ''}`}
                      onClick={() => setCatFiltro(String(c.id))}
                    >
                      {c.nombre} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Buscar o Seleccionar Producto</label>
              <SearchableSelect 
                options={prodsFiltrados.map(p => ({
                  value: p.id,
                  label: p.nombre,
                  price: fmt(p.precioUnitario)
                }))}
                value={addForm.productoId}
                onChange={val => setAddForm(f => ({ ...f, productoId: val }))}
                placeholder="-- Escriba o seleccione un producto --"
              />
            </div>

            {selectedProdObj && (
              <div className="selected-product-summary animate-fade">
                <div className="summary-info">
                  <span className="summary-info-title">{selectedProdObj.nombre}</span>
                  <span className="summary-info-sub">
                    {categorias.find(c => c.id === selectedProdObj.categoriaId)?.nombre || 'Categoría'} • Unitario: {fmt(selectedProdObj.precioUnitario)}
                  </span>
                </div>
                <div className="summary-price-tag">
                  Total: {fmt(subtotalPreview)}
                </div>
              </div>
            )}

            <div className="form-row" style={{ marginTop: 16 }}>
              <div className="form-group" style={{ flex: '0 0 120px' }}>
                <label className="form-label">Cantidad</label>
                <input 
                  className="form-input" 
                  type="number" 
                  min="1" 
                  value={addForm.cantidad} 
                  onChange={e => setAddForm(f => ({ ...f, cantidad: e.target.value }))} 
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Notas para cocina / servicio (opcional)</label>
                <input 
                  className="form-input" 
                  placeholder="Ej: Té frío sin azúcar, picante aparte..." 
                  value={addForm.notas} 
                  onChange={e => setAddForm(f => ({ ...f, notas: e.target.value }))} 
                />
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
