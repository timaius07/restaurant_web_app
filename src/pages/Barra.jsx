import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, Users, Utensils, HandPlatter, User, AlertTriangle, Beer } from 'lucide-react';
import Modal from '../components/ui/Modal';
import SearchableSelect from '../components/ui/SearchableSelect';
import toast from 'react-hot-toast';
import { confirmDialog } from '../utils/sweetAlert';
import './Barra.css';

const ESTADOS = ['Libre', 'Ocupada', 'Reservada'];

export default function Barra() {
  const { barras, addBarra, updateBarra, deleteBarra, crearPedido, pedidos, clientes } = useApp();
  const { user, hasRole, canAccess } = useAuth();
  const { tenantPath } = useTenant();
  const navigate = useNavigate();

  const [filterEstado, setFilterEstado] = useState('Todas');
  const [modal, setModal] = useState(null); // 'add' | 'edit' | 'pedido'
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ numeroBarra: '', capacidad: 2, estado: 'Libre' });
  const [pedidoForm, setPedidoForm] = useState({ clienteId: '1' });

  const openAdd = () => { setForm({ numeroBarra: '', capacidad: 2, estado: 'Libre' }); setModal('add'); };
  const openEdit = (b) => { setSelected(b); setForm({ numeroBarra: b.numeroBarra, capacidad: b.capacidad, estado: b.estado }); setModal('edit'); };
  const openPedido = (b) => { setSelected(b); setPedidoForm({ clienteId: clientes[0]?.id || '' }); setModal('pedido'); };

  const handleSave = async () => {
    if (!form.numeroBarra) return toast.error('Ingresá el número de barra');
    if (modal === 'add') {
      if (barras.find(b => String(b.numeroBarra) === String(form.numeroBarra))) return toast.error('Ese número ya existe');
      await addBarra({ ...form, numeroBarra: Number(form.numeroBarra), capacidad: Number(form.capacidad) });
      toast.success('Barra creada');
    } else {
      await updateBarra(selected.id, { ...form, numeroBarra: Number(form.numeroBarra), capacidad: Number(form.capacidad) });
      toast.success('Barra actualizada');
    }
    setModal(null);
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmDialog({
      title: '¿Eliminar esta barra?',
      text: 'Se removerá la barra de la vista del restaurante.',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmed) return;
    await deleteBarra(id);
    toast.success('Barra eliminada');
  };

  const handleCrearPedido = async () => {
    const pedido = await crearPedido(selected.id, user.id, pedidoForm.clienteId, 'Barra');
    toast.success(`Pedido abierto en Barra ${selected.numeroBarra}`);
    setModal(null);
    navigate(tenantPath(`/pedidos/${pedido.id}`));
  };

  const sorted = [...(barras || [])].sort((a, b) => a.numeroBarra - b.numeroBarra);
  const filteredBarras = sorted.filter(b => filterEstado === 'Todas' || b.estado === filterEstado);

  const countLibres = (barras || []).filter(b => b.estado === 'Libre').length;
  const countOcupadas = (barras || []).filter(b => b.estado === 'Ocupada').length;
  const countReservadas = (barras || []).filter(b => b.estado === 'Reservada').length;

  return (
    <div className="page-container animate-fade">
      {/* Header Section */}
      <div className="mesas-header-section">
        <div>
          <h1 className="mesas-title">Gestión de Barra</h1>
          <p className="mesas-subtitle">Vista general del área de barra</p>
        </div>

        <div className="mesas-header-actions">
          {/* Status Filter Pills */}
          <div className="mesas-filter-group">
            <button
              type="button"
              className={`filter-pill ${filterEstado === 'Todas' ? 'active' : ''}`}
              onClick={() => setFilterEstado('Todas')}
            >
              Todas ({(barras || []).length})
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
              <Plus size={16} /> Nueva Barra
            </button>
          )}
        </div>
      </div>

      {/* Barras Grid */}
      <div className="mesas-grid-stitch">
        {filteredBarras.map(barra => {
          const pedidoActivo = pedidos.find(p => p.mesaId === barra.id && ['Abierto', 'Preparando', 'Servido'].includes(p.estado));

          let horaLlegada = null;
          let minutosTranscurridos = null;
          if (pedidoActivo && pedidoActivo.fechaApertura) {
            const fecha = new Date(pedidoActivo.fechaApertura);
            horaLlegada = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const diffMs = new Date() - fecha;
            minutosTranscurridos = Math.max(1, Math.floor(diffMs / 60000));
          }

          const numeroFormateado = String(barra.numeroBarra).padStart(2, '0');

          return (
            <div
              key={barra.id}
              className={`mesa-card-stitch estado-${barra.estado.toLowerCase()}`}
              onClick={() => {
                if (barra.estado === 'Libre' && canAccess('/barra')) openPedido(barra);
                else if (barra.estado === 'Libre' && !canAccess('/barra')) {
                  toast.error('No tienes acceso al módulo de Barra. Solicita al administrador que habilite el permiso /barra para tu rol.', { icon: '🔒', duration: 4000 });
                }
                else if (barra.estado === 'Ocupada' && pedidoActivo && canAccess('/pedidos')) navigate(tenantPath(`/pedidos/${pedidoActivo.id}`));
                else if (barra.estado === 'Ocupada' && pedidoActivo && !canAccess('/pedidos')) {
                  toast.error('No tienes acceso al módulo de Pedidos. Solicita al administrador que habilite el permiso /pedidos para tu rol.', { icon: '🔒', duration: 4000 });
                }
              }}
            >
              {/* Card Header: Number left, Pill right */}
              <div className="mesa-card-header">
                <div className="mesa-num-big">{numeroFormateado}</div>
                <div className={`mesa-status-pill badge-${barra.estado.toLowerCase()}`}>
                  {barra.estado === 'Ocupada' && <AlertTriangle size={13} className="pill-icon-warning" />}
                  <span>{barra.estado}</span>
                </div>
              </div>

              {/* Card Body: Icon & Capacity */}
              <div className="mesa-card-body">
                {barra.estado === 'Ocupada' ? (
                  <>
                    <div className="mesa-icon-container icon-ocupada">
                      <Utensils size={30} />
                    </div>
                    <div className="mesa-capacity-info">
                      <Users size={14} /> {barra.capacidad} Personas
                    </div>
                  </>
                ) : barra.estado === 'Libre' ? (
                  <>
                    <div className="mesa-icon-container icon-libre">
                      <Beer size={30} />
                    </div>
                    <div className="mesa-capacity-info">
                      Capacidad: {barra.capacidad}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mesa-icon-container icon-reservada">
                      <User size={30} />
                    </div>
                    <div className="mesa-capacity-info">
                      Reserva / Capacidad: {barra.capacidad}
                    </div>
                  </>
                )}
              </div>

              {/* Divider */}
              <div className="mesa-card-divider"></div>

              {/* Card Footer: Details / Actions */}
              <div className="mesa-card-footer">
                {barra.estado === 'Ocupada' ? (
                  <div className="mesa-footer-occupied">
                    <div className="mesa-time-row">
                      <span className="time-label">{horaLlegada ? `Llegó: ${horaLlegada}` : 'Pedido activo'}</span>
                      {minutosTranscurridos && (
                        <span className="time-elapsed">{minutosTranscurridos} min</span>
                      )}
                    </div>
                    {canAccess('/pedidos') && (
                      <button
                        className="btn-ver-pedido"
                        onClick={e => {
                          e.stopPropagation();
                          if (pedidoActivo) navigate(tenantPath(`/pedidos/${pedidoActivo.id}`));
                        }}
                      >
                        Ver Pedido
                      </button>
                    )}
                  </div>
                ) : barra.estado === 'Libre' ? (
                  <div className="mesa-footer-free">
                    {canAccess('/barra') ? (
                      <button
                        className="btn-asignar-mesa"
                        onClick={e => {
                          e.stopPropagation();
                          openPedido(barra);
                        }}
                      >
                        + Asignar Barra
                      </button>
                    ) : (
                      <button
                        className="btn-asignar-mesa btn-asignar-mesa--disabled"
                        title="Necesitas el permiso /barra para abrir un pedido"
                        onClick={e => {
                          e.stopPropagation();
                          toast.error('No tienes acceso al módulo de Barra. Solicita al administrador que habilite el permiso /barra para tu rol.', { icon: '🔒', duration: 4000 });
                        }}
                      >
                        🔒 Asignar Barra
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
                    <button className="btn-action-icon" title="Editar Barra" onClick={() => openEdit(barra)}>
                      <Edit2 size={13} />
                    </button>
                    <button className="btn-action-icon btn-action-danger" title="Eliminar Barra" onClick={() => handleDelete(barra.id)}>
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
          title={modal === 'add' ? 'Nueva Barra' : 'Editar Barra'}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
          </>}
        >
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Número de Barra</label>
              <input
                className="form-input"
                type="number"
                min="1"
                value={form.numeroBarra}
                onChange={e => setForm(f => ({ ...f, numeroBarra: e.target.value }))}
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
          title={`Nuevo Pedido — Barra ${selected?.numeroBarra}`}
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
