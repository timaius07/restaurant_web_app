import { useApp } from '../context/AppContext';
import { formatCurrency, formatDateOnly } from '../utils/formatters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

export default function Reportes() {
  const { facturas, pedidos, productos, detallePedidos, settings } = useApp();
  const fmt = (v) => formatCurrency(v, settings.moneda, settings.tasaCambio);

  // Ventas últimos 30 días
  const ventasMes = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i));
    const key = d.toISOString().slice(0, 10);
    const total = facturas.filter(f => f.fechaEmision?.startsWith(key)).reduce((s, f) => s + f.total, 0);
    return { fecha: d.toLocaleDateString('es-CR', { day:'2-digit', month:'2-digit' }), ventas: total };
  });

  // Productos más vendidos
  const prodVentas = {};
  detallePedidos.forEach(d => {
    prodVentas[d.productoId] = (prodVentas[d.productoId] || 0) + d.cantidad;
  });
  const topProductos = Object.entries(prodVentas)
    .map(([id, cantidad]) => ({ nombre: productos.find(p => p.id === id)?.nombre || id, cantidad }))
    .sort((a,b) => b.cantidad - a.cantidad)
    .slice(0, 8);

  const totalVentas = facturas.reduce((s,f) => s + f.total, 0);
  const totalImpuestos = facturas.reduce((s,f) => s + f.impuestos, 0);
  const ticketPromedio = facturas.length ? totalVentas / facturas.length : 0;

  return (
    <div className="page-container animate-fade">
      <div className="page-header"><h1>Reportes</h1><p>Análisis de ventas y rendimiento</p></div>

      <div className="kpi-grid">
        {[
          { label:'Ventas Totales',    value: fmt(totalVentas),       color:'var(--accent)' },
          { label:'Total IVA Cobrado', value: fmt(totalImpuestos),    color:'var(--warning)' },
          { label:'Ticket Promedio',   value: fmt(ticketPromedio),    color:'var(--info)' },
          { label:'Facturas Emitidas', value: facturas.length,        color:'var(--success)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ textAlign:'center' }}>
            <div style={{ fontSize:'1.5rem',fontWeight:800,color }}>{value}</div>
            <div style={{ fontSize:'0.8rem',color:'var(--text-secondary)',marginTop:4 }}>{label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-title" style={{ marginBottom:16 }}>Ventas Últimos 30 Días</div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={ventasMes}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="fecha" stroke="var(--text-muted)" tick={{ fontSize:10 }} interval={4} />
            <YAxis stroke="var(--text-muted)" tick={{ fontSize:11 }} tickFormatter={v => v > 0 ? (v/1000).toFixed(0)+'K' : '0'} />
            <Tooltip contentStyle={{ background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:8 }}
              formatter={v => [fmt(v),'Ventas']} />
            <Line type="monotone" dataKey="ventas" stroke="var(--accent)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom:16 }}>Productos Más Vendidos (Cantidad)</div>
        {topProductos.length === 0 ? (
          <div className="empty-state"><p>No hay datos de ventas aún.</p></div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topProductos} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" stroke="var(--text-muted)" tick={{ fontSize:11 }} />
              <YAxis type="category" dataKey="nombre" stroke="var(--text-muted)" tick={{ fontSize:11 }} width={120} />
              <Tooltip contentStyle={{ background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:8 }} />
              <Bar dataKey="cantidad" fill="var(--accent)" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
