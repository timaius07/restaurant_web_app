import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Eye, Search, Filter } from 'lucide-react';

const ESTADOS = ['Todos','Abierto','Preparando','Servido','Pagado','Cancelado'];
const BADGE = { Abierto:'badge-info', Preparando:'badge-warning', Servido:'badge-purple', Pagado:'badge-success', Cancelado:'badge-danger' };

export default function ListaPedidos() {
  const { pedidos, mesas, clientes, usuarios } = useApp();
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [busqueda, setBusqueda] = useState('');

  let lista = [...pedidos].sort((a,b) => new Date(b.fechaApertura) - new Date(a.fechaApertura));
  if (hasRole('Mesero')) lista = lista.filter(p => p.usuarioId === user.id);
  if (filtroEstado !== 'Todos') lista = lista.filter(p => p.estado === filtroEstado);
  if (busqueda) {
    lista = lista.filter(p => {
      const mesa = mesas.find(m => m.id === p.mesaId);
      const cli  = clientes.find(c => c.id === p.clienteId);
      return `Mesa ${mesa?.numeroMesa} ${cli?.nombre}`.toLowerCase().includes(busqueda.toLowerCase());
    });
  }

  return (
    <div className="page-container animate-fade">
      <div className="page-header-row">
        <div><h1>Pedidos</h1><p style={{color:'var(--text-secondary)',fontSize:'0.9rem',marginTop:4}}>{lista.length} resultado(s)</p></div>
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
          <div className="empty-state"><p>No hay pedidos que coincidan.</p></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>#</th><th>Mesa</th><th>Cliente</th><th>Estado</th><th>Apertura</th><th></th></tr></thead>
              <tbody>
                {lista.map(p => {
                  const mesa = mesas.find(m => m.id === p.mesaId);
                  const cli  = clientes.find(c => c.id === p.clienteId);
                  return (
                    <tr key={p.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontFamily: 'monospace' }}>{p.id.slice(0,8)}</td>
                      <td style={{ fontWeight: 600 }}>Mesa {mesa?.numeroMesa || '—'}</td>
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
