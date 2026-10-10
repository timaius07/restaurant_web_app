import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { formatCurrency } from '../../utils/formatters';
import { Plus, Trash2, ArrowLeft, Send, X, Receipt, MessageSquare, Search, Clock, Leaf, Minus } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';
import { confirmDialog } from '../../utils/sweetAlert';
import { api } from '../../services/apiService';
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
  const { pedidos, detallePedidos, productos, categorias, mesas, barras, clientes,
          addDetalle, updateDetalle, deleteDetalle, updatePedido, cancelarPedido, settings } = useApp();
  const { user, hasRole } = useAuth();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showFacturados, setShowFacturados] = useState(false);
  const [catFiltro, setCatFiltro] = useState('');
  const [posSearch, setPosSearch] = useState('');
  const [posFilter, setPosFilter] = useState('Todos');
  const [addForm, setAddForm] = useState({ productoId: '', cantidad: 1 });
  const [productoCantidades, setProductoCantidades] = useState({});
  const notasTimeouts = useRef({});
  
  const [localDetalles, setLocalDetalles] = useState(null);
  const [cargandoDetalles, setCargandoDetalles] = useState(false);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);

  const pedido  = pedidos.find(p => p.id === Number(id));

  const handleNotificarWhatsApp = async () => {
    if (!cliente) {
      return toast.error('El pedido no tiene un cliente asignado.');
    }
    if (!cliente.telefono) {
      return toast.error(`El cliente "${cliente.nombre}" no tiene un teléfono registrado.`);
    }

    setSendingWhatsapp(true);
    const toastId = toast.loading(`Enviando WhatsApp a ${cliente.nombre}...`);

    try {
      const res = await api.post('/email/send-delivery-whatsapp', {
        pedidoId: pedido.id,
        phone: cliente.telefono
      });

      if (res?.success) {
        toast.success(`Notificación WhatsApp enviada a ${cliente.nombre} vía YCloud`, { id: toastId });
      } else {
        toast.error('No se pudo enviar la notificación', { id: toastId });
      }
    } catch (err) {
      console.error('Error al enviar WhatsApp:', err);
      toast.error(err.originalMessage || err.message || 'Error al enviar notificación por WhatsApp', { id: toastId });
    } finally {
      setSendingWhatsapp(false);
    }
  };
  
  useEffect(() => {
    if (pedido && !['Abierto', 'Preparando', 'Servido'].includes(pedido.estado)) {
      const contextHasThem = detallePedidos.some(d => Number(d.pedidoId) === Number(id));
      if (!contextHasThem && localDetalles === null && !cargandoDetalles) {
        setCargandoDetalles(true);
        api.get(`/pedidos/${id}/detalles`)
          .then(data => setLocalDetalles(data))
          .catch(err => console.error("Error al cargar detalles:", err))
          .finally(() => setCargandoDetalles(false));
      }
    } else if (pedido && ['Abierto', 'Preparando', 'Servido'].includes(pedido.estado) && localDetalles !== null) {
      setLocalDetalles(null);
    }
  }, [id, pedido, detallePedidos, localDetalles, cargandoDetalles]);

  const todosDetallesContext = detallePedidos.filter(d => Number(d.pedidoId) === Number(id));
  const todosDetalles = localDetalles !== null ? localDetalles : todosDetallesContext;

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
  const barra   = barras.find(b => b.id === pedido?.mesaId);
  const cliente = clientes.find(c => c.id === pedido?.clienteId);
  const fmt     = (v) => formatCurrency(v, settings.moneda, settings.tasaCambio);

  // Determinar si es mesa o barra según el tipo de pedido
  const locationName = pedido?.tipoPedido === 'Barra'
    ? `Barra ${barra?.numeroBarra || '—'}`
    : pedido?.tipoPedido === 'Delivery'
    ? 'Delivery'
    : `Mesa ${mesa?.numeroMesa || '—'}`;

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

  const handleAddProducto = (productoId) => {
    const cantidad = productoCantidades[productoId] || 1;
    if (cantidad < 1) return toast.error('Cantidad inválida');
    const prodObj = productos.find(p => p.id === Number(productoId));
    addDetalle(id, productoId, Number(cantidad), '');
    toast.success(`"${prodObj?.nombre || 'Producto'}" agregado al pedido 🛒`);
    setProductoCantidades(prev => ({ ...prev, [productoId]: 1 }));
  };

  const handleUpdateCantidad = (detalle, nuevaCantidad) => {
    if (nuevaCantidad < 1) return;
    if (nuevaCantidad < detalle.cantFacturada) {
      toast.error('No puedes reducir la cantidad por debajo de lo ya facturado');
      return;
    }
    updateDetalle(detalle.id, { cantidad: nuevaCantidad });
  };

  const handleUpdateNotas = (detalle, notas) => {
    // Limpiar timeout anterior si existe
    if (notasTimeouts.current[detalle.id]) {
      clearTimeout(notasTimeouts.current[detalle.id]);
    }
    // Guardar en backend después de 1 segundo (debounce)
    notasTimeouts.current[detalle.id] = setTimeout(() => {
      updateDetalle(detalle.id, { notas });
    }, 1000);
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
  const canCancel = canEdit || (pedido.estado === 'Servido' && (hasRole('Admin') || user.rutas?.includes('/cancelar-servidos')));
  const canFacturar = ['Servido', 'Preparando', 'Abierto'].includes(pedido.estado) && (hasRole('Admin', 'Cajero') || user.rutas?.includes('/facturacion')) && detallesPendientes.length > 0;

  const prodsFiltrados = productos.filter(p => {
    if (catFiltro && p.categoriaId !== Number(catFiltro)) return false;
    if (posSearch.trim()) {
      const query = posSearch.toLowerCase();
      if (!p.nombre.toLowerCase().includes(query) && !(p.descripcion || '').toLowerCase().includes(query)) {
        return false;
      }
    }
    // Mock filters for demo
    if (posFilter === 'Vegetariano' && !p.nombre.toLowerCase().includes('veg')) return false;
    if (posFilter === 'Sin Gluten' && !p.nombre.toLowerCase().includes('gluten')) return false;
    return true;
  });

  return (
    <div className="page-container animate-fade">
      <div className="page-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate(tenantPath('/pedidos'))}><ArrowLeft size={18}/></button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0 }}>Pedido — {locationName}</h1>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {pedido.tipoPedido === 'Delivery' && (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    disabled={sendingWhatsapp}
                    onClick={handleNotificarWhatsApp}
                    title="Notificar estado por WhatsApp al cliente usando YCloud"
                  >
                    <MessageSquare size={16} style={{ color: '#25D366' }} />
                    {sendingWhatsapp ? 'Enviando...' : 'WhatsApp YCloud'}
                  </button>
                )}
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
                            <div className="quantity-selector">
                              <button
                                className="quantity-btn"
                                onClick={() => handleUpdateCantidad(d, d.cantPendiente - 1)}
                                disabled={d.cantPendiente <= 1}
                              >
                                <Minus size={14} />
                              </button>
                              <input
                                type="number"
                                min="1"
                                className="quantity-input"
                                value={d.cantPendiente}
                                onChange={e => {
                                  const val = parseInt(e.target.value, 10);
                                  if (!isNaN(val) && val >= 1) {
                                    handleUpdateCantidad(d, val);
                                  }
                                }}
                              />
                              <button
                                className="quantity-btn"
                                onClick={() => handleUpdateCantidad(d, d.cantPendiente + 1)}
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          ) : d.cantPendiente}
                        </td>
                        <td>{fmt(d.precioMomento)}</td>
                        <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{fmt(d.precioMomento * d.cantPendiente)}</td>
                        <td>
                          {canEdit ? (
                            <input
                              type="text"
                              className="notes-input"
                              placeholder="Agregar nota..."
                              defaultValue={d.notas || ''}
                              onBlur={e => handleUpdateNotas(d, e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.target.blur();
                                }
                              }}
                              style={{ fontSize: '0.82rem', padding: '6px 10px', width: '100%', minWidth: '150px', boxSizing: 'border-box' }}
                            />
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{d.notas || '—'}</span>
                          )}
                        </td>
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

      {/* Modal agregar producto (Diseño POS) */}
      {showAddModal && (
        <Modal
          title="Menú de Productos"
          onClose={() => {
            setShowAddModal(false);
            setProductoCantidades({});
          }}
          size="xl"
          footer={<button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cerrar</button>}
        >
          <div className="pos-modal-layout">
            {/* Sidebar */}
            <div className="pos-sidebar">
              <div className="pos-sidebar-header">Categorías del Menú ({productos.length})</div>
              <div
                className={`pos-cat-item ${!catFiltro ? 'active' : ''}`}
                onClick={() => setCatFiltro('')}
              >
                <span>Todas las Categorías</span>
                <span className="pos-cat-badge">{productos.length}</span>
              </div>
              {categorias.map(c => {
                const count = productos.filter(p => p.categoriaId === c.id).length;
                if (count === 0) return null;
                return (
                  <div
                    key={c.id}
                    className={`pos-cat-item ${String(catFiltro) === String(c.id) ? 'active' : ''}`}
                    onClick={() => setCatFiltro(String(c.id))}
                  >
                    <span>{c.nombre}</span>
                    <span className="pos-cat-badge">{count}</span>
                  </div>
                );
              })}
            </div>

            {/* Main Content */}
            <div className="pos-main">
              <div className="pos-main-header">
                <div className="pos-search-row">
                  <div className="pos-search-input">
                    <Search size={16} />
                    <input
                      placeholder="Buscar por nombre, descripción..."
                      value={posSearch}
                      onChange={e => setPosSearch(e.target.value)}
                    />
                  </div>
                  <div className="pos-filters">
                    {['Todos', 'Populares', 'Vegetariano', 'Sin Gluten'].map(f => (
                      <button
                        key={f}
                        className={`pos-filter-btn ${posFilter === f ? 'active' : ''}`}
                        onClick={() => setPosFilter(f)}
                      >
                        {f === 'Vegetariano' && <Leaf size={14} style={{color: posFilter === f ? 'var(--success)' : ''}}/>}
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Mostrando {prodsFiltrados.length} de {productos.length} productos
                </div>
              </div>

              <div className="pos-products-grid">
                {prodsFiltrados.map(p => {
                  const catName = categorias.find(c => c.id === p.categoriaId)?.nombre || '';
                  const isVeg = p.nombre.toLowerCase().includes('veg');
                  const isGlutenFree = p.nombre.toLowerCase().includes('gluten');
                  const cantidad = productoCantidades[p.id] || 1;

                  return (
                    <div
                      key={p.id}
                      className="pos-product-card"
                    >
                      <div className="pos-prod-cat">{catName}</div>
                      <div className="pos-prod-name">{p.nombre}</div>
                      <div className="pos-prod-desc">{p.descripcion || 'Sin descripción detallada'}</div>

                      <div className="pos-prod-tags">
                        {isVeg && <span className="pos-tag" style={{color: 'var(--success)'}}><Leaf size={12}/> Veg.</span>}
                        {isGlutenFree && <span className="pos-tag" style={{color: 'var(--warning)'}}>Sin Gluten</span>}
                      </div>

                      <div className="pos-prod-footer">
                        <div className="pos-prod-price">{fmt(p.precioUnitario)}</div>
                        <div className="pos-quantity-wrapper">
                          <button
                            className="pos-qty-btn"
                            onClick={() => setProductoCantidades(prev => ({
                              ...prev,
                              [p.id]: Math.max(1, (prev[p.id] || 1) - 1)
                            }))}
                          >
                            <Minus size={14} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            className="pos-qty-input"
                            value={cantidad}
                            onChange={e => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val) && val >= 1) {
                                setProductoCantidades(prev => ({ ...prev, [p.id]: val }));
                              }
                            }}
                          />
                          <button
                            className="pos-qty-btn"
                            onClick={() => setProductoCantidades(prev => ({
                              ...prev,
                              [p.id]: (prev[p.id] || 1) + 1
                            }))}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <button
                          className="pos-add-btn"
                          onClick={() => handleAddProducto(p.id)}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
