const fs = require('fs');
const path = require('path');

const productosCode = `const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM productos WHERE activo = TRUE');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, descripcion, precioUnitario, categoriaId } = req.body;
    const [result] = await db.query(
      'INSERT INTO productos (nombre, descripcion, precioUnitario, categoriaId) VALUES (?, ?, ?, ?)',
      [nombre, descripcion, precioUnitario, categoriaId]
    );
    res.status(201).json({ id: result.insertId, nombre, descripcion, precioUnitario, categoriaId, activo: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;`;

fs.writeFileSync(path.join(__dirname, '../restaurant_web_api/routes/productosRoutes.js'), productosCode);
console.log('productosRoutes updated!');
