import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { useNavigate } from 'react-router-dom';
import { Plus, ShoppingBag, Truck, Package, Clock, User, ChevronRight, Flame, CheckCircle, MessageCircle } from 'lucide-react';
import Modal from '../components/ui/Modal';
import SearchableSelect from '../components/ui/SearchableSelect';
import toast from 'react-hot-toast';
import { api } from '../services/apiService';
import './Delivery.css';

export default function Delivery() {
  const { pedidos, clientes, crearPedido, detallePedidos, productos } = useApp();
  const { user, hasRole } = useAuth();
  const { tenantPath } = useTenant();
  const navigate = useNavigate();

  const [filterEstado, setFilterEstado] = useState('Todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [clienteId, setClienteId] = useState('');
  const [sendingNotifId, setSendingNotifId] = useState(null);

  // Get active delivery orders
  const pedidosDelivery = pedidos.filter(
    p => p.tipoPedido === 'Delivery' && ['Abierto', 'Preparando', 'Servido'].includes(p.estado)
  );

  const filteredPedidos = pedidosDelivery.filter(p => filterEstado === 'Todos' || p.estado === filterEstado);

  const countAbiertos = pedidosDelivery.filter(p => p.estado === 'Abierto').length;
  const countPreparando = pedidosDelivery.filter(p => p.estado === 'Preparando').length;
  const countServidos = pedidosDelivery.filter(p => p.estado === 'Servido').length;

  const handleCrearPedido = async () => {
    if (!clienteId) return toast.error('Debe seleccionar un cliente');
    const pedido = await crearPedido(null, user.id, clienteId, 'Delivery');
    toast.success('Pedido de Delivery creado');
    setModalOpen(false);
    navigate(tenantPath(`/pedidos/${pedido.id}`));
  };

  const handleNotificarWhatsApp = async (e, pedido) => {
    e.stopPropagation();
    const cliente = clientes.find(c => Number(c.id) === Number(pedido.clienteId));

    if (!cliente) {
      return toast.error('El pedido no tiene un cliente asignado.');
    }
    if (!cliente.telefono) {
      return toast.error(`El cliente "${cliente.nombre}" no tiene teléfono registrado.`);
    }

    setSendingNotifId(pedido.id);
    const toastId = toast.loading(`Abriendo WhatsApp para ${cliente.nombre}...`);

    try {
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
        `Cliente: ${cliente.nombre}\n\n` +
        `*Productos:*\n${productosLista}\n\n` +
        `*Total: CRC ${total.toLocaleString('es-CR')}*\n\n` +
        `Estado actual: ${pedido.estado}`;

      // Limpiar número de teléfono
      const telefonoLimpio = cliente.telefono.replace(/[\s\-\(\)\+]/g, '');

      // Abrir WhatsApp Web
      const whatsappUrl = `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`;
      window.open(whatsappUrl, '_blank');

      toast.success(`WhatsApp abierto para ${cliente.nombre}`, { id: toastId });
    } catch (err) {
      console.error('Error abriendo WhatsApp:', err);
      toast.error('Error al abrir WhatsApp', { id: toastId });
    } finally {
      setSendingNotifId(null);
    }
  };

  const getClienteNombre = (id) => {
    return clientes.find(c => Number(c.id) === Number(id))?.nombre || 'Cliente General';
  };

  const getItemsCount = (pedidoId) => {
    const dets = detallePedidos.filter(d => Number(d.pedidoId) === Number(pedidoId));
    return dets.reduce((sum, d) => sum + d.cantidad, 0);
  };

  return (
    <div className="page-container animate-fade">
      {/* Header Section */}
      <div className="delivery-header-section">
        <div>
          <h1 className="delivery-title">Gestión de Delivery / Para Llevar</h1>
          <p className="delivery-subtitle">Monitoreo y despacho de pedidos a domicilio y para llevar</p>
        </div>

        <div className="delivery-header-actions">
          {/* Status Filter Pills */}
          <div className="delivery-filter-group">
            <button
              type="button"
              className={`filter-pill ${filterEstado === 'Todos' ? 'active' : ''}`}
              onClick={() => setFilterEstado('Todos')}
            >
              Todos ({pedidosDelivery.length})
            </button>
            <button
              type="button"
              className={`filter-pill filter-pill-abierto ${filterEstado === 'Abierto' ? 'active' : ''}`}
              onClick={() => setFilterEstado('Abierto')}
            >
              <span className="dot dot-blue"></span> Abiertos ({countAbiertos})
            </button>
            <button
              type="button"
              className={`filter-pill filter-pill-preparando ${filterEstado === 'Preparando' ? 'active' : ''}`}
              onClick={() => setFilterEstado('Preparando')}
            >
              <span className="dot dot-orange"></span> En Cocina ({countPreparando})
            </button>
            <button
              type="button"
              className={`filter-pill filter-pill-servido ${filterEstado === 'Servido' ? 'active' : ''}`}
              onClick={() => setFilterEstado('Servido')}
            >
              <span className="dot dot-purple"></span> Listos ({countServidos})
            </button>
          </div>

          {hasRole('Admin', 'Mesero', 'Cajero') && (
            <button className="btn btn-primary" onClick={() => { setClienteId(clientes[0]?.id || ''); setModalOpen(true); }}>
              <Plus size={16} /> Nuevo Pedido
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {filteredPedidos.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <ShoppingBag size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
          <p>No hay pedidos de Delivery activos en esta categoría</p>
        </div>
      ) : (
        <div className="delivery-grid-stitch">
          {filteredPedidos.map(pedido => {
            const numeroFormateado = `#${String(pedido.id).padStart(2, '0')}`;
            const clienteNombre = getClienteNombre(pedido.clienteId);
            const cantItems = getItemsCount(pedido.id);

            let horaApertura = null;
            let minutosTranscurridos = null;
            if (pedido.fechaApertura) {
              const fecha = new Date(pedido.fechaApertura);
              horaApertura = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const diffMs = new Date() - fecha;
              minutosTranscurridos = Math.max(1, Math.floor(diffMs / 60000));
            }

            const estadoLabel = pedido.estado === 'Servido' ? 'Listo' : pedido.estado;

            return (
              <div
                key={pedido.id}
                className={`delivery-card-stitch estado-${pedido.estado.toLowerCase()}`}
                onClick={() => navigate(tenantPath(`/pedidos/${pedido.id}`))}
              >
                {/* Header: Number & Badge */}
                <div className="delivery-card-header">
                  <div className="delivery-num-big">{numeroFormateado}</div>
                  <div className={`delivery-status-pill badge-${pedido.estado.toLowerCase()}`}>
                    {pedido.estado === 'Abierto' && <Clock size={12} />}
                    {pedido.estado === 'Preparando' && <Flame size={12} />}
                    {pedido.estado === 'Servido' && <CheckCircle size={12} />}
                    <span>{estadoLabel}</span>
                  </div>
                </div>

                {/* Body: Icon & Client Info */}
                <div className="delivery-card-body">
                  <div className={`delivery-icon-container icon-${pedido.estado.toLowerCase()}`}>
                    {pedido.estado === 'Abierto' && <ShoppingBag size={28} />}
                    {pedido.estado === 'Preparando' && <Flame size={28} />}
                    {pedido.estado === 'Servido' && <Package size={28} />}
                  </div>

                  <div className="delivery-client-name">
                    <User size={15} /> {clienteNombre}
                  </div>

                  <div className="delivery-items-info">
                    {cantItems > 0 ? `${cantItems} ${cantItems === 1 ? 'producto' : 'productos'}` : 'Sin productos'}
                  </div>
                </div>

                {/* Divider */}
                <div className="delivery-card-divider"></div>

                {/* Footer: Time & Action */}
                <div className="delivery-card-footer">
                  <div className="delivery-time-row">
                    <span className="delivery-time-label">{horaApertura ? `Apertura: ${horaApertura}` : 'Activo'}</span>
                    {minutosTranscurridos && (
                      <span className="delivery-time-elapsed">{minutosTranscurridos} min</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 10, width: '100%' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.8rem' }}
                      disabled={sendingNotifId === pedido.id}
                      onClick={(e) => handleNotificarWhatsApp(e, pedido)}
                      title="Enviar notificación de estado por WhatsApp"
                    >
                      <MessageCircle size={14} style={{ color: '#25D366' }} />
                      {sendingNotifId === pedido.id ? 'Enviando...' : 'Notificar WhatsApp'}
                    </button>

                    <button
                      className="btn-ver-delivery"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(tenantPath(`/pedidos/${pedido.id}`));
                      }}
                    >
                      Ver <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal nuevo pedido */}
      {modalOpen && (
        <Modal
          title="Nuevo Pedido Delivery"
          onClose={() => setModalOpen(false)}
          size="md"
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleCrearPedido}>Abrir Pedido</button>
          </>}
        >
          <div className="form-group">
            <label className="form-label">Seleccionar Cliente</label>
            <SearchableSelect
              options={clientes.map(c => ({ value: c.id, label: c.nombre }))}
              value={clienteId}
              onChange={setClienteId}
              placeholder="-- Seleccione --"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
