import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDateOnly } from '../utils/formatters';
import { exportElementToPDF } from '../utils/pdfExport';
import DatePicker from '../components/ui/DatePicker';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell 
} from 'recharts';
import { 
  FileText, Download, Calendar, UserCheck, CreditCard, DollarSign, TrendingUp, ShoppingBag, Receipt, Printer, Award, ArrowUpRight 
} from 'lucide-react';
import './Reportes.css';

const COLORS = ['#ff6b00', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#64748b'];

const getLocalDateStr = (dateObj) => {
  if (!dateObj) return '';
  const d = new Date(dateObj);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayStr = () => getLocalDateStr(new Date());

const formatDateDMY = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return formatDateOnly(dateStr);
};

const getCurrentYearMonthStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export default function Reportes() {
  const { facturas = [], pedidos = [], usuarios = [], metodosPago = [], productos = [], detallePedidos = [], settings } = useApp();
  const fmt = (v) => formatCurrency(v, settings.moneda, settings.tasaCambio);

  // Tab State: 'cierre_caja' | 'cajero' | 'ventas_mensuales' | 'general'
  const [activeTab, setActiveTab] = useState('cierre_caja');

  // Filter States
  const [cierreFecha, setCierreFecha] = useState(getTodayStr());
  
  const [cajeroFechaInicio, setCajeroFechaInicio] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return getLocalDateStr(d);
  });
  const [cajeroFechaFin, setCajeroFechaFin] = useState(getTodayStr());

  const [mensualYearMonth, setMensualYearMonth] = useState(getCurrentYearMonthStr());

  // ---------------------------------------------------------------------------
  // 1. REPORTE CIERRE DE CAJA (DIARIO)
  // ---------------------------------------------------------------------------
  const dataCierreCaja = useMemo(() => {
    const facturasDia = facturas.filter(f => getLocalDateStr(f.fechaEmision) === cierreFecha);
    const pedidosDia = pedidos.filter(p => getLocalDateStr(p.fechaApertura) === cierreFecha);

    const totalVentas = facturasDia.reduce((s, f) => s + (Number(f.total) || 0), 0);
    const totalImpuestos = facturasDia.reduce((s, f) => s + (Number(f.impuestos) || 0), 0);
    const totalSubtotal = facturasDia.reduce((s, f) => s + (Number(f.subtotal) || (Number(f.total) / 1.13) || 0), 0);
    
    // Desglose por método de pago
    const porMetodoPago = metodosPago.map(mp => {
      const facturasMP = facturasDia.filter(f => Number(f.metodoPagoId) === Number(mp.id));
      const totalMP = facturasMP.reduce((s, f) => s + (Number(f.total) || 0), 0);
      return {
        id: mp.id,
        nombre: mp.nombre,
        total: totalMP,
        cantidad: facturasMP.length
      };
    });

    // Métricas operativas de pedidos
    const pedidosLocales = pedidosDia.filter(p => p.tipoPedido === 'Local').length;
    const pedidosDelivery = pedidosDia.filter(p => p.tipoPedido === 'Delivery').length;
    const pedidosCancelados = pedidosDia.filter(p => p.estado === 'Cancelado');
    const totalCancelado = pedidosCancelados.reduce((s, p) => {
      const dets = detallePedidos.filter(d => Number(d.pedidoId) === Number(p.id));
      return s + dets.reduce((sum, d) => sum + (d.precioMomento * d.cantidad), 0);
    }, 0);

    // Rango de consecutivos
    const facturasNums = facturasDia
      .map(f => f.numeroFactura)
      .filter(Boolean)
      .sort();
    const rangoConsecutivos = facturasNums.length > 0
      ? `${facturasNums[0]} — ${facturasNums[facturasNums.length - 1]}`
      : 'Sin facturas emitidas';

    return {
      facturasDia,
      pedidosDia,
      totalVentas,
      totalSubtotal,
      totalImpuestos,
      porMetodoPago,
      pedidosLocales,
      pedidosDelivery,
      cantCancelados: pedidosCancelados.length,
      totalCancelado,
      ticketPromedio: facturasDia.length ? Math.round(totalVentas / facturasDia.length) : 0,
      rangoConsecutivos
    };
  }, [facturas, pedidos, metodosPago, cierreFecha, detallePedidos]);

  // ---------------------------------------------------------------------------
  // 2. REPORTE VENTAS POR CAJERO / USUARIO
  // ---------------------------------------------------------------------------
  const dataVentasCajero = useMemo(() => {
    const facturasRango = facturas.filter(f => {
      const fStr = getLocalDateStr(f.fechaEmision);
      return fStr >= cajeroFechaInicio && fStr <= cajeroFechaFin;
    });

    const totalVentasRango = facturasRango.reduce((s, f) => s + (Number(f.total) || 0), 0);

    // Mapear por usuario
    const resumenUsuarios = usuarios.map(u => {
      // Pedidos creados por este usuario en el rango
      const peds = pedidos.filter(p => {
        const pStr = getLocalDateStr(p.fechaApertura);
        return Number(p.usuarioId) === Number(u.id) && pStr >= cajeroFechaInicio && pStr <= cajeroFechaFin;
      });
      const pedsIds = peds.map(p => p.id);

      // Facturas asociadas a esos pedidos
      const facts = facturasRango.filter(f => pedsIds.includes(Number(f.pedidoId)));
      const totalVendido = facts.reduce((s, f) => s + (Number(f.total) || 0), 0);

      // Desglose métodos de pago por cajero
      const ventasEfectivo = facts
        .filter(f => {
          const mp = metodosPago.find(m => Number(m.id) === Number(f.metodoPagoId));
          return mp?.nombre?.toLowerCase().includes('efectivo');
        })
        .reduce((s, f) => s + (Number(f.total) || 0), 0);

      const ventasTarjeta = facts
        .filter(f => {
          const mp = metodosPago.find(m => Number(m.id) === Number(f.metodoPagoId));
          return mp?.nombre?.toLowerCase().includes('tarjeta');
        })
        .reduce((s, f) => s + (Number(f.total) || 0), 0);

      const ventasSinpe = facts
        .filter(f => {
          const mp = metodosPago.find(m => Number(m.id) === Number(f.metodoPagoId));
          return mp?.nombre?.toLowerCase().includes('sinpe');
        })
        .reduce((s, f) => s + (Number(f.total) || 0), 0);

      const porcentaje = totalVentasRango > 0 ? ((totalVendido / totalVentasRango) * 100).toFixed(1) : '0.0';

      return {
        id: u.id,
        nombre: u.nombre,
        usuario: u.usuario,
        rol: u.rol,
        cantPedidos: peds.length,
        cantFacturas: facts.length,
        totalVendido,
        ventasEfectivo,
        ventasTarjeta,
        ventasSinpe,
        porcentaje: Number(porcentaje),
        ticketPromedio: facts.length ? Math.round(totalVendido / facts.length) : 0
      };
    }).sort((a, b) => b.totalVendido - a.totalVendido);

    const cajeroEstrella = resumenUsuarios.length > 0 ? resumenUsuarios[0] : null;

    return {
      facturasRango,
      totalVentasRango,
      resumenUsuarios,
      cajeroEstrella
    };
  }, [facturas, pedidos, usuarios, metodosPago, cajeroFechaInicio, cajeroFechaFin]);

  // ---------------------------------------------------------------------------
  // 3. REPORTE VENTAS MENSUALES
  // ---------------------------------------------------------------------------
  const dataVentasMensuales = useMemo(() => {
    const [yearStr, monthStr] = mensualYearMonth.split('-');
    const year = Number(yearStr) || new Date().getFullYear();
    const monthIndex = (Number(monthStr) || (new Date().getMonth() + 1)) - 1;

    const facturasMes = facturas.filter(f => {
      const d = new Date(f.fechaEmision);
      return d.getFullYear() === year && d.getMonth() === monthIndex;
    });

    const totalVentasMes = facturasMes.reduce((s, f) => s + (Number(f.total) || 0), 0);
    const totalIVAMes = facturasMes.reduce((s, f) => s + (Number(f.impuestos) || 0), 0);
    const totalSubtotalMes = facturasMes.reduce((s, f) => s + (Number(f.subtotal) || (Number(f.total) / 1.13) || 0), 0);

    // Días del mes (1 al último día)
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const desgloseDias = Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const dayStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      
      const factsDia = facturasMes.filter(f => getLocalDateStr(f.fechaEmision) === dayStr);
      const totalDia = factsDia.reduce((s, f) => s + (Number(f.total) || 0), 0);
      const ivaDia = factsDia.reduce((s, f) => s + (Number(f.impuestos) || 0), 0);
      
      return {
        dia: dayNum,
        fechaStr: dayStr,
        diaLabel: `Día ${dayNum}`,
        total: totalDia,
        iva: ivaDia,
        cantFacturas: factsDia.length
      };
    });

    // Día de mayor venta
    const diaTop = [...desgloseDias].sort((a, b) => b.total - a.total)[0];

    // Promedio diario (basado en días transcurridos o total días con ventas)
    const diasConVentas = desgloseDias.filter(d => d.total > 0).length || 1;
    const promedioDiario = Math.round(totalVentasMes / diasConVentas);

    // Top productos del mes
    const pedidosMesIds = pedidos
      .filter(p => {
        const d = new Date(p.fechaApertura);
        return d.getFullYear() === year && d.getMonth() === monthIndex;
      })
      .map(p => p.id);

    const detallesMes = detallePedidos.filter(d => pedidosMesIds.includes(Number(d.pedidoId)));
    const prodCount = {};
    const prodMonto = {};
    detallesMes.forEach(d => {
      prodCount[d.productoId] = (prodCount[d.productoId] || 0) + d.cantidad;
      prodMonto[d.productoId] = (prodMonto[d.productoId] || 0) + (d.cantidad * d.precioMomento);
    });

    const topProductosMes = Object.entries(prodCount)
      .map(([id, cant]) => ({
        id,
        nombre: productos.find(p => p.id === Number(id))?.nombre || `Producto ${id}`,
        cantidad: cant,
        montoTotal: prodMonto[id] || 0
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    // Desglose por método de pago en el mes
    const metodosMes = metodosPago.map(mp => {
      const factsMP = facturasMes.filter(f => Number(f.metodoPagoId) === Number(mp.id));
      const totalMP = factsMP.reduce((s, f) => s + (Number(f.total) || 0), 0);
      return {
        name: mp.nombre,
        value: totalMP
      };
    }).filter(m => m.value > 0);

    return {
      facturasMes,
      totalVentasMes,
      totalSubtotalMes,
      totalIVAMes,
      desgloseDias,
      diaTop,
      promedioDiario,
      topProductosMes,
      metodosMes,
      nombreMes: new Date(year, monthIndex, 1).toLocaleString('es-CR', { month: 'long', year: 'numeric' })
    };
  }, [facturas, pedidos, detallePedidos, productos, metodosPago, mensualYearMonth]);

  // Handler para exportar a PDF el reporte activo
  const handleExportPDF = () => {
    let filename = 'Reporte.pdf';
    if (activeTab === 'cierre_caja') filename = `Cierre_de_Caja_${cierreFecha}.pdf`;
    else if (activeTab === 'cajero') filename = `Ventas_por_Cajero_${cajeroFechaInicio}_al_${cajeroFechaFin}.pdf`;
    else if (activeTab === 'ventas_mensuales') filename = `Ventas_Mensuales_${mensualYearMonth}.pdf`;
    else filename = `Reporte_General_${getTodayStr()}.pdf`;

    exportElementToPDF('printable-report-area', filename);
  };

  return (
    <div className="page-container animate-fade">
      {/* Header & Export Action */}
      <div className="page-header-row" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>Módulo de Reportes</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 4 }}>
            Generación de cierres de caja, análisis por cajero y tendencias mensuales
          </p>
        </div>

        <button className="btn btn-primary" onClick={handleExportPDF}>
          <Download size={16} /> Exportar Reporte a PDF
        </button>
      </div>

      {/* Selector de pestañas de reportes */}
      <div className="reportes-tabs">
        <button 
          className={`report-tab-btn ${activeTab === 'cierre_caja' ? 'active' : ''}`}
          onClick={() => setActiveTab('cierre_caja')}
        >
          <Receipt size={16} /> Cierre Diario (Caja)
        </button>

        <button 
          className={`report-tab-btn ${activeTab === 'cajero' ? 'active' : ''}`}
          onClick={() => setActiveTab('cajero')}
        >
          <UserCheck size={16} /> Ventas por Cajero
        </button>

        <button 
          className={`report-tab-btn ${activeTab === 'ventas_mensuales' ? 'active' : ''}`}
          onClick={() => setActiveTab('ventas_mensuales')}
        >
          <TrendingUp size={16} /> Ventas Mensuales
        </button>

        <button 
          className={`report-tab-btn ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          <Award size={16} /> Dashboard General
        </button>
      </div>

      {/* ----------------------------------------------------------------------- */}
      {/* PESTAÑA 1: CIERRE DIARIO / CIERRE DE CAJA                                */}
      {/* ----------------------------------------------------------------------- */}
      {activeTab === 'cierre_caja' && (
        <div>
          <div className="report-filter-bar">
            <div className="filter-inputs">
              <div className="filter-item">
                <label><Calendar size={14} /> Fecha del Cierre:</label>
                <DatePicker 
                  value={cierreFecha} 
                  onChange={e => setCierreFecha(e.target.value)} 
                />
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Facturas encontradas: <strong>{dataCierreCaja.facturasDia.length}</strong>
            </div>
          </div>

          <div id="printable-report-area" className="pdf-printable-area animate-fade">
            {/* Header Oficial del Reporte */}
            <div className="pdf-header-banner">
              <div className="pdf-company-brand">
                <span className="company-name">{settings.nombreRestaurante || 'Soda La Tica'}</span>
                <span className="company-sub">Comprobante Oficial de Cierre de Caja</span>
                <span className="company-sub">Cédula Jurídica: 3-101-789456 • Costa Rica</span>
              </div>
              <div className="pdf-report-meta">
                <div className="pdf-report-title">REPORTE DE CIERRE DIARIO</div>
                <div><strong>Fecha Cierre:</strong> {formatDateDMY(cierreFecha)}</div>
                <div><strong>Consecutivos:</strong> {dataCierreCaja.rangoConsecutivos}</div>
                <div><strong>Impreso:</strong> {new Date().toLocaleString('es-CR')}</div>
              </div>
            </div>

            {/* Tarjetas resumen del cierre */}
            <div className="report-summary-cards">
              <div className="report-summary-card">
                <span className="summary-card-title">Ventas Netas (Total)</span>
                <span className="summary-card-value" style={{ color: 'var(--accent)' }}>
                  {fmt(dataCierreCaja.totalVentas)}
                </span>
                <span className="summary-card-sub">{dataCierreCaja.facturasDia.length} facturas liquidadas</span>
              </div>

              <div className="report-summary-card">
                <span className="summary-card-title">Subtotal Sin IVA</span>
                <span className="summary-card-value">{fmt(dataCierreCaja.totalSubtotal)}</span>
                <span className="summary-card-sub">Base imponible</span>
              </div>

              <div className="report-summary-card">
                <span className="summary-card-title">Total 13% IVA</span>
                <span className="summary-card-value" style={{ color: 'var(--warning)' }}>
                  {fmt(dataCierreCaja.totalImpuestos)}
                </span>
                <span className="summary-card-sub">Impuesto recaudado</span>
              </div>

              <div className="report-summary-card">
                <span className="summary-card-title">Ticket Promedio</span>
                <span className="summary-card-value" style={{ color: 'var(--info)' }}>
                  {fmt(dataCierreCaja.ticketPromedio)}
                </span>
                <span className="summary-card-sub">Por transacción</span>
              </div>
            </div>

            {/* Desglose por Método de Pago & Métricas Operativas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
              {/* Métodos de pago */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, background: 'var(--bg-primary)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  💳 Arqueo por Método de Pago
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dataCierreCaja.porMetodoPago.map(mp => (
                    <div key={mp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px border-dashed var(--border)' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{mp.nombre}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 6 }}>({mp.cantidad} transacc.)</span>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: mp.total > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {fmt(mp.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resumen operativo de pedidos */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, background: 'var(--bg-primary)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  📊 Resumen de Operación y Pedidos
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Pedidos Atendidos en Local (Mesas):</span>
                    <strong>{dataCierreCaja.pedidosLocales}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Pedidos Atendidos en Delivery:</span>
                    <strong>{dataCierreCaja.pedidosDelivery}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: 'var(--danger)' }}>
                    <span>Pedidos Cancelados:</span>
                    <strong>{dataCierreCaja.cantCancelados} ({fmt(dataCierreCaja.totalCancelado)})</strong>
                  </div>
                </div>
              </div>
            </div>



            {/* Firma o Aprobación para Cierre de Caja */}
            <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-around', paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <div style={{ textAlign: 'center', width: 200 }}>
                <div style={{ borderBottom: '1px solid #999', marginBottom: 6, height: 30 }}></div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Firma del Cajero Responsable</span>
              </div>
              <div style={{ textAlign: 'center', width: 200 }}>
                <div style={{ borderBottom: '1px solid #999', marginBottom: 6, height: 30 }}></div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Firma Administración / Auditoría</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* PESTAÑA 2: VENTAS POR CAJERO / USUARIO                                  */}
      {/* ----------------------------------------------------------------------- */}
      {activeTab === 'cajero' && (
        <div>
          <div className="report-filter-bar">
            <div className="filter-inputs">
              <div className="filter-item">
                <label>Desde:</label>
                <DatePicker 
                  value={cajeroFechaInicio} 
                  onChange={e => setCajeroFechaInicio(e.target.value)} 
                />
              </div>
              <div className="filter-item">
                <label>Hasta:</label>
                <DatePicker 
                  value={cajeroFechaFin} 
                  onChange={e => setCajeroFechaFin(e.target.value)} 
                />
              </div>
            </div>

            {dataVentasCajero.cajeroEstrella && (
              <div style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 600 }}>
                🏆 Mayor Volumen: {dataVentasCajero.cajeroEstrella.nombre} ({fmt(dataVentasCajero.cajeroEstrella.totalVendido)})
              </div>
            )}
          </div>

          <div id="printable-report-area" className="pdf-printable-area animate-fade">
            <div className="pdf-header-banner">
              <div className="pdf-company-brand">
                <span className="company-name">{settings.nombreRestaurante || 'Soda La Tica'}</span>
                <span className="company-sub">Reporte de Desempeño y Ventas por Cajero</span>
              </div>
              <div className="pdf-report-meta">
                <div className="pdf-report-title">VENTAS POR CAJERO</div>
                <div><strong>Período:</strong> {formatDateDMY(cajeroFechaInicio)} al {formatDateDMY(cajeroFechaFin)}</div>
                <div><strong>Impreso:</strong> {new Date().toLocaleString('es-CR')}</div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="report-summary-cards">
              <div className="report-summary-card">
                <span className="summary-card-title">Ventas Totales Analizadas</span>
                <span className="summary-card-value" style={{ color: 'var(--accent)' }}>
                  {fmt(dataVentasCajero.totalVentasRango)}
                </span>
                <span className="summary-card-sub">{dataVentasCajero.facturasRango.length} facturas registradas</span>
              </div>

              <div className="report-summary-card">
                <span className="summary-card-title">Cajeros / Usuarios</span>
                <span className="summary-card-value">{dataVentasCajero.resumenUsuarios.length}</span>
                <span className="summary-card-sub">Con actividad en el sistema</span>
              </div>

              <div className="report-summary-card">
                <span className="summary-card-title">Cajero Líder</span>
                <span className="summary-card-value" style={{ color: 'var(--success)', fontSize: '1.1rem' }}>
                  {dataVentasCajero.cajeroEstrella ? dataVentasCajero.cajeroEstrella.nombre : '—'}
                </span>
                <span className="summary-card-sub">
                  {dataVentasCajero.cajeroEstrella ? `${dataVentasCajero.cajeroEstrella.porcentaje}% del total` : 'Sin datos'}
                </span>
              </div>
            </div>

            {/* Gráfico comparativo de Cajeros */}
            <div style={{ marginBottom: 24 }} className="no-print">
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                📊 Comparativa de Ventas por Cajero
              </h4>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dataVentasCajero.resumenUsuarios}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="nombre" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} tickFormatter={v => (v/1000).toFixed(0)+'K'} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} formatter={v => [fmt(v), 'Total Vendido']} />
                  <Bar dataKey="totalVendido" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tabla Detallada por Cajero */}
            <h4 style={{ margin: '16px 0 10px 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              👥 Tabla de Ventas y Arqueo por Cajero
            </h4>

            <div className="report-table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Cajero / Usuario</th>
                    <th>Facturas</th>
                    <th>Efectivo</th>
                    <th>Tarjeta</th>
                    <th>SINPE</th>
                    <th>Ticket Prom.</th>
                    <th>Total Vendido</th>
                    <th>% Part.</th>
                  </tr>
                </thead>
                <tbody>
                  {dataVentasCajero.resumenUsuarios.map(u => (
                    <tr key={u.id}>
                      <td><strong>{u.nombre}</strong> <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({u.usuario})</span></td>
                      <td>{u.cantFacturas}</td>
                      <td>{fmt(u.ventasEfectivo)}</td>
                      <td>{fmt(u.ventasTarjeta)}</td>
                      <td>{fmt(u.ventasSinpe)}</td>
                      <td>{fmt(u.ticketPromedio)}</td>
                      <td><strong>{fmt(u.totalVendido)}</strong></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 36, height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                            <div style={{ width: `${u.porcentaje}%`, height: '100%', background: 'var(--accent)' }}></div>
                          </div>
                          <span>{u.porcentaje}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td>TOTALES GENERALES</td>
                    <td>{dataVentasCajero.facturasRango.length}</td>
                    <td>{fmt(dataVentasCajero.resumenUsuarios.reduce((s, u) => s + u.ventasEfectivo, 0))}</td>
                    <td>{fmt(dataVentasCajero.resumenUsuarios.reduce((s, u) => s + u.ventasTarjeta, 0))}</td>
                    <td>{fmt(dataVentasCajero.resumenUsuarios.reduce((s, u) => s + u.ventasSinpe, 0))}</td>
                    <td>—</td>
                    <td>{fmt(dataVentasCajero.totalVentasRango)}</td>
                    <td>100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* PESTAÑA 3: VENTAS MENSUALES                                             */}
      {/* ----------------------------------------------------------------------- */}
      {activeTab === 'ventas_mensuales' && (
        <div>
          <div className="report-filter-bar">
            <div className="filter-inputs">
              <div className="filter-item">
                <label>Seleccionar Mes:</label>
                <input 
                  type="month" 
                  value={mensualYearMonth} 
                  onChange={e => setMensualYearMonth(e.target.value)} 
                />
              </div>
            </div>

            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent)' }}>
              Período: {dataVentasMensuales.nombreMes}
            </div>
          </div>

          <div id="printable-report-area" className="pdf-printable-area animate-fade">
            <div className="pdf-header-banner">
              <div className="pdf-company-brand">
                <span className="company-name">{settings.nombreRestaurante || 'Soda La Tica'}</span>
                <span className="company-sub">Reporte Consolidado de Ventas Mensuales</span>
              </div>
              <div className="pdf-report-meta">
                <div className="pdf-report-title">VENTAS MENSUALES</div>
                <div style={{ textTransform: 'capitalize' }}><strong>Mes:</strong> {dataVentasMensuales.nombreMes}</div>
                <div><strong>Impreso:</strong> {new Date().toLocaleString('es-CR')}</div>
              </div>
            </div>

            {/* KPI Cards Mensuales */}
            <div className="report-summary-cards">
              <div className="report-summary-card">
                <span className="summary-card-title">Ventas Totales del Mes</span>
                <span className="summary-card-value" style={{ color: 'var(--accent)' }}>
                  {fmt(dataVentasMensuales.totalVentasMes)}
                </span>
                <span className="summary-card-sub">{dataVentasMensuales.facturasMes.length} facturas en el mes</span>
              </div>

              <div className="report-summary-card">
                <span className="summary-card-title">Total IVA Recaudado (13%)</span>
                <span className="summary-card-value" style={{ color: 'var(--warning)' }}>
                  {fmt(dataVentasMensuales.totalIVAMes)}
                </span>
                <span className="summary-card-sub">Débito fiscal acumulado</span>
              </div>

              <div className="report-summary-card">
                <span className="summary-card-title">Promedio Diario</span>
                <span className="summary-card-value" style={{ color: 'var(--info)' }}>
                  {fmt(dataVentasMensuales.promedioDiario)}
                </span>
                <span className="summary-card-sub">Venta promedio por día</span>
              </div>

              <div className="report-summary-card">
                <span className="summary-card-title">Día de Mayor Venta</span>
                <span className="summary-card-value" style={{ color: 'var(--success)', fontSize: '1.15rem' }}>
                  {dataVentasMensuales.diaTop ? `Día ${dataVentasMensuales.diaTop.dia}` : '—'}
                </span>
                <span className="summary-card-sub">
                  {dataVentasMensuales.diaTop ? fmt(dataVentasMensuales.diaTop.total) : 'Sin ventas'}
                </span>
              </div>
            </div>

            {/* Gráfico de Tendencia Diaria del Mes */}
            <div style={{ marginBottom: 24 }} className="no-print">
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                📈 Evolución Diaria de Ventas durante el Mes
              </h4>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dataVentasMensuales.desgloseDias}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="dia" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} tickFormatter={v => (v/1000).toFixed(0)+'K'} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} formatter={v => [fmt(v), 'Total Ventas']} />
                  <Line type="monotone" dataKey="total" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 5 Productos Más Vendidos del Mes */}
            {dataVentasMensuales.topProductosMes.length > 0 && (
              <div style={{ marginBottom: 24, padding: 16, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-primary)' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  🥇 Top 5 Productos Más Vendidos del Mes
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  {dataVentasMensuales.topProductosMes.map((p, idx) => (
                    <div key={p.id} style={{ padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 700 }}>#{idx + 1} POPULAR</div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: 2 }}>{p.nombre}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        {p.cantidad} unidades • <strong>{fmt(p.montoTotal)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabla Detallada Día por Día */}
            <h4 style={{ margin: '16px 0 10px 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              📅 Tabla Resumen Día por Día ({dataVentasMensuales.desgloseDias.length} días)
            </h4>

            <table className="report-table">
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Fecha</th>
                  <th>Facturas Emitidas</th>
                  <th>Subtotal Sin IVA</th>
                  <th>IVA 13%</th>
                  <th>Total Facturado</th>
                </tr>
              </thead>
              <tbody>
                {dataVentasMensuales.desgloseDias.map(d => (
                  <tr key={d.dia}>
                    <td><strong>Día {d.dia}</strong></td>
                    <td>{formatDateDMY(d.fechaStr)}</td>
                    <td>{d.cantFacturas}</td>
                    <td>{fmt(d.total - d.iva)}</td>
                    <td>{fmt(d.iva)}</td>
                    <td><strong>{fmt(d.total)}</strong></td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td colSpan="2">TOTAL MENSUAL</td>
                  <td>{dataVentasMensuales.facturasMes.length}</td>
                  <td>{fmt(dataVentasMensuales.totalSubtotalMes)}</td>
                  <td>{fmt(dataVentasMensuales.totalIVAMes)}</td>
                  <td>{fmt(dataVentasMensuales.totalVentasMes)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* PESTAÑA 4: DASHBOARD GENERAL                                             */}
      {/* ----------------------------------------------------------------------- */}
      {activeTab === 'general' && (() => {
        const totalVentasGeneral = facturas.reduce((s, f) => s + (Number(f.total) || 0), 0);
        const totalImpuestosGeneral = facturas.reduce((s, f) => s + (Number(f.impuestos) || 0), 0);
        const ticketPromedioGeneral = facturas.length ? Math.round(totalVentasGeneral / facturas.length) : 0;

        const ventasMes30 = Array.from({ length: 30 }, (_, i) => {
          const d = new Date(); d.setDate(d.getDate() - (29 - i));
          const key = getLocalDateStr(d);
          const total = facturas
            .filter(f => getLocalDateStr(f.fechaEmision) === key)
            .reduce((s, f) => s + (Number(f.total) || 0), 0);
          return { fecha: d.toLocaleDateString('es-CR', { day:'2-digit', month:'2-digit' }), ventas: total };
        });

        const prodVentas = {};
        detallePedidos.forEach(d => {
          prodVentas[d.productoId] = (prodVentas[d.productoId] || 0) + d.cantidad;
        });
        const topProductos = Object.entries(prodVentas)
          .map(([id, cantidad]) => ({ nombre: productos.find(p => p.id === Number(id))?.nombre || id, cantidad }))
          .sort((a,b) => b.cantidad - a.cantidad)
          .slice(0, 8);

        return (
          <div id="printable-report-area" className="pdf-printable-area animate-fade">
            <div className="pdf-header-banner">
              <div className="pdf-company-brand">
                <span className="company-name">{settings.nombreRestaurante || 'Soda La Tica'}</span>
                <span className="company-sub">Dashboard de Rendimiento General</span>
              </div>
              <div className="pdf-report-meta">
                <div className="pdf-report-title">DASHBOARD GENERAL</div>
                <div><strong>Impreso:</strong> {new Date().toLocaleString('es-CR')}</div>
              </div>
            </div>

            <div className="report-summary-cards">
              <div className="report-summary-card">
                <span className="summary-card-title">Ventas Totales</span>
                <span className="summary-card-value" style={{ color: 'var(--accent)' }}>{fmt(totalVentasGeneral)}</span>
                <span className="summary-card-sub">Acumulado histórico</span>
              </div>
              <div className="report-summary-card">
                <span className="summary-card-title">Total IVA Cobrado</span>
                <span className="summary-card-value" style={{ color: 'var(--warning)' }}>{fmt(totalImpuestosGeneral)}</span>
                <span className="summary-card-sub">13% Impuesto</span>
              </div>
              <div className="report-summary-card">
                <span className="summary-card-title">Ticket Promedio</span>
                <span className="summary-card-value" style={{ color: 'var(--info)' }}>{fmt(ticketPromedioGeneral)}</span>
                <span className="summary-card-sub">Por venta</span>
              </div>
              <div className="report-summary-card">
                <span className="summary-card-title">Facturas Emitidas</span>
                <span className="summary-card-value" style={{ color: 'var(--success)' }}>{facturas.length}</span>
                <span className="summary-card-sub">Registradas</span>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>Ventas Últimos 30 Días</div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={ventasMes30}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="fecha" stroke="var(--text-muted)" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} tickFormatter={v => v > 0 ? (v/1000).toFixed(0)+'K' : '0'} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} formatter={v => [fmt(v), 'Ventas']} />
                  <Line type="monotone" dataKey="ventas" stroke="var(--accent)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Productos Más Vendidos (Cantidad)</div>
              {topProductos.length === 0 ? (
                <div className="empty-state"><p>No hay datos de ventas aún.</p></div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={topProductos} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="nombre" stroke="var(--text-muted)" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
                    <Bar dataKey="cantidad" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
