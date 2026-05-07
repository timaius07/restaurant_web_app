import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAll, saveAll, create, update, remove } from '../services/storageService';
import { storage } from '../services/storageService';
import {
  MESAS, CATEGORIAS, PRODUCTOS, CLIENTES, METODOS_PAGO, SETTINGS_DEFAULT
} from '../data/seedData';
import { v4 as uuid } from '../data/uuid';
import { generateFacturaNumber } from '../utils/formatters';

const AppContext = createContext(null);

function initEntity(key, defaultData) {
  if (!storage.get(key)) storage.set(key, defaultData);
}

export function AppProvider({ children }) {
  const [mesas, setMesas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [detallePedidos, setDetallePedidos] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [metodosPago, setMetodosPago] = useState([]);
  const [settings, setSettingsState] = useState(SETTINGS_DEFAULT);

  const reload = useCallback(() => {
    setMesas(getAll('mesas'));
    setCategorias(getAll('categorias'));
    setProductos(getAll('productos'));
    setClientes(getAll('clientes'));
    setPedidos(getAll('pedidos'));
    setDetallePedidos(getAll('detallePedidos'));
    setFacturas(getAll('facturas'));
    setMetodosPago(getAll('metodosPago'));
    setSettingsState(storage.get('settings') || SETTINGS_DEFAULT);
  }, []);

  useEffect(() => {
    initEntity('mesas', MESAS);
    initEntity('categorias', CATEGORIAS);
    initEntity('productos', PRODUCTOS);
    initEntity('clientes', CLIENTES);
    initEntity('pedidos', []);
    initEntity('detallePedidos', []);
    initEntity('facturas', []);
    initEntity('metodosPago', METODOS_PAGO);
    if (!storage.get('settings')) storage.set('settings', SETTINGS_DEFAULT);
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
  const addMesa = (data) => { create('mesas', { id: uuid(), ...data }); reload(); };
  const updateMesa = (id, data) => { update('mesas', id, data); reload(); };
  const deleteMesa = (id) => { remove('mesas', id); reload(); };
  const setMesaEstado = (id, estado) => { update('mesas', id, { estado }); reload(); };

  // ── CATEGORIAS ──
  const addCategoria = (data) => { create('categorias', { id: uuid(), ...data }); reload(); };
  const updateCategoria = (id, data) => { update('categorias', id, data); reload(); };
  const deleteCategoria = (id) => { remove('categorias', id); reload(); };

  // ── PRODUCTOS ──
  const addProducto = (data) => { create('productos', { id: uuid(), activo: true, ...data }); reload(); };
  const updateProducto = (id, data) => { update('productos', id, data); reload(); };
  const deleteProducto = (id) => { remove('productos', id); reload(); };

  // ── CLIENTES ──
  const addCliente = (data) => { const item = { id: uuid(), ...data }; create('clientes', item); reload(); return item; };
  const updateCliente = (id, data) => { update('clientes', id, data); reload(); };
  const deleteCliente = (id) => { remove('clientes', id); reload(); };

  // ── METODOS DE PAGO ──
  const addMetodoPago = (data) => { create('metodosPago', { id: uuid(), activo: true, ...data }); reload(); };
  const updateMetodoPago = (id, data) => { update('metodosPago', id, data); reload(); };
  const deleteMetodoPago = (id) => { remove('metodosPago', id); reload(); };

  // ── PEDIDOS ──
  const crearPedido = (mesaId, usuarioId, clienteId) => {
    const pedido = {
      id: uuid(),
      mesaId, usuarioId, clienteId,
      fechaApertura: new Date().toISOString(),
      estado: 'Abierto',
    };
    create('pedidos', pedido);
    setMesaEstado(mesaId, 'Ocupada');
    reload();
    return pedido;
  };

  const updatePedido = (id, data) => { update('pedidos', id, data); reload(); };

  const cancelarPedido = (id) => {
    const pedido = getAll('pedidos').find(p => p.id === id);
    update('pedidos', id, { estado: 'Cancelado' });
    if (pedido) setMesaEstado(pedido.mesaId, 'Libre');
    reload();
  };

  // ── DETALLE PEDIDO ──
  const addDetalle = (pedidoId, productoId, cantidad, notas = '') => {
    const prod = getAll('productos').find(p => p.id === productoId);
    const item = { id: uuid(), pedidoId, productoId, cantidad, precioMomento: prod?.precioUnitario || 0, notas, cantidadFacturada: 0 };
    create('detallePedidos', item);
    // Update estado pedido a Preparando
    const allPedidos = getAll('pedidos');
    const ped = allPedidos.find(p => p.id === pedidoId);
    if (ped && ped.estado === 'Abierto') update('pedidos', pedidoId, { estado: 'Preparando' });
    reload();
    return item;
  };

  const updateDetalle = (id, data) => { update('detallePedidos', id, data); reload(); };
  const deleteDetalle = (id) => { remove('detallePedidos', id); reload(); };

  // ── FACTURACION ──
  const emitirFactura = (pedidoId, metodoPagoId, itemsAFacturar = null) => {
    const allFacturas = getAll('facturas');
    const pedido = getAll('pedidos').find(p => p.id === pedidoId);
    const detalles = getAll('detallePedidos').filter(d => d.pedidoId === pedidoId);
    
    let subtotal = 0;
    const facturaDetalles = [];

    if (itemsAFacturar && itemsAFacturar.length > 0) {
      itemsAFacturar.forEach(item => {
        if (item.cantidad > 0) {
          const det = detalles.find(d => d.id === item.detalleId);
          if (det) {
            subtotal += det.precioMomento * item.cantidad;
            facturaDetalles.push({ detalleId: det.id, productoId: det.productoId, cantidad: item.cantidad, precioMomento: det.precioMomento });
            const nuevaCantFacturada = (det.cantidadFacturada || 0) + item.cantidad;
            update('detallePedidos', det.id, { cantidadFacturada: nuevaCantFacturada });
          }
        }
      });
    } else {
      detalles.forEach(d => {
        const pending = d.cantidad - (d.cantidadFacturada || 0);
        if (pending > 0) {
          subtotal += d.precioMomento * pending;
          facturaDetalles.push({ detalleId: d.id, productoId: d.productoId, cantidad: pending, precioMomento: d.precioMomento });
          update('detallePedidos', d.id, { cantidadFacturada: d.cantidad });
        }
      });
    }

    const tasa = (storage.get('settings') || SETTINGS_DEFAULT).tasaImpuesto;
    const impuestos = Math.round(subtotal * (tasa / 100));
    const total = subtotal + impuestos;
    const factura = {
      id: uuid(),
      pedidoId,
      numeroFactura: generateFacturaNumber(allFacturas.length + 1),
      fechaEmision: new Date().toISOString(),
      subtotal, impuestos, total, metodoPagoId,
      detalles: facturaDetalles
    };
    create('facturas', factura);
    
    const updatedDetalles = getAll('detallePedidos').filter(d => d.pedidoId === pedidoId);
    const allBilled = updatedDetalles.every(d => (d.cantidadFacturada || 0) >= d.cantidad);

    if (allBilled) {
      update('pedidos', pedidoId, { estado: 'Pagado' });
      if (pedido) setMesaEstado(pedido.mesaId, 'Libre');
    }
    reload();
    return factura;
  };

  // ── USUARIOS ──
  const getUsuarios = () => getAll('usuarios');
  const addUsuario = (data) => { create('usuarios', { id: uuid(), ...data }); };
  const updateUsuario = (id, data) => { update('usuarios', id, data); };
  const deleteUsuario = (id) => { remove('usuarios', id); };

  return (
    <AppContext.Provider value={{
      // State
      mesas, categorias, productos, clientes, pedidos,
      detallePedidos, facturas, metodosPago, settings,
      // Mesas
      addMesa, updateMesa, deleteMesa, setMesaEstado,
      // Categorias
      addCategoria, updateCategoria, deleteCategoria,
      // Productos
      addProducto, updateProducto, deleteProducto,
      // Clientes
      addCliente, updateCliente, deleteCliente,
      // Pedidos
      crearPedido, updatePedido, cancelarPedido,
      // Detalle
      addDetalle, updateDetalle, deleteDetalle,
      // Facturación
      emitirFactura,
      // Metodos pago
      addMetodoPago, updateMetodoPago, deleteMetodoPago,
      // Usuarios
      getUsuarios, addUsuario, updateUsuario, deleteUsuario,
      // Settings
      updateSettings,
      // Reload
      reload,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() { return useContext(AppContext); }
