import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, Users, Utensils, Armchair, User, AlertTriangle } from 'lucide-react';
import Modal from '../components/ui/Modal';
import SearchableSelect from '../components/ui/SearchableSelect';
import toast from 'react-hot-toast';
import { confirmDialog } from '../utils/sweetAlert';
import './Mesas.css';

const ESTADOS = ['Libre', 'Ocupada', 'Reservada'];

export default function Mesas() {
  const { mesas, addMesa, updateMesa, deleteMesa, crearPedido, pedidos, clientes } = useApp();
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();

  const [filterEstado, setFilterEstado] = useState('Todas');
  const [modal, setModal] = useState(null); // 'add' | 'edit' | 'pedido'
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ numeroMesa: '', capacidad: 2, estado: 'Libre' });
  const [pedidoForm, setPedidoForm] = useState({ clienteId: '1' });

  const openAdd = () => { setForm({ numeroMesa: '', capacidad: 2, estado: 'Libre' }); setModal('add'); };
  const openEdit = (m) => { setSelected(m); setForm({ numeroMesa: m.numeroMesa, capacidad: m.capacidad, estado: m.estado }); setModal('edit'); };
  const openPedido = (m) => { setSelected(m); setPedidoForm({ clienteId: clientes[0]?.id || '' }); setModal('pedido'); };

  const handleSave = async () => {
    if (!form.numeroMesa) return toast.error('Ingresá el número de mesa');
    if (modal === 'add') {
      if (mesas.find(m => String(m.numeroMesa) === String(form.numeroMesa))) return toast.error('Ese número ya existe');
      await addMesa({ ...form, numeroMesa: Number(form.numeroMesa), capacidad: Number(form.capacidad) });
      toast.success('Mesa creada');
    } else {
      await updateMesa(selected.id, { ...form, numeroMesa: Number(form.numeroMesa), capacidad: Number(form.capacidad) });
      toast.success('Mesa actualizada');
    }
    setModal(null);
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmDialog({
      title: '¿Eliminar esta mesa?',
      text: 'Se removerá la mesa de la vista del restaurante.',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmed) return;
    await deleteMesa(id);
    toast.success('Mesa eliminada');
  };

  const handleCrearPedido = async () => {
    const pedido = await crearPedido(selected.id, user.id, pedidoForm.clienteId);
    toast.success(`Pedido abierto en Mesa ${selected.numeroMesa}`);
    setModal(null);
    navigate(`/pedidos/${pedido.id}`);
  };

  const sorted = [...mesas].sort((a, b) => a.numeroMesa - b.numeroMesa);
  const filteredMesas = sorted.filter(m => filterEstado === 'Todas' || m.estado === filterEstado);

  const countLibres = mesas.filter(m => m.estado === 'Libre').length;
  const countOcupadas = mesas.filter(m => m.estado === 'Ocupada').length;
  const countReservadas = mesas.filter(m => m.estado === 'Reservada').length;

  return (
    <div className="page-container animate-fade">
      {/* Header Section */}
      <div className="mesas-header-section">
        <div>
          <h1 className="mesas-title">Gestión de Mesas</h1>
          <p className="mesas-subtitle">Vista general del comedor principal</p>
        </div>

        <div className="mesas-header-actions">
          {/* Status Filter Pills */}
          <div className="mesas-filter-group">
            <button
              type="button"
              className={`filter-pill ${filterEstado === 'Todas' ? 'active' : ''}`}
              onClick={() => setFilterEstado('Todas')}
            >
              Todas ({mesas.length})
            </button>
            <button
              type="button"
              className={`filter-pill filter-pill-ocupada ${filterEstado === 'Ocupada' ? 'active' : ''}`}
              onClick={() => setFilterEstado('Ocupada')}
            >
              <span className="dot dot-red"></span> Ocupada ({countOcupadas})
            </button>
            <button
              type="button"
              className={`filter-pill filter-pill-libre ${filterEstado === 'Libre' ? 'active' : ''}`}
              onClick={() => setFilterEstado('Libre')}
            >
              <span className="dot dot-green"></span> Libre ({countLibres})
            </button>
            <button
              type="button"
              className={`filter-pill filter-pill-reservada ${filterEstado === 'Reservada' ? 'active' : ''}`}
              onClick={() => setFilterEstado('Reservada')}
            >
              <span className="dot dot-yellow"></span> Reservada ({countReservadas})
            </button>
          </div>

          {hasRole('Admin') && (
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={16} /> Nueva Mesa
            </button>
          )}
        </div>
      </div>

      {/* Mesas Grid */}
      <div className="mesas-grid-stitch">
        {filteredMesas.map(mesa => {
          const pedidoActivo = pedidos.find(p => p.mesaId === mesa.id && ['Abierto', 'Preparando', 'Servido'].includes(p.estado));
          
          let horaLlegada = null;
          let minutosTranscurridos = null;
          if (pedidoActivo && pedidoActivo.fechaApertura) {
            const fecha = new Date(pedidoActivo.fechaApertura);
            horaLlegada = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const diffMs = new Date() - fecha;
            minutosTranscurridos = Math.max(1, Math.floor(diffMs / 60000));
          }

          const numeroFormateado = String(mesa.numeroMesa).padStart(2, '0');

          return (
            <div
              key={mesa.id}
              className={`mesa-card-stitch estado-${mesa.estado.toLowerCase()}`}
              onClick={() => {
                if (mesa.estado === 'Libre' && hasRole('Admin', 'Mesero')) openPedido(mesa);
                else if (mesa.estado === 'Ocupada' && pedidoActivo && hasRole('Admin', 'Mesero')) navigate(`/pedidos/${pedidoActivo.id}`);
              }}
            >
              {/* Card Header: Number left, Pill right */}
              <div className="mesa-card-header">
                <div className="mesa-num-big">{numeroFormateado}</div>
                <div className={`mesa-status-pill badge-${mesa.estado.toLowerCase()}`}>
                  {mesa.estado === 'Ocupada' && <AlertTriangle size={13} className="pill-icon-warning" />}
                  <span>{mesa.estado}</span>
                </div>
              </div>

              {/* Card Body: Icon & Capacity */}
              <div className="mesa-card-body">
                {mesa.estado === 'Ocupada' ? (
                  <>
                    <div className="mesa-icon-container icon-ocupada">
                      <Utensils size={30} />
                    </div>
                    <div className="mesa-capacity-info">
                      <Users size={14} /> {mesa.capacidad} Personas
                    </div>
                  </>
                ) : mesa.estado === 'Libre' ? (
                  <>
                    <div className="mesa-icon-container icon-libre">
                      <Armchair size={30} />
                    </div>
                    <div className="mesa-capacity-info">
                      Capacidad: {mesa.capacidad}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mesa-icon-container icon-reservada">
                      <User size={30} />
                    </div>
                    <div className="mesa-capacity-info">
                      Reserva / Capacidad: {mesa.capacidad}
                    </div>
                  </>
                )}
              </div>

              {/* Divider */}
              <div className="mesa-card-divider"></div>

              {/* Card Footer: Details / Actions */}
              <div className="mesa-card-footer">
                {mesa.estado === 'Ocupada' ? (
                  <div className="mesa-footer-occupied">
                    <div className="mesa-time-row">
                      <span className="time-label">{horaLlegada ? `Llegó: ${horaLlegada}` : 'Pedido activo'}</span>
                      {minutosTranscurridos && (
                        <span className="time-elapsed">{minutosTranscurridos} min</span>
                      )}
                    </div>
                    {hasRole('Admin', 'Mesero') && (
                      <button
                        className="btn-ver-pedido"
                        onClick={e => {
                          e.stopPropagation();
                          if (pedidoActivo) navigate(`/pedidos/${pedidoActivo.id}`);
                        }}
                      >
                        Ver Pedido
                      </button>
                    )}
                  </div>
                ) : mesa.estado === 'Libre' ? (
                  <div className="mesa-footer-free">
                    {hasRole('Admin', 'Mesero') && (
                      <button
                        className="btn-asignar-mesa"
                        onClick={e => {
                          e.stopPropagation();
                          openPedido(mesa);
                        }}
                      >
                        + Asignar Mesa
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="mesa-footer-reserved">
                    <span className="reserved-text">Reservada</span>
                  </div>
                )}

                {/* Admin actions */}
                {hasRole('Admin') && (
                  <div className="mesa-admin-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn-action-icon" title="Editar Mesa" onClick={() => openEdit(mesa)}>
                      <Edit2 size={13} />
                    </button>
                    <button className="btn-action-icon btn-action-danger" title="Eliminar Mesa" onClick={() => handleDelete(mesa.id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal add/edit */}
      {(modal === 'add' || modal === 'edit') && (
        <Modal
          title={modal === 'add' ? 'Nueva Mesa' : 'Editar Mesa'}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
          </>}
        >
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Número de Mesa</label>
              <input
                className="form-input"
                type="number"
                min="1"
                value={form.numeroMesa}
                onChange={e => setForm(f => ({ ...f, numeroMesa: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Capacidad</label>
              <input
                className="form-input"
                type="number"
                min="1"
                max="20"
                value={form.capacidad}
                onChange={e => setForm(f => ({ ...f, capacidad: e.target.value }))}
              />
            </div>
          </div>
          {modal === 'edit' && (
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select
                className="form-input form-select"
                value={form.estado}
                onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
              >
                {ESTADOS.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
          )}
        </Modal>
      )}

      {/* Modal nuevo pedido */}
      {modal === 'pedido' && (
        <Modal
          title={`Nuevo Pedido — Mesa ${selected?.numeroMesa}`}
          onClose={() => setModal(null)}
          size="md"
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleCrearPedido}>Abrir Pedido</button>
          </>}
        >
          <div className="form-group">
            <label className="form-label">Cliente</label>
            <SearchableSelect
              options={clientes.map(c => ({ value: c.id, label: c.nombre }))}
              value={pedidoForm.clienteId}
              onChange={val => setPedidoForm(f => ({ ...f, clienteId: val }))}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

