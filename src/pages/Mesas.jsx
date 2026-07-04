import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, Users } from 'lucide-react';
import Modal from '../components/ui/Modal';
import SearchableSelect from '../components/ui/SearchableSelect';
import toast from 'react-hot-toast';
import { v4 as uuid } from '../data/uuid';
import './Mesas.css';

const ESTADOS = ['Libre', 'Ocupada', 'Reservada'];
const ESTADO_CONFIG = {
  Libre:     { badge: 'badge-success', dot: 'dot-green',  label: 'Libre' },
  Ocupada:   { badge: 'badge-danger',  dot: 'dot-red',    label: 'Ocupada' },
  Reservada: { badge: 'badge-warning', dot: 'dot-yellow', label: 'Reservada' },
};

export default function Mesas() {
  const { mesas, addMesa, updateMesa, deleteMesa, crearPedido, pedidos, clientes, addCliente } = useApp();
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();

  const [modal, setModal] = useState(null); // 'add' | 'edit' | 'pedido'
  const [selected, setSelected] = useState(null);
  const [form, setForm]   = useState({ numeroMesa: '', capacidad: 2, estado: 'Libre' });
  const [pedidoForm, setPedidoForm] = useState({ clienteId: '1' });

  const openAdd  = () => { setForm({ numeroMesa: '', capacidad: 2, estado: 'Libre' }); setModal('add'); };
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
    if (!confirm('¿Eliminar esta mesa?')) return;
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

  return (
    <div className="page-container animate-fade">
      <div className="page-header-row">
        <div>
          <h1>Mesas</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
            {mesas.filter(m=>m.estado==='Libre').length} libres · {mesas.filter(m=>m.estado==='Ocupada').length} ocupadas · {mesas.filter(m=>m.estado==='Reservada').length} reservadas
          </p>
        </div>
        {hasRole('Admin') && (
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Nueva Mesa</button>
        )}
      </div>

      <div className="mesas-grid">
        {sorted.map(mesa => {
          const cfg = ESTADO_CONFIG[mesa.estado];
          const pedidoActivo = pedidos.find(p => p.mesaId === mesa.id && ['Abierto','Preparando','Servido'].includes(p.estado));
          return (
            <div key={mesa.id} className={`mesa-card estado-${mesa.estado.toLowerCase()}`} onClick={() => mesa.estado === 'Libre' && hasRole('Admin','Mesero') && openPedido(mesa)}>
              <div className="mesa-number">Mesa {mesa.numeroMesa}</div>
              <div className="mesa-capacity"><Users size={13}/> {mesa.capacidad} personas</div>
              <div className={`badge ${cfg.badge}`} style={{ marginTop: 8 }}>
                <span className={`status-dot ${cfg.dot}`}></span> {cfg.label}
              </div>
              {pedidoActivo && <div className="mesa-pedido-label">Pedido activo</div>}
              {mesa.estado === 'Ocupada' && hasRole('Admin','Mesero') && (
                <button className="btn btn-sm btn-secondary" style={{ marginTop: 10, width: '100%' }}
                  onClick={e => { e.stopPropagation(); navigate(`/pedidos/${pedidoActivo?.id}`); }}>
                  Ver Pedido
                </button>
              )}
              {hasRole('Admin') && (
                <div className="mesa-actions" onClick={e => e.stopPropagation()}>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(mesa)}><Edit2 size={14}/></button>
                  <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(mesa.id)}><Trash2 size={14}/></button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal add/edit */}
      {(modal === 'add' || modal === 'edit') && (
        <Modal title={modal === 'add' ? 'Nueva Mesa' : 'Editar Mesa'} onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
          </>}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Número de Mesa</label>
              <input className="form-input" type="number" min="1" value={form.numeroMesa} onChange={e => setForm(f=>({...f, numeroMesa: e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Capacidad</label>
              <input className="form-input" type="number" min="1" max="20" value={form.capacidad} onChange={e => setForm(f=>({...f, capacidad: e.target.value}))} />
            </div>
          </div>
          {modal === 'edit' && (
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select className="form-input form-select" value={form.estado} onChange={e => setForm(f=>({...f, estado: e.target.value}))}>
                {ESTADOS.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
          )}
        </Modal>
      )}

      {/* Modal nuevo pedido */}
      {modal === 'pedido' && (
        <Modal title={`Nuevo Pedido — Mesa ${selected?.numeroMesa}`} onClose={() => setModal(null)} size="md"
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleCrearPedido}>Abrir Pedido</button>
          </>}>
          <div className="form-group">
            <label className="form-label">Cliente</label>
            <SearchableSelect 
              options={clientes.map(c => ({ value: c.id, label: c.nombre }))}
              value={pedidoForm.clienteId}
              onChange={val => setPedidoForm(f=>({...f, clienteId: val}))}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
