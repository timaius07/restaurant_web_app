import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/formatters';
import {
  UtensilsCrossed, ShoppingBag, Users, TrendingUp,
  CheckCircle, Clock, ChefHat, DollarSign
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
import './Dashboard.css';

export default function Dashboard() {
  const { mesas, pedidos, clientes, productos, facturas, settings } = useApp();
  const { user } = useAuth();

  const fmt = (v) => formatCurrency(v, settings.moneda, settings.tasaCambio);

  // KPIs
  const mesasLibres   = mesas.filter(m => m.estado === 'Libre').length;
  const mesasOcupadas = mesas.filter(m => m.estado === 'Ocupada').length;
  const pedidosHoy    = pedidos.filter(p => p.fechaApertura?.startsWith(new Date().toISOString().slice(0,10)));
  const pedidosActivos = pedidos.filter(p => ['Abierto','Preparando','Servido'].includes(p.estado));
  const ventasHoy = facturas
    .filter(f => f.fechaEmision?.startsWith(new Date().toISOString().slice(0,10)))
    .reduce((s, f) => s + f.total, 0);

  // Chart: ventas últimos 7 días
  const ventasPorDia = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const total = facturas.filter(f => f.fechaEmision?.startsWith(key)).reduce((s, f) => s + f.total, 0);
    return { dia: d.toLocaleDateString('es-CR', { weekday: 'short' }), ventas: total };
  });

  // Pedidos por estado
  const estadoData = [
    { name: 'Abierto',    value: pedidos.filter(p => p.estado === 'Abierto').length,    color: '#3b82f6' },
    { name: 'Preparando', value: pedidos.filter(p => p.estado === 'Preparando').length, color: '#f59e0b' },
    { name: 'Servido',    value: pedidos.filter(p => p.estado === 'Servido').length,    color: '#a855f7' },
    { name: 'Pagado',     value: pedidos.filter(p => p.estado === 'Pagado').length,     color: '#22c55e' },
    { name: 'Cancelado',  value: pedidos.filter(p => p.estado === 'Cancelado').length,  color: '#ef4444' },
  ].filter(d => d.value > 0);

  const kpis = [
    { label: 'Mesas Libres',    value: mesasLibres,           icon: UtensilsCrossed, color: 'var(--success)',  bg: 'var(--success-light)' },
    { label: 'Mesas Ocupadas',  value: mesasOcupadas,         icon: UtensilsCrossed, color: 'var(--danger)',   bg: 'var(--danger-light)'  },
    { label: 'Pedidos Activos', value: pedidosActivos.length, icon: ShoppingBag,     color: 'var(--warning)',  bg: 'var(--warning-light)' },
    { label: 'Ventas de Hoy',   value: fmt(ventasHoy),        icon: DollarSign,      color: 'var(--accent)',   bg: 'var(--accent-light)'  },
    { label: 'Total Clientes',  value: clientes.length,       icon: Users,           color: 'var(--info)',     bg: 'var(--info-light)'    },
    { label: 'Productos',       value: productos.filter(p=>p.activo).length, icon: ShoppingBag, color: 'var(--purple)', bg: 'var(--purple-light)' },
  ];

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <h1>¡Bienvenido, {user?.nombre}! 👋</h1>
        <p>Resumen del restaurante en tiempo real</p>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        {kpis.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="kpi-card">
            <div className="kpi-icon" style={{ background: bg }}>
              <Icon size={22} style={{ color }} />
            </div>
            <div>
              <div className="kpi-value" style={{ color }}>{value}</div>
              <div className="kpi-label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="dashboard-charts">
        {/* Ventas 7 días */}
        <div className="card chart-card">
          <div className="card-title">Ventas Últimos 7 Días</div>
          <div className="card-subtitle" style={{ marginBottom: 16 }}>Ingresos por día</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={ventasPorDia}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="dia" stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
              <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12 }} tickFormatter={v => v > 0 ? (v/1000).toFixed(0)+'K' : '0'} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--text-primary)' }}
                formatter={v => [fmt(v), 'Ventas']}
              />
              <Area type="monotone" dataKey="ventas" stroke="var(--accent)" fill="url(#salesGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Estados pedidos */}
        <div className="card chart-card">
          <div className="card-title">Pedidos por Estado</div>
          <div className="card-subtitle" style={{ marginBottom: 16 }}>Distribución actual</div>
          {estadoData.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <p>No hay pedidos registrados</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={estadoData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {estadoData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Pedidos activos table */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>Pedidos Activos</div>
        {pedidosActivos.length === 0 ? (
          <div className="empty-state"><CheckCircle size={32}/><p>No hay pedidos activos en este momento</p></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead><tr>
                <th>Mesa</th><th>Estado</th><th>Apertura</th>
              </tr></thead>
              <tbody>
                {pedidosActivos.map(p => {
                  const mesa = mesas.find(m => m.id === p.mesaId);
                  return (
                    <tr key={p.id}>
                      <td>{p.tipoPedido === 'Delivery' ? <span className="badge badge-purple">Delivery</span> : `Mesa ${mesa?.numeroMesa || '—'}`}</td>
                      <td><EstadoBadge estado={p.estado}/></td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        {new Date(p.fechaApertura).toLocaleTimeString('es-CR')}
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
