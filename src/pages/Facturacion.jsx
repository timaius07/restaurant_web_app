import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Receipt, Printer, Eye } from 'lucide-react';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';

const BADGE = { Pagado: 'badge-success', Cancelado: 'badge-danger', Servido: 'badge-purple' };

export default function Facturacion() {
  const { pedidos, detallePedidos, facturas, mesas, clientes, metodosPago, emitirFactura, productos, settings } = useApp();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fmt = (v) => formatCurrency(v, settings.moneda, settings.tasaCambio);

  const [modal, setModal]     = useState(null); // 'facturar' | 'ver'
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [selectedFactura, setSelectedFactura] = useState(null);
  const [metodoPagoId, setMetodoPagoId] = useState('');
  const [cantidadesAFacturar, setCantidadesAFacturar] = useState({});

  // Pre-select if coming from DetallePedido
  useState(() => {
    const pid = searchParams.get('pedidoId');
    if (pid) {
      const p = pedidos.find(x => x.id === Number(pid));
      if (p) { setSelectedPedido(p); setModal('facturar'); }
    }
  });

  const pendientes = pedidos.filter(p => p.estado === 'Servido');

  const openFacturar = (ped) => {
    setSelectedPedido(ped);
    setMetodoPagoId(metodosPago.find(m => m.activo)?.id || '');
    
    const dets = getDetalles(ped.id);
    const initialCantidades = {};
    dets.forEach(d => {
      const pending = d.cantidad - (d.cantidadFacturada || 0);
      initialCantidades[d.id] = pending;
    });
    setCantidadesAFacturar(initialCantidades);
    setModal('facturar');
  };

  const handleEmitir = () => {
    if (!metodoPagoId) return toast.error('Seleccioná el método de pago');
    
    const items = Object.entries(cantidadesAFacturar).map(([detalleId, cantidad]) => ({ detalleId, cantidad }));
    const totalSelected = items.reduce((sum, item) => sum + item.cantidad, 0);
    if (totalSelected === 0) return toast.error('Debes seleccionar al menos un producto para facturar');

    const factura = emitirFactura(selectedPedido.id, metodoPagoId, items);
    toast.success(`Factura ${factura.numeroFactura} emitida`);
    setSelectedFactura(factura);
    setModal('ver');
  };

  const getDetalles = (pedidoId) => detallePedidos.filter(d => d.pedidoId === pedidoId);
  const calcTotal = (detalles) => {
    const sub = detalles.reduce((s, d) => {
      const pending = d.cantidad - (d.cantidadFacturada || 0);
      return s + (d.precioMomento * Math.max(0, pending));
    }, 0);
    return { subtotal: sub, impuesto: Math.round(sub * settings.tasaImpuesto / 100), total: sub + Math.round(sub * settings.tasaImpuesto / 100) };
  };

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <h1>Facturación</h1>
        <p>Pedidos listos para facturar y historial de facturas</p>
      </div>

      {/* Pendientes */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>Pedidos Pendientes de Pago</div>
        {pendientes.length === 0 ? (
          <div className="empty-state"><p>No hay pedidos en estado "Servido" para facturar.</p></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Mesa</th><th>Cliente</th><th>Apertura</th><th>Total Estimado</th><th></th></tr></thead>
              <tbody>
                {pendientes.map(p => {
                  const mesa  = mesas.find(m => m.id === p.mesaId);
                  const cli   = clientes.find(c => c.id === p.clienteId);
                  const dets  = getDetalles(p.id);
                  const { total } = calcTotal(dets);
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.tipoPedido === 'Delivery' ? 'Delivery' : `Mesa ${mesa?.numeroMesa || '—'}`}</td>
                      <td>{cli?.nombre}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{formatDate(p.fechaApertura)}</td>
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
        <div className="card-title" style={{ marginBottom: 16 }}>Historial de Facturas</div>
        {facturas.length === 0 ? (
          <div className="empty-state"><p>No hay facturas emitidas.</p></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Número</th><th>Fecha</th><th>Subtotal</th><th>IVA</th><th>Total</th><th>Método</th><th></th></tr></thead>
              <tbody>
                {[...facturas].reverse().map(f => {
                  const metodo = metodosPago.find(m => m.id === f.metodoPagoId);
                  return (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{f.numeroFactura}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{formatDate(f.fechaEmision)}</td>
                      <td>{fmt(f.subtotal)}</td>
                      <td>{fmt(f.impuestos)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmt(f.total)}</td>
                      <td><span className="badge badge-muted">{metodo?.nombre || '—'}</span></td>
                      <td>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setSelectedFactura(f); setModal('ver'); }}>
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
        const dets  = getDetalles(selectedPedido.id);
        const mesa  = mesas.find(m => m.id === selectedPedido.mesaId);
        
        let subtotal = 0;
        dets.forEach(d => {
          const qty = cantidadesAFacturar[d.id] || 0;
          subtotal += d.precioMomento * qty;
        });
        const impuesto = Math.round(subtotal * settings.tasaImpuesto / 100);
        const total = subtotal + impuesto;

        return (
          <Modal title="Emitir Factura" onClose={() => setModal(null)} size="lg"
            footer={<>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleEmitir}><Receipt size={14}/> Emitir Factura</button>
            </>}>
            <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>{selectedPedido.tipoPedido === 'Delivery' ? 'Delivery' : `Mesa ${mesa?.numeroMesa || '—'}`}</p>
            <div className="table-wrapper" style={{ marginBottom: 16 }}>
              <table>
                <thead><tr><th>Producto</th><th>Pendiente</th><th>A Facturar</th><th>P. Unit.</th><th>Subtotal</th></tr></thead>
                <tbody>
                  {dets.map(d => {
                    const prod = productos.find(p => p.id === d.productoId);
                    const pending = d.cantidad - (d.cantidadFacturada || 0);
                    if (pending <= 0) return null;
                    const currentQty = cantidadesAFacturar[d.id] || 0;

                    return (
                      <tr key={d.id}>
                        <td>{prod?.nombre}</td>
                        <td>{pending}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button className="btn btn-sm btn-secondary" style={{ padding: '0 8px' }} onClick={() => setCantidadesAFacturar(prev => ({ ...prev, [d.id]: Math.max(0, currentQty - 1) }))}>-</button>
                            <span style={{ minWidth: 20, textAlign: 'center' }}>{currentQty}</span>
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <div style={{ minWidth: 240 }}>
                <div className="summary-row" style={{ display:'flex',justifyContent:'space-between',padding:'6px 0',color:'var(--text-secondary)' }}>
                  <span>Subtotal</span><span>{fmt(subtotal)}</span>
                </div>
                <div className="summary-row" style={{ display:'flex',justifyContent:'space-between',padding:'6px 0',color:'var(--text-secondary)' }}>
                  <span>IVA ({settings.tasaImpuesto}%)</span><span>{fmt(impuesto)}</span>
                </div>
                <div style={{ borderTop:'1px solid var(--border)',marginTop:6,paddingTop:8,display:'flex',justifyContent:'space-between',fontWeight:800,fontSize:'1.1rem' }}>
                  <span>Total</span><span style={{ color:'var(--accent)' }}>{fmt(total)}</span>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Método de Pago</label>
              <select className="form-input form-select" value={metodoPagoId} onChange={e => setMetodoPagoId(e.target.value)}>
                <option value="">-- Seleccioná --</option>
                {metodosPago.filter(m=>m.activo).map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>
          </Modal>
        );
      })()}

      {/* Modal ver factura */}
      {modal === 'ver' && selectedFactura && (
        <Modal title={`Factura ${selectedFactura.numeroFactura}`} onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cerrar</button>
            <button className="btn btn-primary" onClick={() => window.print()}><Printer size={14}/> Imprimir</button>
          </>}>
          <div style={{ display:'grid',gap:8 }}>
            {[
              ['Número', selectedFactura.numeroFactura],
              ['Fecha',  formatDate(selectedFactura.fechaEmision)],
              ['Subtotal', fmt(selectedFactura.subtotal)],
              [`IVA (${settings.tasaImpuesto}%)`, fmt(selectedFactura.impuestos)],
              ['Total', fmt(selectedFactura.total)],
              ['Método de Pago', metodosPago.find(m=>m.id==selectedFactura.metodoPagoId)?.nombre || '—'],
            ].map(([k,v]) => (
              <div key={k} style={{ display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)' }}>
                <span style={{ color:'var(--text-secondary)', fontSize:'0.85rem' }}>{k}</span>
                <span style={{ fontWeight: k==='Total' ? 800 : 500, color: k==='Total' ? 'var(--accent)' : 'var(--text-primary)' }}>{v}</span>
              </div>
            ))}
          </div>

          {selectedFactura.detalles && selectedFactura.detalles.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>Productos Facturados</div>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Producto</th><th>Cant.</th><th>Subtotal</th></tr></thead>
                  <tbody>
                    {selectedFactura.detalles.map((d, i) => {
                      const prod = productos.find(p => p.id === d.productoId);
                      return (
                        <tr key={i}>
                          <td>{prod?.nombre || 'Producto'}</td>
                          <td>{d.cantidad}</td>
                          <td style={{ fontWeight: 600 }}>{fmt(d.precioMomento * d.cantidad)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
