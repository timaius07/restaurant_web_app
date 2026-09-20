import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/apiService';

import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

// Temporal: localStorage helper hasta implementar separación completa
const storage = {
  get: (key) => {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    } catch { return null; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
  remove: (key) => { localStorage.removeItem(key); },
};

// Business Settings (backend con fallback a valores por defecto)
const BUSINESS_SETTINGS_DEFAULT = {
  nombreRestaurante: 'Soda La Tica',
  razonSocial: 'Soda La Tica S.A.',
  cedulaJuridica: '3-101-123456',
  telefono: '2222-3333',
  correo: 'contacto@sodalatica.cr',
  moneda: 'CRC',
  tasaImpuesto: 13,
  tasaCambio: 520,
};

// UI Settings (localStorage solo para UI como tema)
const UI_SETTINGS_DEFAULT = {
  tema: 'dark',
};

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { user } = useAuth();
  const [mesas, setMesas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [detallePedidos, setDetallePedidos] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [metodosPago, setMetodosPago] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [settings, setSettingsState] = useState(() => {
    const uiSettings = storage.get('ui_settings') || UI_SETTINGS_DEFAULT;
    return { ...BUSINESS_SETTINGS_DEFAULT, ...uiSettings };
  });
  const [loading, setLoading] = useState(true);

  // Carga los datos operativos que se refrescan periódicamente (pedidos, mesas, etc.)
  // NO incluye usuarios ni configuración — esos se cargan por separado al iniciar sesión.
  const reload = useCallback(async () => {
    const session = storage.get('session');
    if (!session || !session.token) {
      setLoading(false);
      return;
    }

    try {
      const [m, c, p, cli, ped, fact, mp] = await Promise.all([
        api.get('/mesas'),
        api.get('/categorias'),
        api.get('/productos'),
        api.get('/clientes'),
        api.get('/pedidos'),
        api.get('/facturas'),
        api.get('/metodos-pago'),
      ]);
      setMesas(m);
      setCategorias(c);
      setProductos(p);
      setClientes(cli);
      setPedidos(ped);
      setFacturas(fact);
      setMetodosPago(mp);

      // Cargar detalles únicamente de pedidos activos para evitar llamadas N+1
      const activePedidos = ped.filter(p => ['Abierto', 'Preparando', 'Servido'].includes(p.estado));
      if (activePedidos.length > 0) {
        const detallesPromises = activePedidos.map(pedido => api.get(`/pedidos/${pedido.id}/detalles`));
        const detallesResults = await Promise.all(detallesPromises);
        setDetallePedidos(detallesResults.flat());
      } else {
        setDetallePedidos([]);
      }

    } catch (err) {
      console.error('Error loading data from API', err);
      if (storage.get('session')) {
        toast.error('Error al cargar datos del servidor. Verifica tu conexión.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga datos estáticos (usuarios, configuración) que solo necesita el Admin una vez al iniciar sesión.
  const loadStaticData = useCallback(async (userRutas) => {
    const rutas = userRutas || [];
    try {
      const [cfg, usr] = await Promise.all([
        rutas.includes('/configuracion') ? api.get('/configuracion').catch(() => null) : Promise.resolve(null),
        rutas.includes('/usuarios')      ? api.get('/usuarios').catch(() => null)      : Promise.resolve(null),
      ]);

      if (usr) setUsuarios(usr);

      if (cfg) {
        // Configuración de negocio de la base de datos con fallback a valores por defecto
        const mergedSettings = { ...BUSINESS_SETTINGS_DEFAULT, ...cfg };
        const uiSettings = storage.get('ui_settings') || UI_SETTINGS_DEFAULT;
        setSettingsState({ ...mergedSettings, ...uiSettings });
      }
    } catch (err) {
      console.error('Error loading static data', err);
    }
  }, []);

  useEffect(() => {
    if (!storage.get('ui_settings')) storage.set('ui_settings', UI_SETTINGS_DEFAULT);
    if (user && user.token) {
      // Cargar datos operativos y datos estáticos en paralelo al iniciar sesión
      reload();
      loadStaticData(user.rutas);
    } else {
      setMesas([]);
      setCategorias([]);
      setProductos([]);
      setClientes([]);
      setPedidos([]);
      setDetallePedidos([]);
      setFacturas([]);
      setMetodosPago([]);
      setUsuarios([]);
      setLoading(false);
    }
  }, [user, reload, loadStaticData]);

  // Settings
  const updateSettings = async (changes) => {
    // Separar cambios de UI vs negocio
    const uiChanges = {};
    const businessChanges = {};
    
    Object.keys(changes).forEach(key => {
      if (key === 'tema') {
        uiChanges[key] = changes[key];
      } else {
        businessChanges[key] = changes[key];
      }
    });
    
    // Actualizar UI settings inmediatamente (localStorage)
    if (Object.keys(uiChanges).length > 0) {
      const currentUiSettings = storage.get('ui_settings') || UI_SETTINGS_DEFAULT;
      const newUiSettings = { ...currentUiSettings, ...uiChanges };
      storage.set('ui_settings', newUiSettings);
      const newSettings = { ...settings, ...uiChanges };
      setSettingsState(newSettings);
      if (uiChanges.tema) {
        document.documentElement.setAttribute('data-theme', uiChanges.tema);
      }
    }
    
    // Enviar cambios de negocio al backend
    if (Object.keys(businessChanges).length > 0) {
      try {
        const updatedCfg = await api.put('/configuracion', businessChanges);
        if (updatedCfg) {
          const finalSettings = { ...settings, ...updatedCfg };
          setSettingsState(finalSettings);
          toast.success('Configuración guardada correctamente');
        }
      } catch (err) {
        console.error('Error al guardar configuración en BD:', err);
        toast.error(err.message || 'Error al guardar configuración');
        throw err;
      }
    }
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
    } else {
      await reload();
    }
    return pedido;
  };

  const updatePedido = async (id, data) => {
    const pedido = pedidos.find(p => Number(p.id) === Number(id));
    await api.put(`/pedidos/${id}`, data);
    if (data.estado && ['Cancelado', 'Pagado'].includes(data.estado) && pedido && pedido.mesaId) {
      await setMesaEstado(pedido.mesaId, 'Libre');
    }
    await reload();
  };

  const cancelarPedido = async (id) => {
    const pedido = pedidos.find(p => Number(p.id) === Number(id));
    await api.put(`/pedidos/${id}`, { estado: 'Cancelado' });
    if (pedido && pedido.mesaId) {
      await setMesaEstado(pedido.mesaId, 'Libre');
    }
    await reload();
  };

  // ── DETALLE PEDIDO ──
  const addDetalle = async (pedidoId, productoId, cantidad, notas = '') => {
    // If the product already exists in the order (with no special notes and not billed yet), increment quantity
    const existingLine = detallePedidos.find(
      d => d.pedidoId === Number(pedidoId) &&
           d.productoId === Number(productoId) &&
           !d.notas &&
           !notas &&
           (!d.cantidadFacturada || d.cantidadFacturada === 0)
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
  const emitirFactura = async (pedidoId, metodoPagoId, itemsAFacturar = null, incluirServicio = false, clienteId = null) => {
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
      clienteId: clienteId ? Number(clienteId) : null,
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
      clienteId: clienteId ? Number(clienteId) : factura.clienteId,
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

  // ── AUDITORÍA DE ACCIONES ──
  const logAuditAction = async (accion, detalles) => {
    try {
      const session = JSON.parse(localStorage.getItem('session') || 'null');
      await api.post('/auditoria', {
        usuarioId: session?.id || null,
        usuarioNombre: session?.nombre || 'Sistema',
        accion,
        detalles
      });
    } catch (err) {
      console.error('Error enviando log de auditoría:', err);
    }
  };

  // ── USUARIOS ──
  const getUsuarios = () => usuarios;

  const addUsuario = async (data) => {
    try {
      await api.post('/usuarios', data);
      await reload();
      logAuditAction('CREAR_USUARIO', `Creación de usuario: ${data.nombre} (@${data.username})`);
      toast.success('Usuario creado correctamente');
    } catch (err) {
      console.error('Error al crear usuario:', err);
      toast.error(err.message || 'Error al crear usuario');
      throw err;
    }
  };

  const updateUsuario = async (id, changes) => {
    try {
      await api.put(`/usuarios/${id}`, changes);
      await reload();
      logAuditAction('ACTUALIZAR_USUARIO', `Actualización de usuario ID: ${id}`);
      toast.success('Usuario actualizado correctamente');
    } catch (err) {
      console.error('Error al actualizar usuario:', err);
      toast.error(err.message || 'Error al actualizar usuario');
      throw err;
    }
  };

  const deleteUsuario = async (id) => {
    try {
      await api.delete(`/usuarios/${id}`);
      await reload();
      logAuditAction('ELIMINAR_USUARIO', `Eliminación de usuario ID: ${id}`);
      toast.success('Usuario eliminado correctamente');
    } catch (err) {
      console.error('Error al eliminar usuario:', err);
      toast.error(err.message || 'Error al eliminar usuario');
      throw err;
    }
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
      updateSettings, logAuditAction,
      reload, loadStaticData,
    }}>
      {children}
    </AppContext.Provider>
  );

}

export function useApp() { return useContext(AppContext); }
