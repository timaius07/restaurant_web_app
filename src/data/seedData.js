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
  { id: '3', nombre: 'Postres' },
  { id: '4', nombre: 'Sopas' },
  { id: '5', nombre: 'Bebidas Calientes' },
  { id: '6', nombre: 'Vegetariano' },
  { id: '7', nombre: 'Plato Económico' },
  { id: '8', nombre: 'Comidas Rápidas' },
  { id: '9', nombre: 'Desayunos' },
  { id: '10', nombre: 'Almuerzos' },
  { id: '11', nombre: 'Gallos y Tortillas' },
  { id: '12', nombre: 'Bebidas Naturales' },
  { id: '13', nombre: 'Embotellados' },
];

export const PRODUCTOS = [
  // Entradas
  { id: '1', nombre: 'Patacones con Natilla', descripcion: 'Patacones fritos con natilla casera y frijoles molidos', precioUnitario: 2500, categoriaId: '1', activo: true },
  { id: '2', nombre: 'Ceviche de Camarón', descripcion: 'Camarón fresco en limón con culantro y galletas', precioUnitario: 4500, categoriaId: '1', activo: true },
  
  // Platos Fuertes
  { id: '3', nombre: 'Casado con Pollo', descripcion: 'Arroz, frijoles, ensalada, maduro y pechuga a la plancha', precioUnitario: 5500, categoriaId: '2', activo: true },
  { id: '4', nombre: 'Casado con Carne', descripcion: 'Arroz, frijoles, ensalada, maduro y bistec en salsa', precioUnitario: 6000, categoriaId: '2', activo: true },
  
  // Postres
  { id: '5', nombre: 'Tres Leches', descripcion: 'Porción de torta tres leches casera', precioUnitario: 2000, categoriaId: '3', activo: true },
  { id: '6', nombre: 'Flan de Coco', descripcion: 'Flan cremoso de coco con caramelo artesanal', precioUnitario: 1800, categoriaId: '3', activo: true },
  
  // Sopas
  { id: '7', nombre: 'Sopa Negra', descripcion: 'Sopa de frijoles negros con huevo duro y tortillas', precioUnitario: 3000, categoriaId: '4', activo: true },
  { id: '8', nombre: 'Olla de Carne', descripcion: 'Sopa tradicional de carne de res con verduras surtidas', precioUnitario: 4500, categoriaId: '4', activo: true },

  // Bebidas Calientes
  { id: '9', nombre: 'Café Chorreado', descripcion: 'Café negro o con leche recién chorreado', precioUnitario: 1200, categoriaId: '5', activo: true },
  { id: '10', nombre: 'Agua Dulce con Queso', descripcion: 'Tapa dulce caliente acompañada de queso turrialba', precioUnitario: 1500, categoriaId: '5', activo: true },

  // Vegetariano
  { id: '11', nombre: 'Casado Vegetariano', descripcion: 'Arroz, frijoles, ensalada, maduros y vegetales salteados', precioUnitario: 4800, categoriaId: '6', activo: true },
  { id: '12', nombre: 'Ensalada Verde de la Casa', descripcion: 'Mezcla de lechugas, tomate, aguacate y aderezo especial', precioUnitario: 3500, categoriaId: '6', activo: true },

  // Plato Económico
  { id: '13', nombre: 'Arroz con Huevo y Plátano', descripcion: 'Plato económico con arroz, frijoles, huevo frito y maduro', precioUnitario: 2200, categoriaId: '7', activo: true },

  // Comidas Rápidas
  { id: '14', nombre: 'Hamburguesa Especial', descripcion: 'Carne artesanal, queso, tocineta, lechuga y papas', precioUnitario: 3800, categoriaId: '8', activo: true },
  { id: '15', nombre: 'Papas Fritas Suprema', descripcion: 'Papas crujientes con queso fundido y carne molida', precioUnitario: 2500, categoriaId: '8', activo: true },

  // Desayunos
  { id: '16', nombre: 'Gallo Pinto Completo', descripcion: 'Gallo pinto, huevos al gusto, queso frito, natilla y platano', precioUnitario: 3500, categoriaId: '9', activo: true },

  // Almuerzos
  { id: '17', nombre: 'Arroz con Pollo', descripcion: 'Arroz guisado con pollo desmechado, papas fritas y ensalada', precioUnitario: 4500, categoriaId: '10', activo: true },
  { id: '18', nombre: 'Chifrijo Tradicional', descripcion: 'Chicharrón, frijoles tiernos, pico de gallo y aguacate', precioUnitario: 4000, categoriaId: '10', activo: true },

  // Gallos y Tortillas
  { id: '19', nombre: 'Gallo de Salchichón', descripcion: 'Sausage with Tortilla', precioUnitario: 1200, categoriaId: '11', activo: true },
  { id: '20', nombre: 'Gallo de Salchichón Arreglado', descripcion: 'Tortilla with Sausage, Cabbage and Sausage', precioUnitario: 1800, categoriaId: '11', activo: true },
  { id: '21', nombre: 'Gallo de Pescado', descripcion: 'Tortilla with Fish', precioUnitario: 1800, categoriaId: '11', activo: true },
  { id: '22', nombre: 'Gallo de Queso Natural', descripcion: 'Tortilla with Cheese', precioUnitario: 1000, categoriaId: '11', activo: true },
  { id: '23', nombre: 'Gallo de Queso Frito', descripcion: 'Tortilla with Fried Cheese', precioUnitario: 1200, categoriaId: '11', activo: true },

  // Bebidas Naturales
  { id: '24', nombre: 'Fresco de Tamarindo', descripcion: 'Bebida natural de tamarindo casera 500ml', precioUnitario: 1200, categoriaId: '12', activo: true },
  { id: '25', nombre: 'Fresco de Chan', descripcion: 'Bebida refrescante de chan con limón', precioUnitario: 1200, categoriaId: '12', activo: true },
  { id: '26', nombre: 'Horchata Casera', descripcion: 'Bebida de arroz con canela y leche', precioUnitario: 1500, categoriaId: '12', activo: true },

  // Embotellados
  { id: '27', nombre: 'Coca-Cola 500ml', descripcion: 'Refresco embotellado frío', precioUnitario: 1200, categoriaId: '13', activo: true },
  { id: '28', nombre: 'Agua Embotellada 600ml', descripcion: 'Agua purificada de manantial', precioUnitario: 1000, categoriaId: '13', activo: true },
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
