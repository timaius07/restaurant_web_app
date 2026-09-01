import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Eye, Search, Calendar, X } from 'lucide-react';

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

export default function ListaPedidos() {
  const { pedidos, mesas, clientes } = useApp();
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();

  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [filtroFecha, setFiltroFecha] = useState(getTodayString());
  const [busqueda, setBusqueda] = useState('');

  let lista = [...pedidos].sort((a,b) => new Date(b.fechaApertura) - new Date(a.fechaApertura));
  if (hasRole('Mesero')) lista = lista.filter(p => p.usuarioId === user.id);
  if (filtroEstado !== 'Todos') lista = lista.filter(p => p.estado === filtroEstado);
  if (filtroFecha) lista = lista.filter(p => getLocalDateString(p.fechaApertura) === filtroFecha);
  if (busqueda) {
    lista = lista.filter(p => {
      const mesa = mesas.find(m => Number(m.id) === Number(p.mesaId));
      const cli  = clientes.find(c => Number(c.id) === Number(p.clienteId));
      const label = p.tipoPedido === 'Delivery' ? 'Delivery' : `Mesa ${mesa?.numeroMesa}`;
      return `${label} ${cli?.nombre}`.toLowerCase().includes(busqueda.toLowerCase());
    });
  }

  return (
    <div className="page-container animate-fade">
      <div className="page-header-row" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1>Pedidos</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
            {lista.length} resultado(s) {filtroFecha ? `para el ${filtroFecha}` : '(todas las fechas)'}
          </p>
        </div>

        {/* Date Filter Picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <Calendar size={15} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Fecha:</span>
            <input 
              type="date" 
              className="form-input" 
              style={{
                border: 'none',
                background: 'transparent',
                padding: '0 4px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                width: 'auto',
                cursor: 'pointer'
              }}
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
          <input className="form-input" placeholder="Buscar por mesa o cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
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
              <thead><tr><th>#</th><th>Mesa / Tipo</th><th>Cliente</th><th>Estado</th><th>Apertura</th><th>Ver</th></tr></thead>
              <tbody>
                {lista.map(p => {
                  const mesa = mesas.find(m => Number(m.id) === Number(p.mesaId));
                  const cli  = clientes.find(c => Number(c.id) === Number(p.clienteId));
                  return (
                    <tr key={p.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontFamily: 'monospace' }}>{p.id}</td>
                      <td style={{ fontWeight: 600 }}>{p.tipoPedido === 'Delivery' ? <span className="badge badge-purple" style={{padding: '2px 6px'}}>Delivery</span> : `Mesa ${mesa?.numeroMesa || '—'}`}</td>
                      <td>{cli?.nombre || '—'}</td>
                      <td><span className={`badge ${BADGE[p.estado]}`}>{p.estado}</span></td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        {new Date(p.fechaApertura).toLocaleString('es-CR')}
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => navigate(`/pedidos/${p.id}`)}>
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

