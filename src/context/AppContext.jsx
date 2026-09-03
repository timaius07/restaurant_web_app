import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/apiService';
import { storage } from '../services/storageService';
import { SETTINGS_DEFAULT, USUARIOS } from '../data/seedData';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [mesas, setMesas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [detallePedidos, setDetallePedidos] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [metodosPago, setMetodosPago] = useState([]);
  const [usuarios, setUsuarios] = useState(() => storage.get('usuarios') || USUARIOS);
  const [settings, setSettingsState] = useState(storage.get('settings') || SETTINGS_DEFAULT);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const [m, c, p, cli, ped, fact, mp] = await Promise.all([
        api.get('/mesas'),
        api.get('/categorias'),
        api.get('/productos'),
        api.get('/clientes'),
        api.get('/pedidos'),
        api.get('/facturas'),
        api.get('/metodos-pago')
      ]);
      setMesas(m);
      setCategorias(c);
      setProductos(p);
      setClientes(cli);
      setPedidos(ped);
      setFacturas(fact);
      setMetodosPago(mp);
      
      // Load detalles for all orders (In a real app, only active or lazy load, but this keeps the structure)
      const detallesPromises = ped.map(pedido => api.get(`/pedidos/${pedido.id}/detalles`));
      const detallesResults = await Promise.all(detallesPromises);
      setDetallePedidos(detallesResults.flat());

    } catch (err) {
      console.error('Error loading data from API', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!storage.get('settings')) storage.set('settings', SETTINGS_DEFAULT);
    if (!storage.get('usuarios')) storage.set('usuarios', USUARIOS);
    reload();
  }, [reload]);

  // Settings
  const updateSettings = (changes) => {
    const newSettings = { ...settings, ...changes };
    storage.set('settings', newSettings);
    setSettingsState(newSettings);
    if (changes.tema) document.documentElement.setAttribute('data-theme', changes.tema);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.tema);
  }, [settings.tema]);

  // ── MESAS ──
  const addMesa = async (data) => { await api.post('/mesas', data); await reload(); };
  const updateMesa = async (id, data) => { await api.put(`/mesas/${id}`, data); await reload(); };
  const deleteMesa = async (id) => { await api.delete(`/mesas/${id}`); await reload(); };
  const setMesaEstado = async (id, estado) => { await api.put(`/mesas/${id}`, { estado }); await reload(); };

  // ── CATEGORIAS ──
  const addCategoria = async (data) => { await api.post('/categorias', data); await reload(); };
  const updateCategoria = async (id, data) => { await api.put(`/categorias/${id}`, data); await reload(); };
  const deleteCategoria = async (id) => { await api.delete(`/categorias/${id}`); await reload(); };

  // ── PRODUCTOS ──
  const addProducto = async (data) => { await api.post('/productos', data); await reload(); };
  const updateProducto = async (id, data) => { await api.put(`/productos/${id}`, data); await reload(); };
  const deleteProducto = async (id) => { await api.delete(`/productos/${id}`); await reload(); };

  // ── CLIENTES ──
  const addCliente = async (data) => { const item = await api.post('/clientes', data); await reload(); return item; };
  const updateCliente = async (id, data) => { await api.put(`/clientes/${id}`, data); await reload(); };
  const deleteCliente = async (id) => { await api.delete(`/clientes/${id}`); await reload(); };

  // ── METODOS DE PAGO ──
  const addMetodoPago = async (data) => { await api.post('/metodos-pago', data); await reload(); };
  const updateMetodoPago = async (id, data) => { await api.put(`/metodos-pago/${id}`, data); await reload(); };
  const deleteMetodoPago = async (id) => { await api.delete(`/metodos-pago/${id}`); await reload(); };

  // ── PEDIDOS ──
  const crearPedido = async (mesaId, usuarioId, clienteId, tipoPedido = 'Local') => {
    const pedido = await api.post('/pedidos', { mesaId: tipoPedido === 'Delivery' ? null : mesaId, usuarioId, clienteId, tipoPedido });
    if (tipoPedido === 'Local' && mesaId) {
      await setMesaEstado(mesaId, 'Ocupada');
    }
    await reload();
    return pedido;
  };

  const updatePedido = async (id, data) => { await api.put(`/pedidos/${id}`, data); await reload(); };

  const cancelarPedido = async (id) => {
    const pedido = pedidos.find(p => p.id === id);
    await api.put(`/pedidos/${id}`, { estado: 'Cancelado' });
    if (pedido && pedido.mesaId) await setMesaEstado(pedido.mesaId, 'Libre');
    await reload();
  };

  // ── DETALLE PEDIDO ──
  const addDetalle = async (pedidoId, productoId, cantidad, notas = '') => {
    // If the product already exists in the order (with no special notes), increment quantity instead of adding a new row
    const existingLine = detallePedidos.find(
      d => d.pedidoId === Number(pedidoId) && d.productoId === Number(productoId) && !d.notas && !notas
    );

    let item;
    if (existingLine) {
      // Update existing line quantity
      await api.put(`/pedidos/detalles/${existingLine.id}`, { cantidad: existingLine.cantidad + Number(cantidad) });
      item = { ...existingLine, cantidad: existingLine.cantidad + Number(cantidad) };
    } else {
      // Create new line
      item = await api.post(`/pedidos/${pedidoId}/detalles`, { productoId, cantidad, notas });
    }

    const ped = pedidos.find(p => p.id === Number(pedidoId));
    if (ped) {
      if (ped.estado === 'Abierto') {
        await api.put(`/pedidos/${pedidoId}`, { estado: 'Preparando', notificarCocina: true });
      } else if (ped.estado === 'Preparando') {
        await api.put(`/pedidos/${pedidoId}`, { notificarCocina: true });
      } else if (ped.estado === 'Servido') {
        await api.put(`/pedidos/${pedidoId}`, { estado: 'Preparando', notificarCocina: true });
      }
    }
    await reload();
    return item;
  };

  const updateDetalle = async (id, data) => {
    await api.put(`/pedidos/detalles/${id}`, data);
    const det = detallePedidos.find(d => d.id === id);
    if (det) {
      const ped = pedidos.find(p => p.id === det.pedidoId);
      if (ped && ['Preparando', 'Servido'].includes(ped.estado)) {
        await api.put(`/pedidos/${det.pedidoId}`, { notificarCocina: true });
      }
    }
    await reload();
  };

  const deleteDetalle = async (id) => {
    const det = detallePedidos.find(d => d.id === id);
    await api.delete(`/pedidos/detalles/${id}`);
    if (det) {
      const ped = pedidos.find(p => p.id === det.pedidoId);
      if (ped && ['Preparando', 'Servido'].includes(ped.estado)) {
        await api.put(`/pedidos/${det.pedidoId}`, { notificarCocina: true });
      }
    }
    await reload();
  };

  // ── FACTURACION ──
  const emitirFactura = async (pedidoId, metodoPagoId, itemsAFacturar = null, incluirServicio = false) => {
    const detalles = detallePedidos.filter(d => Number(d.pedidoId) === Number(pedidoId));
    let totalProductos = 0;
    const detallesFacturados = [];

    if (itemsAFacturar && itemsAFacturar.length > 0) {
      for (const item of itemsAFacturar) {
        if (item.cantidad > 0) {
          const det = detalles.find(d => String(d.id) === String(item.detalleId));
          if (det) {
            totalProductos += det.precioMomento * item.cantidad;
            const nuevaCantFacturada = (det.cantidadFacturada || 0) + item.cantidad;
            await api.put(`/pedidos/detalles/${det.id}`, { cantidadFacturada: nuevaCantFacturada });
            detallesFacturados.push({
              detallePedidoId: det.id,
              productoId: det.productoId,
              cantidad: item.cantidad,
              precioMomento: det.precioMomento
            });
          }
        }
      }
    } else {
      for (const d of detalles) {
        const pending = d.cantidad - (d.cantidadFacturada || 0);
        if (pending > 0) {
          totalProductos += d.precioMomento * pending;
          await api.put(`/pedidos/detalles/${d.id}`, { cantidadFacturada: d.cantidad });
          detallesFacturados.push({
            detallePedidoId: d.id,
            productoId: d.productoId,
            cantidad: pending,
            precioMomento: d.precioMomento
          });
        }
      }
    }

    // Normativa Costa Rica: El IVA (13%) ya está incluido en los precios del menú
    const subtotalSinIVA = Math.round(totalProductos / 1.13);
    const impuestos = totalProductos - subtotalSinIVA; // Desglose informativo IVA 13%
    const servicio = incluirServicio ? Math.round(totalProductos * 0.10) : 0;
    const total = totalProductos + servicio;

    // Generar consecutivo de factura ordenado (ej. F-000001, F-000002...)
    let maxSec = 0;
    (facturas || []).forEach(f => {
      if (f.numeroFactura) {
        const numOnly = f.numeroFactura.replace(/\D/g, '');
        const parsed = parseInt(numOnly, 10);
        if (!isNaN(parsed) && parsed > maxSec) {
          maxSec = parsed;
        }
      }
    });

    const siguienteNum = maxSec + 1;
    const nroFactura = `F-${String(siguienteNum).padStart(6, '0')}`;

    const factura = await api.post('/facturas', {
      pedidoId: Number(pedidoId),
      metodoPagoId: Number(metodoPagoId),
      numeroFactura: nroFactura,
      subtotal: subtotalSinIVA,
      impuestos,
      servicio,
      total,
      detalles: detallesFacturados
    });

    // Re-fetch details to see if fully billed
    const updatedDetalles = await api.get(`/pedidos/${pedidoId}/detalles`);
    const allBilled = updatedDetalles.every(d => (d.cantidadFacturada || 0) >= d.cantidad);

    if (allBilled) {
      await api.put(`/pedidos/${pedidoId}`, { estado: 'Pagado' });
      const pedido = pedidos.find(p => Number(p.id) === Number(pedidoId));
      if (pedido && pedido.mesaId) await setMesaEstado(pedido.mesaId, 'Libre');
    }
    
    await reload();
    
    return {
      ...factura,
      totalProductos,
      subtotal: subtotalSinIVA,
      impuestos,
      servicio,
      total,
      numeroFactura: factura.numeroFactura || nroFactura,
      fechaEmision: factura.fechaEmision || new Date().toISOString(),
      detalles: detallesFacturados
    };
  };

  // ── USUARIOS ──
  const getUsuarios = () => usuarios;

  const addUsuario = (data) => {
    const newId = String(Date.now());
    const newUser = { id: newId, ...data };
    const updated = [...usuarios, newUser];
    storage.set('usuarios', updated);
    setUsuarios(updated);
    return newUser;
  };

  const updateUsuario = (id, changes) => {
    const updated = usuarios.map(u => String(u.id) === String(id) ? { ...u, ...changes } : u);
    storage.set('usuarios', updated);
    setUsuarios(updated);
  };

  const deleteUsuario = (id) => {
    const updated = usuarios.filter(u => String(u.id) !== String(id));
    storage.set('usuarios', updated);
    setUsuarios(updated);
  };

  return (
    <AppContext.Provider value={{
      mesas, categorias, productos, clientes, pedidos,
      detallePedidos, facturas, metodosPago, usuarios, settings, loading,
      addMesa, updateMesa, deleteMesa, setMesaEstado,
      addCategoria, updateCategoria, deleteCategoria,
      addProducto, updateProducto, deleteProducto,
      addCliente, updateCliente, deleteCliente,
      crearPedido, updatePedido, cancelarPedido,
      addDetalle, updateDetalle, deleteDetalle,
      emitirFactura,
      addMetodoPago, updateMetodoPago, deleteMetodoPago,
      getUsuarios, addUsuario, updateUsuario, deleteUsuario,
      updateSettings,
      reload,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() { return useContext(AppContext); }
