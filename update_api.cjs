const fs = require('fs');
const path = require('path');

const clientesCode = `const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM clientes');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, identificacionFiscal, telefono, email } = req.body;
    const [result] = await db.query(
      'INSERT INTO clientes (nombre, identificacionFiscal, telefono, email) VALUES (?, ?, ?, ?)',
      [nombre, identificacionFiscal || '', telefono || '', email || '']
    );
    res.status(201).json({ id: result.insertId, nombre, identificacionFiscal, telefono, email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, identificacionFiscal, telefono, email } = req.body;
    await db.query(
      'UPDATE clientes SET nombre = ?, identificacionFiscal = ?, telefono = ?, email = ? WHERE id = ?',
      [nombre, identificacionFiscal || '', telefono || '', email || '', id]
    );
    res.json({ id: Number(id), nombre, identificacionFiscal, telefono, email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM clientes WHERE id = ?', [id]);
    res.json({ success: true, id: Number(id) });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      return res.status(400).json({ error: 'No se puede eliminar: el cliente tiene pedidos asociados.' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;`;

const facturasCode = `const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const [facturas] = await db.query('SELECT * FROM facturas ORDER BY fechaEmision DESC');
    for (const f of facturas) {
      const [detalles] = await db.query('SELECT * FROM detalle_facturas WHERE facturaId = ?', [f.id]);
      f.detalles = detalles;
    }
    res.json(facturas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    let { pedidoId, metodoPagoId, numeroFactura, subtotal, impuestos, total, detalles } = req.body;

    // Calcular consecutivo F-XXXXXX directamente desde la base de datos MySQL para evitar duplicados
    const [rows] = await db.query("SELECT numeroFactura FROM facturas WHERE numeroFactura LIKE 'F-%' ORDER BY id DESC LIMIT 1");
    let nextNum = 1;
    if (rows && rows.length > 0 && rows[0].numeroFactura) {
      const numOnly = rows[0].numeroFactura.replace(/\\D/g, '');
      const parsed = parseInt(numOnly, 10);
      if (!isNaN(parsed)) {
        nextNum = parsed + 1;
      }
    }

    numeroFactura = \`F-\${String(nextNum).padStart(6, '0')}\`;

    const [result] = await db.query(
      'INSERT INTO facturas (pedidoId, metodoPagoId, numeroFactura, subtotal, impuestos, total) VALUES (?, ?, ?, ?, ?, ?)',
      [pedidoId, metodoPagoId, numeroFactura, subtotal, impuestos, total]
    );

    const facturaId = result.insertId;
    const insertedDetalles = [];

    if (detalles && Array.isArray(detalles) && detalles.length > 0) {
      for (const item of detalles) {
        if (item.cantidad > 0) {
          const detPedidoId = item.detallePedidoId || item.detalleId || null;
          const [detResult] = await db.query(
            'INSERT INTO detalle_facturas (facturaId, detallePedidoId, productoId, cantidad, precioMomento) VALUES (?, ?, ?, ?, ?)',
            [facturaId, detPedidoId, item.productoId, item.cantidad, item.precioMomento]
          );
          insertedDetalles.push({
            id: detResult.insertId,
            facturaId,
            detallePedidoId: detPedidoId,
            productoId: item.productoId,
            cantidad: item.cantidad,
            precioMomento: item.precioMomento
          });
        }
      }
    }

    res.status(201).json({
      id: facturaId,
      pedidoId,
      metodoPagoId,
      numeroFactura,
      subtotal,
      impuestos,
      total,
      fechaEmision: new Date().toISOString(),
      detalles: insertedDetalles
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;`;

fs.writeFileSync(path.join(__dirname, '../restaurant_web_api/routes/clientesRoutes.js'), clientesCode);
fs.writeFileSync(path.join(__dirname, '../restaurant_web_api/routes/facturasRoutes.js'), facturasCode);
console.log('clientesRoutes and facturasRoutes updated with detallePedidoId logic!');
