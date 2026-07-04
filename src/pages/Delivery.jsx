import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Plus, ShoppingBag, CheckCircle } from 'lucide-react';
import Modal from '../components/ui/Modal';
import SearchableSelect from '../components/ui/SearchableSelect';
import toast from 'react-hot-toast';

export default function Delivery() {
  const { pedidos, clientes, crearPedido } = useApp();
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [clienteId, setClienteId] = useState('');

  // Get active delivery orders
  const pedidosDelivery = pedidos.filter(
    p => p.tipoPedido === 'Delivery' && ['Abierto', 'Preparando', 'Servido'].includes(p.estado)
  );

  const handleCrearPedido = async () => {
    if (!clienteId) return toast.error('Debe seleccionar un cliente');
    const pedido = await crearPedido(null, user.id, clienteId, 'Delivery');
    toast.success('Pedido de Delivery creado');
    setModalOpen(false);
    navigate(`/pedidos/${pedido.id}`);
  };

  const getClienteNombre = (id) => {
    return clientes.find(c => c.id === id)?.nombre || 'Desconocido';
  };

  return (
    <div className="page-container animate-fade">
      <div className="page-header-row" style={{ marginBottom: 24 }}>
        <div>
          <h1>Delivery / Para Llevar</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
            {pedidosDelivery.length} pedidos activos
          </p>
        </div>
        {hasRole('Admin', 'Mesero', 'Cajero') && (
          <button className="btn btn-primary" onClick={() => { setClienteId(clientes[0]?.id || ''); setModalOpen(true); }}>
            <Plus size={16} /> Nuevo Pedido
          </button>
        )}
      </div>

      {pedidosDelivery.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <ShoppingBag size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
          <p>No hay pedidos de Delivery activos</p>
        </div>
      ) : (
        <div className="mesas-grid">
          {pedidosDelivery.map(pedido => (
            <div key={pedido.id} className="mesa-card" style={{ borderLeft: '4px solid var(--accent)' }}>
              <div className="mesa-number" style={{ fontSize: '1.2rem' }}>
                Delivery
              </div>
              <div className="mesa-capacity" style={{ marginTop: 8 }}>
                Cliente: {getClienteNombre(pedido.clienteId)}
              </div>
              <div style={{ marginTop: 8 }}>
                <EstadoBadge estado={pedido.estado} />
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 8 }}>
                Apertura: {new Date(pedido.fechaApertura).toLocaleTimeString('es-CR')}
              </div>
              
              <button className="btn btn-sm btn-secondary" style={{ marginTop: 16, width: '100%' }}
                onClick={() => navigate(`/pedidos/${pedido.id}`)}>
                Ver Pedido
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal nuevo pedido */}
      {modalOpen && (
        <Modal title="Nuevo Pedido Delivery" onClose={() => setModalOpen(false)} size="md"
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleCrearPedido}>Abrir Pedido</button>
          </>}>
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

function EstadoBadge({ estado }) {
  const map = {
    Abierto:    'badge-info',
    Preparando: 'badge-warning',
    Servido:    'badge-purple',
    Pagado:     'badge-success',
    Cancelado:  'badge-danger',
  };
  return <span className={`badge ${map[estado] || 'badge-muted'}`}>{estado}</span>;
}
