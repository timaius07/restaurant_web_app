import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Receipt, Printer, Eye, Calendar, X } from 'lucide-react';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalDateStr = (dateObj) => {
  if (!dateObj) return '';
  const d = new Date(dateObj);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Facturacion() {
  const { pedidos, detallePedidos, facturas, mesas, clientes, metodosPago, emitirFactura, productos, settings } = useApp();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fmt = (v) => formatCurrency(v, settings.moneda, settings.tasaCambio);

  const [modal, setModal] = useState(null); // 'facturar' | 'ver'
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [selectedFactura, setSelectedFactura] = useState(null);
  const [metodoPagoId, setMetodoPagoId] = useState('');
  const [cantidadesAFacturar, setCantidadesAFacturar] = useState({});
  const [incluirServicio, setIncluirServicio] = useState(false); // Desmarcado por defecto según solicitud
  const [filtroFecha, setFiltroFecha] = useState(getTodayStr()); // Por defecto fecha actual de hoy

  // Pre-select if coming from DetallePedido
  useState(() => {
    const pid = searchParams.get('pedidoId');
    if (pid) {
      const p = pedidos.find(x => Number(x.id) === Number(pid));
      if (p) { setSelectedPedido(p); setModal('facturar'); }
    }
  });

  const pendientes = pedidos.filter(p => p.estado === 'Servido');
  const [isSubmitting, setIsSubmitting] = useState(false);

  let facturasFiltradas = [...facturas].reverse();
  if (filtroFecha) {
    facturasFiltradas = facturasFiltradas.filter(f => getLocalDateStr(f.fechaEmision) === filtroFecha);
  }

  const openFacturar = (ped) => {
    setSelectedPedido(ped);
    setMetodoPagoId(metodosPago.find(m => m.activo)?.id || '');
    setIncluirServicio(false); // Opcional y desmarcado por defecto
    setIsSubmitting(false);
    
    const dets = getDetalles(ped.id);
    const initialCantidades = {};
    dets.forEach(d => {
      const pending = d.cantidad - (d.cantidadFacturada || 0);
      initialCantidades[d.id] = pending;
    });
    setCantidadesAFacturar(initialCantidades);
    setModal('facturar');
  };

  const handleEmitir = async () => {
    if (!metodoPagoId) return toast.error('Seleccioná el método de pago');
    
    const items = Object.entries(cantidadesAFacturar).map(([detalleId, cantidad]) => ({ detalleId, cantidad }));
    const totalSelected = items.reduce((sum, item) => sum + item.cantidad, 0);
    if (totalSelected === 0) return toast.error('Debes seleccionar al menos un producto para facturar');

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const factura = await emitirFactura(selectedPedido.id, metodoPagoId, items, incluirServicio);
      toast.success(`Factura ${factura.numeroFactura} emitida`);
      setSelectedFactura(factura);
      setModal('ver');
    } catch (err) {
      console.error('Error al emitir factura', err);
      toast.error('Error al emitir la factura');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDetalles = (pedidoId) => detallePedidos.filter(d => Number(d.pedidoId) === Number(pedidoId));

  const calcTotal = (detalles) => {
    const totalProductos = detalles.reduce((s, d) => {
      const pending = d.cantidad - (d.cantidadFacturada || 0);
      return s + (d.precioMomento * Math.max(0, pending));
    }, 0);
    return { total: totalProductos };
  };

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <h1>Facturación</h1>
        <p>Pedidos listos para facturar e historial de transacciones</p>
      </div>

      {/* Pendientes */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>Pedidos Pendientes de Pago</div>
        {pendientes.length === 0 ? (
          <div className="empty-state"><p>No hay pedidos en estado "Servido" para facturar.</p></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th>Items Pendientes</th>
                  <th>Total Estimado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map(p => {
                  const mesa = mesas.find(m => Number(m.id) === Number(p.mesaId));
                  const cliente = clientes.find(c => Number(c.id) === Number(p.clienteId));
                  const dets = getDetalles(p.id);
                  const { total } = calcTotal(dets);
                  const label = p.tipoPedido === 'Delivery' ? 'Delivery' : `Mesa ${mesa?.numeroMesa || '—'}`;
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{label}</td>
                      <td>{cliente?.nombre || 'General'}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{formatDate(p.fechaApertura)}</td>
                      <td><span className="badge badge-warning">{dets.length} item(s)</span></td>
                      <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmt(total)}</td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => openFacturar(p)}>
                          <Receipt size={14}/> Facturar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historial */}
      <div className="card">
        <div className="card-title-row" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="card-title">Historial de Facturas</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              {facturasFiltradas.length} factura(s) encontrada(s) {filtroFecha ? `para el ${filtroFecha}` : '(todas las fechas)'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 12px' }}>
              <Calendar size={15} style={{ color: 'var(--text-muted)' }} />
              <input
                type="date"
                className="form-input"
                value={filtroFecha}
                onChange={e => setFiltroFecha(e.target.value)}
                style={{ border: 'none', background: 'transparent', padding: 0, fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}
              />
              {filtroFecha && (
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => setFiltroFecha('')}
                  title="Limpiar filtro de fecha (Ver todas)"
                  style={{ width: 22, height: 22, padding: 0 }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {facturasFiltradas.length === 0 ? (
          <div className="empty-state"><p>{filtroFecha ? `No se encontraron facturas emitidas el ${filtroFecha}.` : 'No hay facturas emitidas aún.'}</p></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Factura</th>
                  <th>Fecha</th>
                  <th>Subtotal</th>
                  <th>IVA</th>
                  <th>Total</th>
                  <th>Método Pago</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {facturasFiltradas.map(f => {
                  const metodo = metodosPago.find(m => Number(m.id) === Number(f.metodoPagoId));
                  return (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{f.numeroFactura}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{formatDate(f.fechaEmision)}</td>
                      <td>{fmt(f.subtotal)}</td>
                      <td>{fmt(f.impuestos)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmt(f.total)}</td>
                      <td><span className="badge badge-muted">{metodo?.nombre || '—'}</span></td>
                      <td>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Ver Detalle" onClick={() => { setSelectedFactura(f); setModal('ver'); }}>
                          <Eye size={14}/>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal facturar */}
      {modal === 'facturar' && selectedPedido && (() => {
        const dets = getDetalles(selectedPedido.id);
        const mesa = mesas.find(m => Number(m.id) === Number(selectedPedido.mesaId));
        const isDelivery = selectedPedido.tipoPedido === 'Delivery';
        
        let totalProductos = 0;
        dets.forEach(d => {
          const qty = cantidadesAFacturar[d.id] || 0;
          totalProductos += d.precioMomento * qty;
        });

        const subtotalSinIVA = Math.round(totalProductos / 1.13);
        const montoIVA = totalProductos - subtotalSinIVA;
        const montoServicio = (incluirServicio && !isDelivery) ? Math.round(totalProductos * 0.10) : 0;
        const totalCobrar = totalProductos + montoServicio;

        return (
          <Modal title="Emitir Factura" onClose={() => setModal(null)} size="lg"
            footer={<>
              <button className="btn btn-secondary" onClick={() => setModal(null)} disabled={isSubmitting}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleEmitir} disabled={isSubmitting}>
                {isSubmitting ? 'Procesando...' : <><Receipt size={14}/> Emitir Factura</>}
              </button>
            </>}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                <strong>Origen:</strong> {isDelivery ? 'Delivery / Para Llevar' : `Mesa ${mesa?.numeroMesa || '—'}`}
              </p>
              <span className={`badge ${isDelivery ? 'badge-purple' : 'badge-info'}`}>
                {selectedPedido.tipoPedido}
              </span>
            </div>

            <div className="table-wrapper" style={{ marginBottom: 16 }}>
              <table>
                <thead><tr><th>Producto</th><th>Pendiente</th><th>A Facturar</th><th>P. Unit. (IVA incl.)</th><th>Subtotal</th></tr></thead>
                <tbody>
                  {dets.map(d => {
                    const prod = productos.find(p => Number(p.id) === Number(d.productoId));
                    const pending = d.cantidad - (d.cantidadFacturada || 0);
                    if (pending <= 0) return null;
                    const currentQty = cantidadesAFacturar[d.id] || 0;

                    return (
                      <tr key={d.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{prod?.nombre || 'Producto'}</div>
                        </td>
                        <td>{pending}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button className="btn btn-sm btn-secondary" style={{ padding: '0 8px' }} onClick={() => setCantidadesAFacturar(prev => ({ ...prev, [d.id]: Math.max(0, currentQty - 1) }))}>-</button>
                            <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 700 }}>{currentQty}</span>
                            <button className="btn btn-sm btn-secondary" style={{ padding: '0 8px' }} onClick={() => setCantidadesAFacturar(prev => ({ ...prev, [d.id]: Math.min(pending, currentQty + 1) }))}>+</button>
                          </div>
                        </td>
                        <td>{fmt(d.precioMomento)}</td>
                        <td style={{ fontWeight: 600 }}>{fmt(d.precioMomento * currentQty)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Checkbox de 10% de Servicio */}
            <div style={{
              margin: '16px 0',
              padding: '14px 16px',
              background: 'var(--bg-hover)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)'
            }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: isDelivery ? 'not-allowed' : 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={incluirServicio && !isDelivery}
                  disabled={isDelivery}
                  onChange={e => setIncluirServicio(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 2, cursor: isDelivery ? 'not-allowed' : 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: isDelivery ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    Incluir 10% por concepto de servicio (+{fmt(Math.round(totalProductos * 0.10))})
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                    {isDelivery 
                      ? '⚠️ Por normativa (MEIC), el 10% de servicio no aplica en pedidos para llevar o delivery.'
                      : 'Opcional para consumo en el local (desmarcado por defecto).'}
                  </div>
                </div>
              </label>
            </div>

            {/* Resumen de totales */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <div style={{ minWidth: 290 }}>
                <div style={{ display:'flex',justifyContent:'space-between',padding:'4px 0',color:'var(--text-secondary)',fontSize:'0.88rem' }}>
                  <span>Total Productos (IVA incl.)</span><span style={{ fontWeight: 700 }}>{fmt(totalProductos)}</span>
                </div>
                <div style={{ display:'flex',justifyContent:'space-between',padding:'3px 0',color:'var(--text-muted)',fontSize:'0.78rem',fontStyle:'italic' }}>
                  <span>└ Subtotal neto (sin IVA)</span><span>{fmt(subtotalSinIVA)}</span>
                </div>
                <div style={{ display:'flex',justifyContent:'space-between',padding:'3px 0',color:'var(--text-muted)',fontSize:'0.78rem',fontStyle:'italic' }}>
                  <span>└ Desglose IVA 13% (incluido)</span><span>{fmt(montoIVA)}</span>
                </div>
                {incluirServicio && !isDelivery && (
                  <div style={{ display:'flex',justifyContent:'space-between',padding:'4px 0',color:'var(--warning)',fontSize:'0.85rem',fontWeight:600 }}>
                    <span>Servicio (10%)</span><span>+{fmt(montoServicio)}</span>
                  </div>
                )}
                <div style={{ borderTop:'1px solid var(--border)',marginTop:8,paddingTop:8,display:'flex',justifyContent:'space-between',fontWeight:800,fontSize:'1.15rem' }}>
                  <span>TOTAL A PAGAR</span><span style={{ color:'var(--accent)' }}>{fmt(totalCobrar)}</span>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Método de Pago *</label>
              <select className="form-input form-select" value={metodoPagoId} onChange={e => setMetodoPagoId(e.target.value)}>
                <option value="">-- Seleccioná el método de pago --</option>
                {metodosPago.filter(m=>m.activo).map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>
          </Modal>
        );
      })()}

      {/* Modal ver factura */}
      {modal === 'ver' && selectedFactura && (() => {
        const pedido = pedidos.find(p => Number(p.id) === Number(selectedFactura.pedidoId));
        const cliente = clientes.find(c => Number(c.id) === Number(pedido?.clienteId));
        const mesa = mesas.find(m => Number(m.id) === Number(pedido?.mesaId));
        const metodoNombre = metodosPago.find(m => Number(m.id) === Number(selectedFactura.metodoPagoId))?.nombre || 'Efectivo';
        
        const subtotalBase = selectedFactura.subtotal || Math.round(selectedFactura.total / 1.13);
        const impuestosIVA = selectedFactura.impuestos || (selectedFactura.total - subtotalBase);
        const montoServicio = selectedFactura.servicio || 0;
        const totalFinal = selectedFactura.total || 0;

        // Obtenemos los ítems facturados (de selectedFactura.detalles o de detallePedidos)
        let itemsCobrados = [];
        if (selectedFactura.detalles && selectedFactura.detalles.length > 0) {
          itemsCobrados = selectedFactura.detalles;
        } else if (selectedFactura.pedidoId) {
          itemsCobrados = detallePedidos.filter(d => Number(d.pedidoId) === Number(selectedFactura.pedidoId));
        }

        return (
          <Modal title={`Comprobante — Factura ${selectedFactura.numeroFactura}`} onClose={() => setModal(null)} size="lg"
            footer={<>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cerrar</button>
              <button className="btn btn-primary" onClick={() => window.print()}><Printer size={14}/> Reimprimir Comprobante</button>
            </>}>
            
            {/* Cabecera del cliente y pedido */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              padding: '12px 16px',
              background: 'var(--bg-hover)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 16
            }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Cliente</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{cliente?.nombre || 'Cliente General'}</div>
                {cliente?.identificacionFiscal && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ID: {cliente.identificacionFiscal}</div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Origen / Atendido en</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  {pedido?.tipoPedido === 'Delivery' ? 'Delivery / Para Llevar' : (mesa ? `Mesa ${mesa.numeroMesa}` : 'Consumo en Local')}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatDate(selectedFactura.fechaEmision)}</div>
              </div>
            </div>

            {/* Detalle de Productos Cobrados */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                Detalle de Productos Cobrados ({itemsCobrados.length})
              </div>
              {itemsCobrados.length === 0 ? (
                <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  No se encontraron los ítems individuales de esta factura.
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Cant.</th>
                        <th>P. Unit. (IVA incl.)</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsCobrados.map((d, i) => {
                        const prod = productos.find(p => Number(p.id) === Number(d.productoId));
                        const cant = d.cantidad || 1;
                        const precio = d.precioMomento || (prod?.precioUnitario || 0);
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{prod?.nombre || 'Producto'}</td>
                            <td>{cant}</td>
                            <td>{fmt(precio)}</td>
                            <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{fmt(precio * cant)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Resumen Financiero */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <strong>Método de Pago:</strong> <span className="badge badge-muted">{metodoNombre}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Nro. Factura: <code style={{ fontWeight: 700 }}>{selectedFactura.numeroFactura}</code>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  <span>Subtotal neto (sin IVA):</span>
                  <span>{fmt(subtotalBase)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  <span>Desglose IVA 13% (incluido):</span>
                  <span>{fmt(impuestosIVA)}</span>
                </div>
                {montoServicio > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: 'var(--warning)', fontWeight: 600 }}>
                    <span>Servicio 10%:</span>
                    <span>+{fmt(montoServicio)}</span>
                  </div>
                )}
                <div style={{
                  display: 'flex',
                  justify: 'space-between',
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  borderTop: '1px solid var(--border)',
                  paddingTop: 6,
                  marginTop: 4
                }}>
                  <span>TOTAL COBRADO:</span>
                  <span style={{ color: 'var(--accent)' }}>{fmt(totalFinal)}</span>
                </div>
              </div>
            </div>

          </Modal>
        );
      })()}
    </div>
  );
}

