const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');
const { encrypt } = require('../services/cryptoService');

router.use(requireAuth);

// Valores por defecto de negocio (fallback si la tabla está vacía)
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

async function ensureConfigTable(pool) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS configuraciones (
        clave VARCHAR(50) PRIMARY KEY,
        valor TEXT NOT NULL
      )
    `);
  } catch (e) {}
}

router.get('/', async (req, res, next) => {
  try {
    await ensureConfigTable(req.dbPool);
    const [rows] = await req.dbPool.query('SELECT * FROM configuraciones');
    const config = { ...BUSINESS_SETTINGS_DEFAULT };
    
    // Si hay tenant info, usar el nombre del tenant
    if (req.tenant && req.tenant.nombre) {
      config.nombreRestaurante = req.tenant.nombre;
    }
    
    // Sobrescribir con valores de la base de datos
    rows.forEach(r => {
      let val = r.valor;
      if (r.clave === 'tasaImpuesto' || r.clave === 'tasaCambio') {
        const num = Number(val);
        val = isNaN(num) ? val : num;
      } else if ((r.clave === 'resend_api_key' || r.clave === 'whatsapp_api_key' || r.clave === 'ycloud_api_key') && val) {
        val = '********';
      }
      config[r.clave] = val;
    });
    
    res.json(config);
  } catch (err) {
    next(err);
  }
});

router.put('/', requireRole('Admin'), async (req, res, next) => {
  try {
    await ensureConfigTable(req.dbPool);
    const changes = req.body;
    if (!changes || typeof changes !== 'object') {
      return res.status(400).json({ error: 'Objeto de configuración no válido' });
    }

    for (const [clave, valor] of Object.entries(changes)) {
      if (valor !== undefined && valor !== null && valor !== '********') {
        let dbValue = String(valor);
        if (clave === 'resend_api_key' || clave === 'whatsapp_api_key' || clave === 'ycloud_api_key') {
          dbValue = encrypt(dbValue);
        }
        await req.dbPool.query(
          'INSERT INTO configuraciones (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)',
          [clave, dbValue]
        );
      }
    }

    // Devolver la configuración actualizada con fallback
    const [rows] = await req.dbPool.query('SELECT * FROM configuraciones');
    const config = { ...BUSINESS_SETTINGS_DEFAULT };
    
    if (req.tenant && req.tenant.nombre) {
      config.nombreRestaurante = req.tenant.nombre;
    }
    
    rows.forEach(r => {
      let val = r.valor;
      if (r.clave === 'tasaImpuesto' || r.clave === 'tasaCambio') {
        const num = Number(val);
        val = isNaN(num) ? val : num;
      } else if ((r.clave === 'resend_api_key' || r.clave === 'whatsapp_api_key' || r.clave === 'ycloud_api_key') && val) {
        val = '********';
      }
      config[r.clave] = val;
    });

    res.json(config);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
