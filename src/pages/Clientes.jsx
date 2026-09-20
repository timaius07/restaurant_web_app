import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Edit2, Trash2, Search, Loader2 } from 'lucide-react';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';
import { confirmDialog } from '../utils/sweetAlert';
import { consultarClienteHacienda } from '../services/haciendaService';

const EMPTY = { nombre: '', identificacionFiscal: '', telefono: '', email: '' };

export default function Clientes() {
  const { clientes, addCliente, updateCliente, deleteCliente } = useApp();
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busqueda, setBusqueda] = useState('');
  const [loadingHacienda, setLoadingHacienda] = useState(false);
  const [haciendaInfo, setHaciendaInfo] = useState(null);

  const lista = clientes.filter(c =>
    `${c.nombre} ${c.identificacionFiscal} ${c.email}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  const openAdd = () => {
    setForm(EMPTY);
    setHaciendaInfo(null);
    setModal('add');
  };

  const openEdit = (c) => {
    setSelected(c);
    setForm({ nombre: c.nombre, identificacionFiscal: c.identificacionFiscal, telefono: c.telefono, email: c.email });
    setHaciendaInfo(null);
    setModal('edit');
  };

  const handleConsultarHacienda = async (idToSearch) => {
    const targetId = idToSearch !== undefined ? idToSearch : form.identificacionFiscal;
    const cleanId = String(targetId).replace(/\D/g, '').trim();

    if (!cleanId || cleanId.length < 9) {
      if (idToSearch === undefined) {
        toast.error('Ingresá al menos 9 dígitos de cédula');
      }
      return;
    }

    setLoadingHacienda(true);
    setHaciendaInfo(null);

    const res = await consultarClienteHacienda(cleanId);
    setLoadingHacienda(false);

    if (res && res.nombre) {
      setForm(p => ({ ...p, nombre: res.nombre }));
      setHaciendaInfo({ success: true });
    } else if (res && res.error) {
      setHaciendaInfo({ success: false, message: res.error });
      if (idToSearch === undefined) toast.error(res.error);
    } else {
      setHaciendaInfo({ success: false, message: 'No se encontró el contribuyente' });
      if (idToSearch === undefined) toast.error('No se encontró el contribuyente');
    }
  };

  const handleCedulaChange = (e) => {
    const val = e.target.value;
    setForm(p => ({ ...p, identificacionFiscal: val }));
    setHaciendaInfo(null);

    const clean = val.replace(/\D/g, '');
    if (clean.length === 9 || clean.length === 10 || clean.length === 12) {
      handleConsultarHacienda(val);
    }
  };

  const handleSave = () => {
    if (!form.nombre.trim()) return toast.error('El nombre es requerido');
    if (modal === 'add') {
      addCliente({ ...form });
      toast.success('Cliente creado');
    } else {
      updateCliente(selected.id, { ...form });
      toast.success('Cliente actualizado');
    }
    setModal(null);
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmDialog({
      title: '¿Eliminar este cliente?',
      text: 'Se eliminará el registro del cliente.',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmed) return;
    try {
      await deleteCliente(id);
      toast.success('Cliente eliminado');
    } catch (err) {
      console.error('Error al eliminar cliente:', err);
      toast.error(err.message || 'Error al eliminar cliente');
    }
  };

  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  return (
    <div className="page-container animate-fade">
      <div className="page-header-row">
        <div>
          <h1>Clientes</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
            {clientes.length} clientes registrados
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> Nuevo Cliente
        </button>
      </div>

      <div className="search-bar" style={{ marginBottom: 16 }}>
        <Search size={14} className="search-icon" />
        <input
          className="form-input"
          placeholder="Buscar por nombre, cédula o email..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Cédula/NIT</th>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(c => (
                <tr key={c.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.88rem', fontWeight: 700, color: 'var(--accent)' }}>
                    {c.identificacionFiscal || '—'}
                  </td>
                  <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                  <td>{c.telefono || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{c.email || '—'}</td>
                  <td>
                    <div className="td-actions">
                      <button className="btn btn-ghost btn-icon btn-sm" title="Editar" onClick={() => openEdit(c)}>
                        <Edit2 size={14} />
                      </button>
                      <button className="btn btn-danger btn-icon btn-sm" title="Eliminar" onClick={() => handleDelete(c.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal
          title={modal === 'add' ? 'Nuevo Cliente' : 'Editar Cliente'}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
          </>}
        >
          {/* 1. Cédula / Identificación Fiscal primero */}
          <div className="form-group">
            <label className="form-label">Cédula / NIT / DNI</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                value={form.identificacionFiscal}
                onChange={handleCedulaChange}
                onBlur={() => {
                  const clean = form.identificacionFiscal.replace(/\D/g, '');
                  if (clean.length >= 9 && !haciendaInfo?.success && !loadingHacienda) {
                    handleConsultarHacienda();
                  }
                }}
                placeholder="Ej: 3-101-195015 o 1-1234-5678"
                autoFocus
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleConsultarHacienda()}
                disabled={loadingHacienda}
                title="Consultar nombre en Hacienda"
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {loadingHacienda ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                <span>{loadingHacienda ? 'Buscando...' : 'Buscar'}</span>
              </button>
            </div>
            {haciendaInfo?.success === false && (
              <div style={{ fontSize: '0.78rem', color: '#ef4444', marginTop: 4 }}>
                {haciendaInfo.message}
              </div>
            )}
          </div>

          {/* 2. Nombre Completo */}
          <div className="form-group">
            <label className="form-label">Nombre completo *</label>
            <input
              className="form-input"
              value={form.nombre}
              onChange={f('nombre')}
              placeholder="Ej: Juan Pérez o Razón Social"
            />
          </div>

          {/* 3 y 4. Teléfono y Email */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input
                className="form-input"
                value={form.telefono}
                onChange={f('telefono')}
                placeholder="Ej: 8888-1234"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                value={form.email}
                onChange={f('email')}
                placeholder="correo@ejemplo.com"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
