import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { Eye, Search, Calendar, X, MessageCircle } from 'lucide-react';
import DatePicker, { formatIsoToDMY } from '../../components/ui/DatePicker';
import './ListaPedidos.css';

const ESTADOS = ['Todos','Abierto','Preparando','Servido','Pagado','Cancelado'];
const BADGE = { Abierto:'badge-info', Preparando:'badge-warning', Servido:'badge-purple', Pagado:'badge-success', Cancelado:'badge-danger' };

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalDateString = (dateObj) => {
  if (!dateObj) return '';
  const d = new Date(dateObj);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocationName = (pedido, mesas, barras) => {
  if (pedido.tipoPedido === 'Delivery') return 'Delivery';
  if (pedido.tipoPedido === 'Barra') {
    const barra = barras.find(b => Number(b.id) === Number(pedido.mesaId));
    return `Barra ${barra?.numeroBarra || '—'}`;
  }
  const mesa = mesas.find(m => Number(m.id) === Number(pedido.mesaId));
  return `Mesa ${mesa?.numeroMesa || '—'}`;
};

export default function ListaPedidos() {
  const { pedidos, mesas, barras, clientes, detallePedidos, productos } = useApp();
  const { user, hasRole } = useAuth();
  const { tenantPath } = useTenant();
  const navigate = useNavigate();

  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [filtroFecha, setFiltroFecha] = useState(getTodayString());
  const [busqueda, setBusqueda] = useState('');

  const handleNotificarWhatsApp = (pedido) => {
    const cli = clientes.find(c => Number(c.id) === Number(pedido.clienteId));
    if (!cli) {
      return alert('El pedido no tiene un cliente asignado.');
    }
    if (!cli.telefono) {
      return alert(`El cliente "${cli.nombre}" no tiene un teléfono registrado.`);
    }

    // Construir mensaje con detalles del pedido
    const detalles = detallePedidos.filter(d => Number(d.pedidoId) === Number(pedido.id));
    const productosLista = detalles.map(d => {
      // Buscar el producto en la lista de productos
      const producto = productos.find(p => Number(p.id) === Number(d.productoId));
      const nombre = producto?.nombre || d.productoNombre || d.nombre || 'Producto';
      const cantidad = d.cantidad || 1;
      const precio = d.precioMomento || d.precio || producto?.precio || 0;
      return `• ${cantidad}x ${nombre} - CRC ${precio.toLocaleString('es-CR')}`;
    }).join('\n');

    // Calcular total sumando los detalles
    const totalCalculado = detalles.reduce((sum, d) => {
      const producto = productos.find(p => Number(p.id) === Number(d.productoId));
      const precio = d.precioMomento || d.precio || producto?.precio || 0;
      return sum + (precio * (d.cantidad || 1));
    }, 0);

    const total = pedido.total || totalCalculado || 0;
    const mensaje = `*PEDIDO #${pedido.id}*\n\n` +
      `Cliente: ${cli.nombre}\n\n` +
      `*Productos:*\n${productosLista}\n\n` +
      `*Total: CRC ${total.toLocaleString('es-CR')}*\n\n` +
      `Estado actual: ${pedido.estado}`;

    // Limpiar número de teléfono
    const telefonoLimpio = cli.telefono.replace(/[\s\-\(\)\+]/g, '');

    // Abrir WhatsApp Web
    const whatsappUrl = `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`;
    window.open(whatsappUrl, '_blank');
  };

  let lista = [...pedidos].sort((a,b) => new Date(b.fechaApertura) - new Date(a.fechaApertura));

  if (filtroEstado !== 'Todos') lista = lista.filter(p => p.estado === filtroEstado);
  if (filtroFecha) lista = lista.filter(p => getLocalDateString(p.fechaApertura) === filtroFecha);
  if (busqueda) {
    lista = lista.filter(p => {
      const label = getLocationName(p, mesas, barras);
      const cli  = clientes.find(c => Number(c.id) === Number(p.clienteId));
      return `${label} ${cli?.nombre}`.toLowerCase().includes(busqueda.toLowerCase());
    });
  }

  return (
    <div className="page-container animate-fade">
      <div className="page-header-row" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1>Pedidos</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
            {lista.length} resultado(s) {filtroFecha ? `para el ${formatIsoToDMY(filtroFecha)}` : '(todas las fechas)'}
          </p>
        </div>

        {/* Date Filter Picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Fecha:</span>
            <DatePicker 
              value={filtroFecha} 
              onChange={e => setFiltroFecha(e.target.value)} 
            />
            {filtroFecha && (
              <button 
                type="button"
                className="btn btn-ghost btn-icon btn-sm" 
                title="Ver todas las fechas" 
                style={{ padding: 2 }}
                onClick={() => setFiltroFecha('')}
              >
                <X size={14} />
              </button>
            )}
          </div>
          {filtroFecha !== getTodayString() && (
            <button 
              type="button" 
              className="btn btn-sm btn-secondary"
              onClick={() => setFiltroFecha(getTodayString())}
            >
              Hoy
            </button>
          )}
          {!filtroFecha && (
            <button 
              type="button" 
              className="btn btn-sm btn-ghost"
              style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
              onClick={() => setFiltroFecha(getTodayString())}
            >
              Ver sólo hoy
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
          <Search size={14} className="search-icon" />
          <input className="form-input" placeholder="Buscar por lugar o cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ESTADOS.map(e => (
            <button key={e} className={`btn btn-sm ${filtroEstado===e ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFiltroEstado(e)}>{e}</button>
          ))}
        </div>
      </div>

      <div className="card">
        {lista.length === 0 ? (
          <div className="empty-state"><p>No hay pedidos que coincidan para este filtro.</p></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>#</th><th>Lugar / Tipo</th><th>Cliente</th><th>Estado</th><th>Apertura</th><th>Notificar</th><th>Ver</th></tr></thead>
              <tbody>
                {lista.map(p => {
                  const cli  = clientes.find(c => Number(c.id) === Number(p.clienteId));
                  const locationName = getLocationName(p, mesas, barras);
                  return (
                    <tr key={p.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontFamily: 'monospace' }}>{p.id}</td>
                      <td style={{ fontWeight: 600 }}>
                        {p.tipoPedido === 'Delivery' ? (
                          <span className="badge badge-purple" style={{padding: '2px 6px'}}>Delivery</span>
                        ) : p.tipoPedido === 'Barra' ? (
                          <span className="badge badge-info" style={{padding: '2px 6px'}}>{locationName}</span>
                        ) : (
                          locationName
                        )}
                      </td>
                      <td>{cli?.nombre || '—'}</td>
                      <td><span className={`badge ${BADGE[p.estado]}`}>{p.estado}</span></td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        {new Date(p.fechaApertura).toLocaleString('es-CR')}
                      </td>
                      <td>
                        {p.tipoPedido === 'Delivery' && cli?.telefono ? (
                          <button 
                            className="btn btn-ghost btn-icon btn-sm" 
                            onClick={() => handleNotificarWhatsApp(p)}
                            title="Notificar por WhatsApp"
                          >
                            <MessageCircle size={14} style={{ color: '#25D366' }}/>
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => navigate(tenantPath(`/pedidos/${p.id}`))}>
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
    </div>
  );
}

