import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ChefHat, Clock, CheckCircle, RefreshCw } from 'lucide-react';
import './ColaComandas.css';

const ESTADOS_COCINA = ['Preparando', 'Servido'];

export default function ColaComandas() {
  const { pedidos, detallePedidos, mesas, productos, clientes, updatePedido, reload } = useApp();
  const [tick, setTick] = useState(0);

  // Auto-refresh cada 10 segundos
  useEffect(() => {
    const interval = setInterval(() => { reload(); setTick(t => t + 1); }, 10000);
    return () => clearInterval(interval);
  }, [reload]);

  const comandas = pedidos
    .filter(p => ['Abierto','Preparando','Servido'].includes(p.estado))
    .sort((a,b) => new Date(a.fechaApertura) - new Date(b.fechaApertura));

  const avanzarEstado = (pedido) => {
    const next = pedido.estado === 'Abierto' ? 'Preparando' : pedido.estado === 'Preparando' ? 'Servido' : null;
    if (next) updatePedido(pedido.id, { estado: next });
  };

  const marcarVisto = (pedidoId) => {
    updatePedido(pedidoId, { notificarCocina: false });
  };

  const elapsed = (fecha) => {
    const mins = Math.floor((Date.now() - new Date(fecha)) / 60000);
    if (mins < 1) return '< 1 min';
    return `${mins} min`;
  };

  return (
    <div className="page-container animate-fade">
      <div className="page-header-row">
        <div>
          <h1>Cola de Comandas 🍳</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
            {comandas.length} comanda(s) activa(s) · Auto-actualiza cada 10s
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => { reload(); setTick(t=>t+1); }}>
          <RefreshCw size={14}/> Actualizar
        </button>
      </div>

      {comandas.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <CheckCircle size={48} style={{ margin: '0 auto 12px', color: 'var(--success)', opacity: 1 }}/>
          <p style={{ fontSize: '1rem', color: 'var(--success)' }}>¡Todo al día! No hay comandas pendientes.</p>
        </div>
      ) : (
        <div className="cocina-grid">
          {comandas.map(pedido => {
            const mesa    = mesas.find(m => m.id === pedido.mesaId);
            const cliente = clientes.find(c => c.id === pedido.clienteId);
            const detalles = detallePedidos.filter(d => d.pedidoId === pedido.id);
            const mins = Math.floor((Date.now() - new Date(pedido.fechaApertura)) / 60000);
            const urgent = mins >= 15;

            return (
              <div key={pedido.id} className={`ticket ${pedido.estado.toLowerCase()} ${urgent ? 'urgent' : ''}`}>
                <div className="ticket-header">
                  <div>
                    <div className="ticket-mesa">{pedido.tipoPedido === 'Delivery' ? 'Delivery' : `Mesa ${mesa?.numeroMesa || '—'}`}</div>
                    <div className="ticket-cliente">{cliente?.nombre}</div>
                  </div>
                  <div className="ticket-time">
                    <Clock size={12}/>
                    <span className={urgent ? 'urgent-text' : ''}>{elapsed(pedido.fechaApertura)}</span>
                  </div>
                </div>
                <div className="ticket-estado-badge">
                  <span className={`badge ${pedido.estado==='Preparando' ? 'badge-warning' : pedido.estado==='Servido' ? 'badge-purple' : 'badge-info'}`}>
                    {pedido.estado}
                  </span>
                </div>
                {!!pedido.notificarCocina && (
                  <div className="ticket-alert" style={{
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid var(--warning)',
                    color: 'var(--warning)',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    alignItems: 'center'
                  }}>
                    <span>⚠️ ÍTEMS NUEVOS O MODIFICADOS</span>
                    <button className="btn btn-warning" style={{ width: '100%', padding: '4px 8px', fontSize: '0.72rem' }} onClick={() => marcarVisto(pedido.id)}>
                      Entendido
                    </button>
                  </div>
                )}
                <ul className="ticket-items">
                  {detalles.map(d => {
                    const prod = productos.find(p => p.id === d.productoId);
                    return (
                      <li key={d.id}>
                        <span className="ticket-qty">×{d.cantidad}</span>
                        <span className="ticket-prod">{prod?.nombre}</span>
                        {d.notas && <span className="ticket-nota">📝 {d.notas}</span>}
                      </li>
                    );
                  })}
                </ul>
                {pedido.estado !== 'Servido' && (
                  <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={() => avanzarEstado(pedido)}>
                    <ChefHat size={15}/>
                    {pedido.estado === 'Abierto'    && 'Iniciar Preparación'}
                    {pedido.estado === 'Preparando' && 'Marcar como Servido'}
                  </button>
                )}
                {pedido.estado === 'Servido' && (
                  <div style={{ textAlign:'center', marginTop:12, color:'var(--success)', fontWeight:600, fontSize:'0.85rem' }}>
                    <CheckCircle size={14} style={{ display:'inline', marginRight:4 }}/> Servido
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
