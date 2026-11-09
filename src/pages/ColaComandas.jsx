import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ChefHat, Clock, CheckCircle, RefreshCw, User } from 'lucide-react';
import './ColaComandas.css';

const ESTADOS_COCINA = ['Preparando', 'Servido'];
const STORAGE_KEY = 'comandas_detalles_servidos';

const getServidosMap = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

const saveServidosMap = (map) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
};

export default function ColaComandas() {
  const { pedidos, detallePedidos, mesas, barras, productos, clientes, usuarios, updatePedido, reload } = useApp();
  const [tick, setTick] = useState(0);

  // Auto-refresh cada 10 segundos
  useEffect(() => {
    const interval = setInterval(() => { reload(); setTick(t => t + 1); }, 10000);
    return () => clearInterval(interval);
  }, [reload]);

  const comandas = pedidos
    .filter(p => {
      if (!['Abierto', 'Preparando', 'Servido'].includes(p.estado)) return false;

      const itemsCocina = detallePedidos.filter(d => {
        if (d.pedidoId !== p.id) return false;
        const prod = productos.find(pr => pr.id === d.productoId);
        return prod && prod.enviarCocina !== 0 && prod.enviarCocina !== false;
      });
      if (itemsCocina.length === 0) return false;

      // Si el pedido está marcado como Servido, no debe mostrarse a menos que tenga productos nuevos agregados que requieran cocina
      if (p.estado === 'Servido') {
        const servidosMap = getServidosMap();
        let servidosIds = servidosMap[p.id];
        if (!servidosIds) {
          // Si el pedido ya está en Servido pero no tiene registro local, se consideran servidos sus ítems de cocina actuales
          servidosIds = itemsCocina.map(d => d.id);
          servidosMap[p.id] = servidosIds;
          saveServidosMap(servidosMap);
        }

        const hayItemsNuevos = itemsCocina.some(d => !servidosIds.includes(d.id));
        if (!hayItemsNuevos) {
          // Si tenía notificarCocina activo por algún producto que no va a cocina (ej: refresco), limpiarlo
          if (p.notificarCocina) {
            updatePedido(p.id, { notificarCocina: false });
          }
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => new Date(a.fechaApertura) - new Date(b.fechaApertura));

  const marcarServido = (pedido, itemsAMarcar) => {
    const servidosMap = getServidosMap();
    const idsActuales = servidosMap[pedido.id] || [];
    const nuevosIds = (itemsAMarcar || []).map(d => d.id);
    servidosMap[pedido.id] = Array.from(new Set([...idsActuales, ...nuevosIds]));
    saveServidosMap(servidosMap);

    updatePedido(pedido.id, { estado: 'Servido', notificarCocina: false });

    if (pedido.tipoPedido === 'Delivery') {
      const cliente = clientes.find(c => c.id === pedido.clienteId);
      if (cliente && cliente.telefono) {
        let num = cliente.telefono.replace(/\D/g, '');
        if (num.length === 8) num = `506${num}`;
        const mensaje = `Hola ${cliente.nombre}, tu pedido ya está listo`;
        const url = `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`;
        window.open(url, '_blank');
      }
    }
  };

  const avanzarEstado = (pedido, itemsCocina) => {
    if (pedido.estado === 'Abierto') {
      updatePedido(pedido.id, { estado: 'Preparando' });
    } else if (pedido.estado === 'Preparando') {
      marcarServido(pedido, itemsCocina);
    }
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
        <button className="btn btn-secondary btn-sm" onClick={() => { reload(); setTick(t => t + 1); }}>
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
            const barra   = (barras || []).find(b => b.id === (pedido.barraId || pedido.mesaId));
            const cliente = clientes.find(c => c.id === pedido.clienteId);
            const mesero  = usuarios.find(u => u.id === pedido.usuarioId);
            const detalles = detallePedidos.filter(d => {
              if (d.pedidoId !== pedido.id) return false;
              const prod = productos.find(p => p.id === d.productoId);
              // Si el producto tiene enviarCocina en false/0, no se muestra en cocina
              if (prod && (prod.enviarCocina === 0 || prod.enviarCocina === false)) return false;
              return true;
            });

            // Si el pedido no tiene ningún producto que requiera preparación en cocina, no mostramos el ticket
            if (detalles.length === 0) return null;

            // Determinar cuáles ítems ya fueron servidos y cuáles son nuevos
            const servidosMap = getServidosMap();
            let servidosIds = servidosMap[pedido.id];
            if (!servidosIds) {
              servidosIds = (pedido.estado === 'Servido') ? detalles.map(d => d.id) : [];
              if (pedido.estado === 'Servido') {
                servidosMap[pedido.id] = servidosIds;
                saveServidosMap(servidosMap);
              }
            }

            const itemsServidos = detalles.filter(d => servidosIds.includes(d.id));
            const itemsNuevos   = detalles.filter(d => !servidosIds.includes(d.id));

            const mins = Math.floor((Date.now() - new Date(pedido.fechaApertura)) / 60000);
            const urgent = mins >= 15;

            return (
              <div key={pedido.id} className={`ticket ${pedido.estado.toLowerCase()} ${urgent ? 'urgent' : ''}`}>
                <div className="ticket-header">
                  <div>
                    <div className="ticket-mesa">
                      {pedido.tipoPedido === 'Delivery'
                        ? 'Delivery'
                        : pedido.tipoPedido === 'Barra'
                        ? `Barra ${barra?.numeroBarra || '—'}`
                        : `Mesa ${mesa?.numeroMesa || '—'}`}
                    </div>
                    <div className="ticket-cliente">{cliente?.nombre}</div>
                  </div>
                  <div className="ticket-time" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12}/>
                      <span className={urgent ? 'urgent-text' : ''}>{elapsed(pedido.fechaApertura)}</span>
                    </div>
                    {mesero && (
                      <div className="ticket-mesero"><User size={11} />{mesero.username}</div>
                    )}
                  </div>
                </div>

                <div className="ticket-estado-badge">
                  <span className={`badge ${pedido.estado === 'Preparando' ? 'badge-warning' : pedido.estado === 'Servido' ? 'badge-purple' : 'badge-info'}`}>
                    {pedido.estado}
                  </span>
                </div>

                {!!pedido.notificarCocina && itemsNuevos.length > 0 && (
                  <div className="ticket-alert" style={{
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid var(--warning)',
                    color: 'var(--warning)',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    marginTop: 8,
                    marginBottom: 10,
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

                {/* Ítems ya servidos previamente */}
                {itemsServidos.length > 0 && (
                  <ul className="ticket-items">
                    {itemsServidos.map(d => {
                      const prod = productos.find(p => p.id === d.productoId);
                      return (
                        <li key={d.id} style={{ opacity: 0.85 }}>
                          <span className="ticket-qty">×{d.cantidad}</span>
                          <span className="ticket-prod">{prod?.nombre}</span>
                          {d.notas && <span className="ticket-nota">📝 {d.notas}</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Señal de Servido debajo de los ítems ya servidos */}
                {itemsServidos.length > 0 && (
                  <div style={{
                    textAlign: 'center',
                    margin: '10px 0',
                    color: 'var(--success)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    padding: '6px 0',
                    borderTop: '1px dashed var(--border)',
                    borderBottom: itemsNuevos.length > 0 ? '1px dashed var(--border)' : 'none'
                  }}>
                    <CheckCircle size={14} style={{ display: 'inline', marginRight: 4 }}/> Servido
                  </div>
                )}

                {/* Ítems nuevos agregados (aparecen debajo de la señal de Servido) */}
                {(itemsServidos.length === 0 ? detalles : itemsNuevos).length > 0 && (
                  <ul className="ticket-items" style={{ marginTop: itemsServidos.length > 0 ? 8 : 0 }}>
                    {(itemsServidos.length === 0 ? detalles : itemsNuevos).map(d => {
                      const prod = productos.find(p => p.id === d.productoId);
                      return (
                        <li key={d.id} style={itemsServidos.length > 0 ? { background: 'rgba(245, 158, 11, 0.08)', padding: '6px 8px', borderRadius: 6 } : {}}>
                          <span className="ticket-qty">×{d.cantidad}</span>
                          <span className="ticket-prod" style={itemsServidos.length > 0 ? { fontWeight: 700 } : {}}>{prod?.nombre}</span>
                          {d.notas && <span className="ticket-nota">📝 {d.notas}</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Botón de acción */}
                {pedido.estado === 'Abierto' && (
                  <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={() => avanzarEstado(pedido, detalles)}>
                    <ChefHat size={15}/> Iniciar Preparación
                  </button>
                )}

                {pedido.estado === 'Preparando' && (
                  <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={() => avanzarEstado(pedido, detalles)}>
                    <ChefHat size={15}/> Marcar como Servido
                  </button>
                )}

                {pedido.estado === 'Servido' && itemsNuevos.length > 0 && (
                  <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={() => marcarServido(pedido, itemsNuevos)}>
                    <ChefHat size={15}/> Marcar como Servido
                  </button>
                )}

                {pedido.estado === 'Servido' && itemsNuevos.length === 0 && itemsServidos.length === 0 && (
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