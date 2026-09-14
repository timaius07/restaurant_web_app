const fs = require('fs');
const path = require('path');

const targetApiDir = path.join(__dirname, '../restaurant_web_api');

// 1. database_tenant_schema.sql
const databaseTenantSql = `-- Base de datos de control: guarda el directorio de todas las sodas (tenants)
CREATE DATABASE IF NOT EXISTS control_db;
USE control_db;

CREATE TABLE IF NOT EXISTS tenants (
  id INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL,
  db_schema VARCHAR(64) NOT NULL,
  workflow_type VARCHAR(50) NOT NULL DEFAULT 'estandar',
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Registra tu soda actual como el primer tenant.
-- Ajusta 'slug' al segmento de URL que quieras usar, ej: tu-soda.com/sodalatica
INSERT INTO tenants (nombre, slug, db_schema, workflow_type, activo)
VALUES ('Soda La Tica', 'sodalatica', 'restaurante_db', 'estandar', 1)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), db_schema = VALUES(db_schema), activo = VALUES(activo);
`;

// 2. db.js
const dbCode = `const mysql = require('mysql2/promise');
require('dotenv').config();

// Pool hacia la base de control (donde vive la tabla tenants)
const controlPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.CONTROL_DB_NAME || 'control_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Cache de pools por schema de tenant (ej: 'restaurante_db')
const tenantPoolCache = new Map();

function getTenantPool(dbSchema) {
  if (!dbSchema) {
    throw new Error('dbSchema requerido para getTenantPool');
  }

  if (tenantPoolCache.has(dbSchema)) {
    return tenantPoolCache.get(dbSchema);
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbSchema,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  tenantPoolCache.set(dbSchema, pool);
  return pool;
}

module.exports = {
  controlPool,
  getTenantPool,
};
`;

// 3. middlewares/tenantResolver.js
const tenantResolverCode = `const { controlPool, getTenantPool } = require('../db');

// Cache local de metadata de tenants por slug (TTL 1 min para evitar consultas excesivas a control_db)
const tenantMetaCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

async function getTenantBySlug(slug) {
  const cached = tenantMetaCache.get(slug);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  const [rows] = await controlPool.query(
    'SELECT * FROM tenants WHERE slug = ? AND activo = 1 LIMIT 1',
    [slug]
  );

  if (rows.length === 0) {
    tenantMetaCache.delete(slug);
    return null;
  }

  const tenant = rows[0];
  tenantMetaCache.set(slug, { data: tenant, timestamp: Date.now() });
  return tenant;
}

async function tenantResolverMiddleware(req, res, next) {
  try {
    const slug = req.headers['x-tenant-slug'] || req.query.tenant_slug;

    if (!slug) {
      return res.status(400).json({
        error: 'Falta el header X-Tenant-Slug identificador de la soda'
      });
    }

    const tenant = await getTenantBySlug(slug);

    if (!tenant) {
      return res.status(404).json({
        error: 'Soda no encontrada o inactiva'
      });
    }

    req.tenant = tenant;
    req.dbPool = getTenantPool(tenant.db_schema);
    req.db = req.dbPool;

    next();
  } catch (err) {
    console.error('[TenantResolver Error]:', err);
    res.status(500).json({ error: 'Error al resolver el tenant: ' + err.message });
  }
}

module.exports = tenantResolverMiddleware;
`;

// 4. routes/tenantRoutes.js (Endpoints públicos para consultar info del tenant)
const tenantRoutesCode = `const express = require('express');
const router = express.Router();
const { controlPool } = require('../db');

// GET /api/public/tenant/info/:slug
router.get('/info/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const [rows] = await controlPool.query(
      'SELECT id, nombre, slug, workflow_type, activo FROM tenants WHERE slug = ? AND activo = 1 LIMIT 1',
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Soda no encontrada' });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/public/tenant/list (Opcional: listar sodas activas para portal selector)
router.get('/list', async (req, res) => {
  try {
    const [rows] = await controlPool.query(
      'SELECT id, nombre, slug, workflow_type FROM tenants WHERE activo = 1 ORDER BY nombre ASC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
`;

// 5. routes/clientesRoutes.js
const clientesCode = `const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await req.dbPool.query('SELECT * FROM clientes');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, identificacionFiscal, telefono, email } = req.body;
    const [result] = await req.dbPool.query(
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
    await req.dbPool.query(
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
    await req.dbPool.query('DELETE FROM clientes WHERE id = ?', [id]);
    res.json({ success: true, id: Number(id) });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      return res.status(400).json({ error: 'No se puede eliminar: el cliente tiene pedidos asociados.' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
`;

// 6. routes/facturasRoutes.js
const facturasCode = `const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [facturas] = await req.dbPool.query('SELECT * FROM facturas ORDER BY fechaEmision DESC');
    for (const f of facturas) {
      const [detalles] = await req.dbPool.query('SELECT * FROM detalle_facturas WHERE facturaId = ?', [f.id]);
      f.detalles = detalles;
    }
    res.json(facturas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  let conn;
  try {
    conn = await req.dbPool.getConnection();
    if (conn.beginTransaction) await conn.beginTransaction();

    let { pedidoId, metodoPagoId, clienteId, numeroFactura, subtotal, impuestos, total, detalles } = req.body;

    const [rows] = await conn.query(
      "SELECT numeroFactura FROM facturas WHERE numeroFactura LIKE 'F-%' ORDER BY id DESC LIMIT 1"
    );
    let nextNum = 1;
    if (rows && rows.length > 0 && rows[0].numeroFactura) {
      const numOnly = rows[0].numeroFactura.replace(/\\D/g, '');
      const parsed = parseInt(numOnly, 10);
      if (!isNaN(parsed)) {
        nextNum = parsed + 1;
      }
    }

    numeroFactura = \`F-\${String(nextNum).padStart(6, '0')}\`;
    const parsedClienteId = clienteId ? Number(clienteId) : null;

    const [result] = await conn.query(
      'INSERT INTO facturas (pedidoId, metodoPagoId, clienteId, numeroFactura, subtotal, impuestos, total) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [pedidoId, metodoPagoId, parsedClienteId, numeroFactura, subtotal, impuestos, total]
    );

    const facturaId = result.insertId;
    const insertedDetalles = [];

    if (detalles && Array.isArray(detalles) && detalles.length > 0) {
      for (const item of detalles) {
        if (item.cantidad > 0) {
          const detPedidoId = item.detallePedidoId || item.detalleId || null;
          const [detResult] = await conn.query(
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

    if (conn.commit) await conn.commit();

    res.status(201).json({
      id: facturaId,
      pedidoId,
      metodoPagoId,
      clienteId: parsedClienteId,
      numeroFactura,
      subtotal,
      impuestos,
      total,
      fechaEmision: new Date().toISOString(),
      detalles: insertedDetalles
    });
  } catch (err) {
    if (conn && conn.rollback) await conn.rollback();
    console.error("Error al emitir factura:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn && conn.release) conn.release();
  }
});

module.exports = router;
`;

// 7. routes/metodosPagoRoutes.js
const metodosPagoCode = `const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await req.dbPool.query('SELECT * FROM metodos_pago');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, activo } = req.body;
    const [result] = await req.dbPool.query(
      'INSERT INTO metodos_pago (nombre, activo) VALUES (?, ?)',
      [nombre, activo !== undefined ? activo : true]
    );
    res.status(201).json({ id: result.insertId, nombre, activo: activo !== undefined ? activo : true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, activo } = req.body;
    const fields = [];
    const values = [];
    if (nombre !== undefined) { fields.push('nombre = ?'); values.push(nombre); }
    if (activo !== undefined) { fields.push('activo = ?'); values.push(activo); }
    if (fields.length === 0) return res.status(400).json({ error: 'No data to update' });
    values.push(id);
    await req.dbPool.query(\`UPDATE metodos_pago SET \${fields.join(', ')} WHERE id = ?\`, values);
    res.json({ id: Number(id), nombre, activo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await req.dbPool.query('DELETE FROM metodos_pago WHERE id = ?', [id]);
    res.json({ success: true, id: Number(id) });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      return res.status(400).json({ error: 'No se puede eliminar: el método de pago tiene facturas asociadas.' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
`;

// 8. routes/configuracionRoutes.js
const configuracionCode = `const express = require('express');
const router = express.Router();

const DEFAULT_CONFIGS = {
  nombreRestaurante: 'Soda La Tica',
  razonSocial: 'Soda La Tica S.A.',
  cedulaJuridica: '3-101-123456',
  telefono: '2222-3333',
  correo: 'contacto@sodalatica.cr',
  moneda: 'CRC',
  tasaImpuesto: '13',
  tasaCambio: '520',
  tema: 'dark'
};

async function ensureConfigTable(pool) {
  try {
    await pool.query(\`
      CREATE TABLE IF NOT EXISTS configuraciones (
        clave VARCHAR(50) PRIMARY KEY,
        valor TEXT NOT NULL
      )
    \`);
  } catch (e) {
    // Ignore if already exists
  }
}

router.get('/', async (req, res) => {
  try {
    await ensureConfigTable(req.dbPool);
    const [rows] = await req.dbPool.query('SELECT * FROM configuraciones');
    const config = { ...DEFAULT_CONFIGS };
    if (req.tenant && req.tenant.nombre) {
      config.nombreRestaurante = req.tenant.nombre;
    }
    rows.forEach(r => {
      let val = r.valor;
      if (r.clave === 'tasaImpuesto' || r.clave === 'tasaCambio') {
        const num = Number(val);
        val = isNaN(num) ? val : num;
      }
      config[r.clave] = val;
    });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', async (req, res) => {
  try {
    await ensureConfigTable(req.dbPool);
    const changes = req.body;
    if (!changes || typeof changes !== 'object') {
      return res.status(400).json({ error: 'Objeto de configuración no válido' });
    }

    for (const [clave, valor] of Object.entries(changes)) {
      if (valor !== undefined && valor !== null) {
        await req.dbPool.query(
          'INSERT INTO configuraciones (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)',
          [clave, String(valor)]
        );
      }
    }

    const [rows] = await req.dbPool.query('SELECT * FROM configuraciones');
    const config = { ...DEFAULT_CONFIGS };
    if (req.tenant && req.tenant.nombre) {
      config.nombreRestaurante = req.tenant.nombre;
    }
    rows.forEach(r => {
      let val = r.valor;
      if (r.clave === 'tasaImpuesto' || r.clave === 'tasaCambio') {
        const num = Number(val);
        val = isNaN(num) ? val : num;
      }
      config[r.clave] = val;
    });

    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
`;

// 9. routes/authRoutes.js
const authCode = `const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const RAW_KEY = process.env.PIN_SECRET_KEY || 'SodaLaTica@2025#PinKey!XZ';
const AES_KEY = crypto.createHash('sha256').update(RAW_KEY).digest();

function encryptPin(plainPin) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainPin), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return \`\${iv.toString('hex')}:\${tag.toString('hex')}:\${encrypted.toString('hex')}\`;
}

function decryptPin(stored) {
  try {
    const [ivHex, tagHex, dataHex] = stored.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', AES_KEY, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data, undefined, 'utf8') + decipher.final('utf8');
  } catch {
    return null;
  }
}

// In-memory rate-limiting tracker per tenant & user
const failedAttempts = new Map();

const getLockDurationSeconds = (attempts) => {
  if (attempts === 3) return 30;
  if (attempts === 4) return 120;
  if (attempts === 5) return 300;
  if (attempts === 6) return 600;
  return 3600;
};

// GET /api/auth/users-public: Lista de empleados para la grilla visual de inicio de sesión
router.get('/users-public', async (req, res) => {
  try {
    const [rows] = await req.dbPool.query(
      \`SELECT u.id, u.username, u.nombre, u.email, u.rolId, r.nombreRol, u.puedeCancelarServido
       FROM usuarios u
       JOIN roles r ON u.rolId = r.id
       WHERE u.activo = 1
       ORDER BY u.rolId ASC, u.nombre ASC\`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login-pin: Inicio de sesión con PIN de 4 dígitos
router.post('/login-pin', async (req, res) => {
  try {
    const { userId, pin } = req.body;
    if (!userId || !pin) {
      return res.status(400).json({ error: 'Usuario y PIN son requeridos' });
    }

    const tenantSlug = req.tenant?.slug || 'default';
    const key = \`\${tenantSlug}_\${userId}\`;
    const now = Date.now();
    const tracker = failedAttempts.get(key) || { attempts: 0, lockUntil: 0 };

    if (tracker.lockUntil > now) {
      const remainingSeconds = Math.ceil((tracker.lockUntil - now) / 1000);
      return res.status(429).json({
        error: \`Usuario bloqueado por varios intentos fallidos. Intente en \${remainingSeconds} segundos.\`,
        locked: true,
        lockSeconds: remainingSeconds
      });
    }

    const [rows] = await req.dbPool.query(
      \`SELECT u.*, r.nombreRol
       FROM usuarios u
       JOIN roles r ON u.rolId = r.id
       WHERE u.id = ? AND u.activo = 1\`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = rows[0];
    const storedPin = user.pinHash ? (user.pinHash.includes(':') ? decryptPin(user.pinHash) : user.pinHash) : null;
    const validPin = (storedPin !== null && String(storedPin) === String(pin)) || (String(user.passwordHash) === String(pin));

    if (validPin) {
      failedAttempts.delete(key);

      try {
        await req.dbPool.query(
          'INSERT INTO auditoria_logs (usuarioId, usuarioNombre, accion, detalles) VALUES (?, ?, ?, ?)',
          [user.id, user.nombre, 'LOGIN_PIN', 'Inicio de sesión con PIN']
        );
      } catch (auditErr) {
        // Auditoria opcional
      }

      const { pinHash, passwordHash, ...userInfo } = user;
      userInfo.tenantSlug = tenantSlug;
      return res.json(userInfo);
    }

    const newAttempts = tracker.attempts + 1;
    let lockSeconds = 0;
    let lockUntil = 0;

    if (newAttempts >= 3) {
      lockSeconds = getLockDurationSeconds(newAttempts);
      lockUntil = now + lockSeconds * 1000;
    }

    failedAttempts.set(key, { attempts: newAttempts, lockUntil });

    if (lockUntil > now) {
      return res.status(429).json({
        error: \`PIN incorrecto. Bloqueado \${lockSeconds}s por múltiples intentos fallidos.\`,
        locked: true,
        lockSeconds,
        attemptsLeft: 0
      });
    }

    const attemptsLeft = 3 - newAttempts;
    return res.status(401).json({
      error: \`PIN incorrecto. Le quedan \${attemptsLeft} intento(s).\`,
      locked: false,
      attemptsLeft
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login: Login tradicional con contraseña
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await req.dbPool.query(
      \`SELECT u.*, r.nombreRol
       FROM usuarios u
       JOIN roles r ON u.rolId = r.id
       WHERE u.username = ? AND (u.passwordHash = ? OR u.pinHash = ?)\`,
      [username, password, password]
    );

    if (rows.length > 0) {
      const user = rows[0];
      try {
        await req.dbPool.query(
          'INSERT INTO auditoria_logs (usuarioId, usuarioNombre, accion, detalles) VALUES (?, ?, ?, ?)',
          [user.id, user.nombre, 'LOGIN_PASSWORD', 'Inicio de sesión tradicional']
        );
      } catch (e) {}

      const { passwordHash, pinHash, ...userInfo } = user;
      userInfo.tenantSlug = req.tenant?.slug || 'default';
      res.json(userInfo);
    } else {
      res.status(401).json({ error: 'Credenciales inválidas' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
`;

// 10. routes/auditoriaRoutes.js
const auditoriaCode = `const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await req.dbPool.query('SELECT * FROM auditoria_logs ORDER BY fecha DESC LIMIT 100');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { usuarioId, usuarioNombre, accion, detalles } = req.body;
    if (!accion) return res.status(400).json({ error: 'Acción requerida' });

    const [result] = await req.dbPool.query(
      'INSERT INTO auditoria_logs (usuarioId, usuarioNombre, accion, detalles) VALUES (?, ?, ?, ?)',
      [usuarioId || null, usuarioNombre || 'Sistema', accion, detalles || '']
    );

    res.status(201).json({ id: result.insertId, usuarioId, usuarioNombre, accion, detalles, fecha: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
`;

// 11. routes/usuariosRoutes.js
const usuariosCode = `const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await req.dbPool.query(
      \`SELECT u.id, u.username, u.nombre, u.email, u.rolId, u.activo, u.puedeCancelarServido, u.pinHash, r.nombreRol
       FROM usuarios u
       JOIN roles r ON u.rolId = r.id\`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { username, passwordHash, pinHash, email, nombre, rolId, puedeCancelarServido } = req.body;
    const [result] = await req.dbPool.query(
      'INSERT INTO usuarios (username, passwordHash, pinHash, email, nombre, rolId, puedeCancelarServido) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, passwordHash || '1234', pinHash || '1234', email || '', nombre, Number(rolId), puedeCancelarServido ? 1 : 0]
    );
    res.status(201).json({ id: result.insertId, username, email, nombre, rolId: Number(rolId), puedeCancelarServido, pinHash: pinHash || '1234' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, passwordHash, pinHash, email, nombre, rolId, puedeCancelarServido, activo } = req.body;

    const fields = [];
    const values = [];
    if (username !== undefined) { fields.push('username = ?'); values.push(username); }
    if (passwordHash) { fields.push('passwordHash = ?'); values.push(passwordHash); }
    if (pinHash) { fields.push('pinHash = ?'); values.push(pinHash); }
    if (email !== undefined) { fields.push('email = ?'); values.push(email); }
    if (nombre !== undefined) { fields.push('nombre = ?'); values.push(nombre); }
    if (rolId !== undefined) { fields.push('rolId = ?'); values.push(Number(rolId)); }
    if (puedeCancelarServido !== undefined) { fields.push('puedeCancelarServido = ?'); values.push(puedeCancelarServido ? 1 : 0); }
    if (activo !== undefined) { fields.push('activo = ?'); values.push(activo ? 1 : 0); }

    if (fields.length === 0) return res.status(400).json({ error: 'No data to update' });
    values.push(id);
    await req.dbPool.query(\`UPDATE usuarios SET \${fields.join(', ')} WHERE id = ?\`, values);
    res.json({ id: Number(id), success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await req.dbPool.query('DELETE FROM usuarios WHERE id = ?', [id]);
    res.json({ success: true, id: Number(id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
`;

// 12. routes/mesasRoutes.js
const mesasCode = `const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await req.dbPool.query('SELECT * FROM mesas ORDER BY numeroMesa');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { numeroMesa, capacidad, estado } = req.body;
    const [result] = await req.dbPool.query(
      'INSERT INTO mesas (numeroMesa, capacidad, estado) VALUES (?, ?, ?)',
      [numeroMesa, capacidad, estado || 'Libre']
    );
    res.status(201).json({ id: result.insertId, numeroMesa, capacidad, estado: estado || 'Libre' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { numeroMesa, capacidad, estado } = req.body;
    const updates = [];
    const values = [];

    if (numeroMesa !== undefined) { updates.push('numeroMesa = ?'); values.push(numeroMesa); }
    if (capacidad !== undefined) { updates.push('capacidad = ?'); values.push(capacidad); }
    if (estado !== undefined) { updates.push('estado = ?'); values.push(estado); }

    if (updates.length > 0) {
      values.push(req.params.id);
      await req.dbPool.query(\`UPDATE mesas SET \${updates.join(', ')} WHERE id = ?\`, values);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await req.dbPool.query('DELETE FROM mesas WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
`;

// 13. routes/categoriasRoutes.js
const categoriasCode = `const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await req.dbPool.query('SELECT * FROM categorias');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre } = req.body;
    const [result] = await req.dbPool.query('INSERT INTO categorias (nombre) VALUES (?)', [nombre]);
    res.status(201).json({ id: result.insertId, nombre });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
`;

// 14. routes/productosRoutes.js
const productosCode = `const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await req.dbPool.query('SELECT * FROM productos WHERE activo = TRUE');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, descripcion, precioUnitario, categoriaId } = req.body;
    const [result] = await req.dbPool.query(
      'INSERT INTO productos (nombre, descripcion, precioUnitario, categoriaId) VALUES (?, ?, ?, ?)',
      [nombre, descripcion, precioUnitario, categoriaId]
    );
    res.status(201).json({ id: result.insertId, nombre, descripcion, precioUnitario, categoriaId, activo: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
`;

// 15. routes/pedidosRoutes.js
const pedidosCode = `const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [pedidos] = await req.dbPool.query('SELECT * FROM pedidos ORDER BY fechaApertura DESC');
    res.json(pedidos);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { mesaId, usuarioId, clienteId, tipoPedido } = req.body;
    const [result] = await req.dbPool.query(
      'INSERT INTO pedidos (mesaId, usuarioId, clienteId, tipoPedido) VALUES (?, ?, ?, ?)',
      [mesaId || null, usuarioId, clienteId, tipoPedido || 'Local']
    );
    res.status(201).json({ id: result.insertId, mesaId, usuarioId, clienteId, tipoPedido, estado: 'Abierto' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { estado, notificarCocina } = req.body;
    const updates = [];
    const values = [];
    if (estado !== undefined) {
      updates.push('estado = ?');
      values.push(estado);
    }
    if (notificarCocina !== undefined) {
      updates.push('notificarCocina = ?');
      values.push(notificarCocina ? 1 : 0);
    }
    if (updates.length > 0) {
      values.push(req.params.id);
      await req.dbPool.query(\`UPDATE pedidos SET \${updates.join(', ')} WHERE id = ?\`, values);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/detalles', async (req, res) => {
  try {
    const [detalles] = await req.dbPool.query('SELECT * FROM detalle_pedidos WHERE pedidoId = ?', [req.params.id]);
    res.json(detalles);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/detalles', async (req, res) => {
  try {
    const { productoId, cantidad, notas } = req.body;
    const [prods] = await req.dbPool.query('SELECT precioUnitario FROM productos WHERE id = ?', [productoId]);
    const precio = prods[0]?.precioUnitario || 0;

    const [result] = await req.dbPool.query(
      'INSERT INTO detalle_pedidos (pedidoId, productoId, cantidad, precioMomento, notas) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, productoId, cantidad, precio, notas]
    );
    res.status(201).json({ id: result.insertId, pedidoId: req.params.id, productoId, cantidad, precioMomento: precio, notas });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/detalles/:id', async (req, res) => {
  try {
    const { cantidad, cantidadFacturada } = req.body;
    const updates = [];
    const values = [];
    if (cantidad !== undefined) { updates.push('cantidad = ?'); values.push(cantidad); }
    if (cantidadFacturada !== undefined) { updates.push('cantidadFacturada = ?'); values.push(cantidadFacturada); }

    if (updates.length > 0) {
      values.push(req.params.id);
      await req.dbPool.query(\`UPDATE detalle_pedidos SET \${updates.join(', ')} WHERE id = ?\`, values);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/detalles/:id', async (req, res) => {
  try {
    await req.dbPool.query('DELETE FROM detalle_pedidos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
`;

// 16. server.js
const serverCode = `const express = require('express');
const cors = require('cors');
require('dotenv').config();

const tenantResolverMiddleware = require('./middlewares/tenantResolver');
const tenantRoutes = require('./routes/tenantRoutes');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// 1. Health check & Public Routes (no requieren header de tenant)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});
app.use('/api/public/tenant', tenantRoutes);

// 2. Middleware de resolución dinámica de Tenant para el resto de la API
app.use(tenantResolverMiddleware);

// 3. Rutas de Negocio Aisladas por Tenant
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/mesas', require('./routes/mesasRoutes'));
app.use('/api/categorias', require('./routes/categoriasRoutes'));
app.use('/api/productos', require('./routes/productosRoutes'));
app.use('/api/clientes', require('./routes/clientesRoutes'));
app.use('/api/pedidos', require('./routes/pedidosRoutes'));
app.use('/api/facturas', require('./routes/facturasRoutes'));
app.use('/api/metodos-pago', require('./routes/metodosPagoRoutes'));
app.use('/api/configuracion', require('./routes/configuracionRoutes'));
app.use('/api/auditoria', require('./routes/auditoriaRoutes'));
app.use('/api/usuarios', require('./routes/usuariosRoutes'));

app.listen(port, () => {
  console.log(\`API Multi-Tenant running on http://localhost:\${port}\`);
});
`;

// Ensure directories exist
const middlewaresDir = path.join(targetApiDir, 'middlewares');
if (!fs.existsSync(middlewaresDir)) {
  fs.mkdirSync(middlewaresDir, { recursive: true });
}

// Write files
fs.copyFileSync(path.join(__dirname, 'database_schema.sql'), path.join(targetApiDir, 'database_schema.sql'));
fs.writeFileSync(path.join(targetApiDir, 'database_tenant_schema.sql'), databaseTenantSql);
fs.writeFileSync(path.join(targetApiDir, 'db.js'), dbCode);
fs.writeFileSync(path.join(targetApiDir, 'middlewares/tenantResolver.js'), tenantResolverCode);
fs.writeFileSync(path.join(targetApiDir, 'routes/tenantRoutes.js'), tenantRoutesCode);
fs.writeFileSync(path.join(targetApiDir, 'routes/clientesRoutes.js'), clientesCode);
fs.writeFileSync(path.join(targetApiDir, 'routes/facturasRoutes.js'), facturasCode);
fs.writeFileSync(path.join(targetApiDir, 'routes/metodosPagoRoutes.js'), metodosPagoCode);
fs.writeFileSync(path.join(targetApiDir, 'routes/configuracionRoutes.js'), configuracionCode);
fs.writeFileSync(path.join(targetApiDir, 'routes/authRoutes.js'), authCode);
fs.writeFileSync(path.join(targetApiDir, 'routes/auditoriaRoutes.js'), auditoriaCode);
fs.writeFileSync(path.join(targetApiDir, 'routes/usuariosRoutes.js'), usuariosCode);
fs.writeFileSync(path.join(targetApiDir, 'routes/mesasRoutes.js'), mesasCode);
fs.writeFileSync(path.join(targetApiDir, 'routes/categoriasRoutes.js'), categoriasCode);
fs.writeFileSync(path.join(targetApiDir, 'routes/productosRoutes.js'), productosCode);
fs.writeFileSync(path.join(targetApiDir, 'routes/pedidosRoutes.js'), pedidosCode);
fs.writeFileSync(path.join(targetApiDir, 'server.js'), serverCode);

console.log('Successfully updated restaurant_web_api with Multi-Tenant architecture!');
