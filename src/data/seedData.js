// ───────────────────────────────────────────
// SEED DATA — datos iniciales para localStorage
// ───────────────────────────────────────────
import { v4 as uuid } from './uuid';

export const ROLES = [
  { id: '1', nombreRol: 'Admin' },
  { id: '2', nombreRol: 'Mesero' },
  { id: '3', nombreRol: 'Cocina' },
  { id: '4', nombreRol: 'Cajero' },
];

export const USUARIOS = [
  { id: '1', username: 'admin',    passwordHash: 'admin123',   email: 'admin@soda.cr',    rolId: '1', nombre: 'Administrador' },
  { id: '2', username: 'mesero1',  passwordHash: 'mesero123',  email: 'mesero@soda.cr',   rolId: '2', nombre: 'Carlos Mesero' },
  { id: '3', username: 'cocina1',  passwordHash: 'cocina123',  email: 'cocina@soda.cr',   rolId: '3', nombre: 'Ana Cocinera' },
  { id: '4', username: 'cajero1',  passwordHash: 'cajero123',  email: 'cajero@soda.cr',   rolId: '4', nombre: 'Luis Cajero' },
];

export const MESAS = [
  { id: '1', numeroMesa: 1, capacidad: 2, estado: 'Libre' },
  { id: '2', numeroMesa: 2, capacidad: 4, estado: 'Libre' },
  { id: '3', numeroMesa: 3, capacidad: 4, estado: 'Libre' },
  { id: '4', numeroMesa: 4, capacidad: 6, estado: 'Libre' },
  { id: '5', numeroMesa: 5, capacidad: 2, estado: 'Libre' },
  { id: '6', numeroMesa: 6, capacidad: 6, estado: 'Libre' },
  { id: '7', numeroMesa: 7, capacidad: 8, estado: 'Libre' },
  { id: '8', numeroMesa: 8, capacidad: 4, estado: 'Libre' },
  { id: '9', numeroMesa: 9, capacidad: 2, estado: 'Libre' },
  { id: '10', numeroMesa: 10, capacidad: 4, estado: 'Libre' },
];

export const CATEGORIAS = [
  { id: '1', nombre: 'Entradas' },
  { id: '2', nombre: 'Platos Fuertes' },
  { id: '3', nombre: 'Bebidas' },
  { id: '4', nombre: 'Postres' },
  { id: '5', nombre: 'Sopas' },
];

export const PRODUCTOS = [
  { id: '1', nombre: 'Patacones con Natilla', descripcion: 'Patacones fritos con natilla casera', precioUnitario: 2500, stockActual: 50, categoriaId: '1', activo: true },
  { id: '2', nombre: 'Ceviche de Camarón', descripcion: 'Camarón fresco en limón con culantro', precioUnitario: 4500, stockActual: 30, categoriaId: '1', activo: true },
  { id: '3', nombre: 'Casado con Pollo', descripcion: 'Arroz, frijoles, ensalada, maduro y pollo', precioUnitario: 5500, stockActual: 40, categoriaId: '2', activo: true },
  { id: '4', nombre: 'Casado con Carne', descripcion: 'Arroz, frijoles, ensalada, maduro y carne molida', precioUnitario: 6000, stockActual: 40, categoriaId: '2', activo: true },
  { id: '5', nombre: 'Casado Vegetariano', descripcion: 'Arroz, frijoles, ensalada y vegetales salteados', precioUnitario: 4800, stockActual: 25, categoriaId: '2', activo: true },
  { id: '6', nombre: 'Fresco de Tamarindo', descripcion: 'Bebida natural de tamarindo', precioUnitario: 1200, stockActual: 100, categoriaId: '3', activo: true },
  { id: '7', nombre: 'Fresco de Chan', descripcion: 'Bebida refrescante de chan con limón', precioUnitario: 1200, stockActual: 100, categoriaId: '3', activo: true },
  { id: '8', nombre: 'Refresco Natural', descripcion: 'Refresco del día', precioUnitario: 1000, stockActual: 100, categoriaId: '3', activo: true },
  { id: '9', nombre: 'Tres Leches', descripcion: 'Porción de torta tres leches casera', precioUnitario: 2000, stockActual: 20, categoriaId: '4', activo: true },
  { id: '10', nombre: 'Flan de Coco', descripcion: 'Flan cremoso de coco con caramelo', precioUnitario: 1800, stockActual: 15, categoriaId: '4', activo: true },
  { id: '11', nombre: 'Sopa Negra', descripcion: 'Sopa de frijoles negros con huevo y tortillas', precioUnitario: 3000, stockActual: 30, categoriaId: '5', activo: true },
];

export const CLIENTES = [
  { id: '1', nombre: 'Cliente General', identificacionFiscal: '000000000', telefono: '', email: '' },
  { id: '2', nombre: 'Marco Rodríguez', identificacionFiscal: '1-1234-5678', telefono: '8888-1234', email: 'marco@email.com' },
];

export const METODOS_PAGO = [
  { id: '1', nombre: 'Efectivo', activo: true },
  { id: '2', nombre: 'Tarjeta de Crédito', activo: true },
  { id: '3', nombre: 'Tarjeta de Débito', activo: true },
  { id: '4', nombre: 'Transferencia SINPE', activo: true },
  { id: '5', nombre: 'QR', activo: true },
];

export const SETTINGS_DEFAULT = {
  nombreRestaurante: 'Soda La Tica',
  moneda: 'CRC',
  tasaImpuesto: 13,
  tema: 'dark',
  tasaCambio: 520, // CRC por 1 USD
};
