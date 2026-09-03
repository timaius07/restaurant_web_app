-- ───────────────────────────────────────────
-- ESTRUCTURA RELACIONAL PARA LA BASE DE DATOS MySQL (SISTEMA DE RESTAURANTE)
-- ───────────────────────────────────────────

CREATE DATABASE IF NOT EXISTS restaurante_db;
USE restaurante_db;

-- 1. ROLES
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombreRol VARCHAR(50) NOT NULL UNIQUE
);

-- 2. USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  passwordHash VARCHAR(255) NOT NULL,
  email VARCHAR(100),
  nombre VARCHAR(100) NOT NULL,
  rolId INT NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (rolId) REFERENCES roles(id) ON DELETE RESTRICT
);

-- 3. MESAS
CREATE TABLE IF NOT EXISTS mesas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numeroMesa INT NOT NULL UNIQUE,
  capacidad INT NOT NULL,
  estado ENUM('Libre', 'Ocupada', 'Reservada') DEFAULT 'Libre'
);

-- 4. CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  identificacionFiscal VARCHAR(50),
  telefono VARCHAR(20),
  email VARCHAR(100)
);

-- 5. METODOS DE PAGO
CREATE TABLE IF NOT EXISTS metodos_pago (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  activo BOOLEAN DEFAULT TRUE
);

-- 6. CATEGORIAS (Productos)
CREATE TABLE IF NOT EXISTS categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE
);

-- 7. PRODUCTOS
CREATE TABLE IF NOT EXISTS productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  precioUnitario DECIMAL(10,2) NOT NULL,
  categoriaId INT NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (categoriaId) REFERENCES categorias(id) ON DELETE RESTRICT
);

-- 8. PEDIDOS
CREATE TABLE IF NOT EXISTS pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mesaId INT NULL, -- Puede ser NULL para pedidos de Delivery/Para llevar
  usuarioId INT NOT NULL,
  clienteId INT NOT NULL,
  tipoPedido ENUM('Local', 'Delivery') DEFAULT 'Local',
  estado ENUM('Abierto', 'Preparando', 'Servido', 'Pagado', 'Cancelado') DEFAULT 'Abierto',
  fechaApertura DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mesaId) REFERENCES mesas(id) ON DELETE SET NULL,
  FOREIGN KEY (usuarioId) REFERENCES usuarios(id) ON DELETE RESTRICT,
  FOREIGN KEY (clienteId) REFERENCES clientes(id) ON DELETE RESTRICT
);

-- 9. DETALLE DE PEDIDOS
CREATE TABLE IF NOT EXISTS detalle_pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedidoId INT NOT NULL,
  productoId INT NOT NULL,
  cantidad INT NOT NULL,
  precioMomento DECIMAL(10,2) NOT NULL,
  cantidadFacturada INT DEFAULT 0,
  notas TEXT,
  FOREIGN KEY (pedidoId) REFERENCES pedidos(id) ON DELETE CASCADE,
  FOREIGN KEY (productoId) REFERENCES productos(id) ON DELETE RESTRICT
);

-- 10. FACTURAS
CREATE TABLE IF NOT EXISTS facturas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedidoId INT NOT NULL,
  metodoPagoId INT NOT NULL,
  numeroFactura VARCHAR(50) NOT NULL UNIQUE,
  fechaEmision DATETIME DEFAULT CURRENT_TIMESTAMP,
  subtotal DECIMAL(12,2) NOT NULL,
  impuestos DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (pedidoId) REFERENCES pedidos(id) ON DELETE RESTRICT,
  FOREIGN KEY (metodoPagoId) REFERENCES metodos_pago(id) ON DELETE RESTRICT
);

-- 11. DETALLE DE FACTURAS (Relaciona qué items se cobraron en qué factura para cobros divididos)
CREATE TABLE IF NOT EXISTS detalle_facturas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  facturaId INT NOT NULL,
  detallePedidoId INT NOT NULL,
  productoId INT NOT NULL,
  cantidad INT NOT NULL,
  precioMomento DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (facturaId) REFERENCES facturas(id) ON DELETE CASCADE,
  FOREIGN KEY (detallePedidoId) REFERENCES detalle_pedidos(id) ON DELETE RESTRICT,
  FOREIGN KEY (productoId) REFERENCES productos(id) ON DELETE RESTRICT
);

-- INSERCIÓN DE DATOS INICIALES (Semillas)

INSERT INTO roles (nombreRol) VALUES ('Admin'), ('Mesero'), ('Cocina'), ('Cajero');

INSERT INTO usuarios (username, passwordHash, email, nombre, rolId) VALUES
('admin', 'admin123', 'admin@soda.cr', 'Administrador', 1),
('mesero1', 'mesero123', 'mesero@soda.cr', 'Carlos Mesero', 2),
('cocina1', 'cocina123', 'cocina@soda.cr', 'Ana Cocinera', 3),
('cajero1', 'cajero123', 'cajero@soda.cr', 'Luis Cajero', 4);

INSERT INTO clientes (nombre, identificacionFiscal, telefono, email) VALUES
('Cliente General', '000000000', '', ''),
('Marco Rodríguez', '1-1234-5678', '8888-1234', 'marco@email.com');

INSERT INTO metodos_pago (nombre) VALUES
('Efectivo'), ('Tarjeta de Crédito'), ('Tarjeta de Débito'), ('Transferencia SINPE'), ('QR');

INSERT INTO mesas (numeroMesa, capacidad) VALUES
(1, 2), (2, 4), (3, 4), (4, 6), (5, 2), (6, 6), (7, 8), (8, 4), (9, 2), (10, 4);

INSERT INTO categorias (nombre) VALUES
('Entradas'), ('Platos Fuertes'), ('Postres'), ('Sopas'), ('Bebidas Calientes'),
('Vegetariano'), ('Plato Económico'), ('Comidas Rápidas'), ('Desayunos'),
('Almuerzos'), ('Gallos y Tortillas'), ('Bebidas Naturales'), ('Embotellados');

INSERT INTO productos (nombre, descripcion, precioUnitario, categoriaId) VALUES
('Patacones con Natilla', 'Patacones fritos con natilla casera', 2500, 1),
('Ceviche de Camarón', 'Camarón fresco en limón con culantro', 4500, 1),
('Casado con Pollo', 'Arroz, frijoles, ensalada, maduro y pollo', 5500, 2),
('Gallo de Salchichón', 'Sausage with Tortilla', 1200, 11),
('Fresco de Tamarindo', 'Bebida natural de tamarindo', 1200, 12);
