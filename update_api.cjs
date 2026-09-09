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

// Auto-migrate: Ensure clienteId column exists in facturas table
(async () => {
  try {
    const [cols] = await db.query("SHOW COLUMNS FROM facturas LIKE 'clienteId'");
    if (cols.length === 0) {
      await db.query("ALTER TABLE facturas ADD COLUMN clienteId INT NULL AFTER pedidoId");
      console.log("Added clienteId column to facturas table");
    }
  } catch (err) {
    console.error("Error checking/adding clienteId column to facturas:", err);
  }
})();

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
  const conn = await db.getConnection ? await db.getConnection() : db;
  try {
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
    if (conn.rollback) await conn.rollback();
    console.error("Error al emitir factura:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn.release) conn.release();
  }
});

module.exports = router;`;

const metodosPagoCode = `const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM metodos_pago');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, activo } = req.body;
    const [result] = await db.query(
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
    await db.query(\`UPDATE metodos_pago SET \${fields.join(', ')} WHERE id = ?\`, values);
    res.json({ id: Number(id), nombre, activo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM metodos_pago WHERE id = ?', [id]);
    res.json({ success: true, id: Number(id) });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      return res.status(400).json({ error: 'No se puede eliminar: el método de pago tiene facturas asociadas.' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;`;

const configuracionCode = `const express = require('express');
const router = express.Router();
const db = require('../db');

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

(async () => {
  try {
    await db.query(\`
      CREATE TABLE IF NOT EXISTS configuraciones (
        clave VARCHAR(50) PRIMARY KEY,
        valor TEXT NOT NULL
      )
    \`);
    const [rows] = await db.query('SELECT clave FROM configuraciones');
    if (rows.length === 0) {
      for (const [clave, valor] of Object.entries(DEFAULT_CONFIGS)) {
        await db.query(
          'INSERT INTO configuraciones (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)',
          [clave, String(valor)]
        );
      }
      console.log('Tabla configuraciones creada e inicializada.');
    }
  } catch (err) {
    console.error('Error al inicializar la tabla configuraciones:', err);
  }
})();

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM configuraciones');
    const config = { ...DEFAULT_CONFIGS };
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
    const changes = req.body;
    if (!changes || typeof changes !== 'object') {
      return res.status(400).json({ error: 'Objeto de configuración no válido' });
    }

    for (const [clave, valor] of Object.entries(changes)) {
      if (valor !== undefined && valor !== null) {
        await db.query(
          'INSERT INTO configuraciones (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)',
          [clave, String(valor)]
        );
      }
    }

    const [rows] = await db.query('SELECT * FROM configuraciones');
    const config = { ...DEFAULT_CONFIGS };
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

module.exports = router;`;

const authCode = `const express = require('express');
const router = express.Router();
const db = require('../db');

// In-memory tracker for rate limiting PIN login attempts per user
const failedAttempts = new Map();

const getLockDurationSeconds = (attempts) => {
  if (attempts === 3) return 30; // 30 seconds
  if (attempts === 4) return 120; // 2 minutes
  if (attempts === 5) return 300; // 5 minutes
  if (attempts === 6) return 600; // 10 minutes
  return 3600; // 1 hour for 7+ attempts
};

// Auto-migrate: Ensure pinHash column and auditoria_logs table exist
(async () => {
  try {
    const [cols] = await db.query("SHOW COLUMNS FROM usuarios LIKE 'pinHash'");
    if (cols.length === 0) {
      await db.query("ALTER TABLE usuarios ADD COLUMN pinHash VARCHAR(255) NULL AFTER passwordHash");
      console.log("Added pinHash column to usuarios table");
    }

    // Set default seed PINs if NULL
    await db.query("UPDATE usuarios SET pinHash = '1234' WHERE username = 'admin' AND (pinHash IS NULL OR pinHash = '')");
    await db.query("UPDATE usuarios SET pinHash = '1111' WHERE username = 'mesero1' AND (pinHash IS NULL OR pinHash = '')");
    await db.query("UPDATE usuarios SET pinHash = '2222' WHERE username = 'cocina1' AND (pinHash IS NULL OR pinHash = '')");
    await db.query("UPDATE usuarios SET pinHash = '3333' WHERE username = 'cajero1' AND (pinHash IS NULL OR pinHash = '')");

    // Table auditoria_logs
    await db.query(\`
      CREATE TABLE IF NOT EXISTS auditoria_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuarioId INT NULL,
        usuarioNombre VARCHAR(100),
        accion VARCHAR(100) NOT NULL,
        detalles TEXT,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    \`);
  } catch (err) {
    console.error("Error auto-migrating auth / auditoria:", err);
  }
})();

// GET /api/auth/users-public: Lista de empleados para la grilla visual de inicio de sesión
router.get('/users-public', async (req, res) => {
  try {
    const [rows] = await db.query(
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

// POST /api/auth/login-pin: Inicio de sesión con PIN de 4 dígitos y bloqueo por intentos fallidos
router.post('/login-pin', async (req, res) => {
  try {
    const { userId, pin } = req.body;
    if (!userId || !pin) {
      return res.status(400).json({ error: 'Usuario y PIN de 4 dígitos son requeridos' });
    }

    const key = String(userId);
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

    const [rows] = await db.query(
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
    const validPin = (user.pinHash && String(user.pinHash) === String(pin)) || (String(user.passwordHash) === String(pin));

    if (validPin) {
      failedAttempts.delete(key);

      // Registrar en auditoría
      await db.query(
        'INSERT INTO auditoria_logs (usuarioId, usuarioNombre, accion, detalles) VALUES (?, ?, ?, ?)',
        [user.id, user.nombre, 'LOGIN_PIN', 'Inicio de sesión con PIN de 4 dígitos']
      );

      const { passwordHash, pinHash, ...userInfo } = user;
      return res.json(userInfo);
    } else {
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
          error: \`PIN incorrecto. Usuario bloqueado por \${lockSeconds} segundos debido a 3 o más intentos fallidos.\`,
          locked: true,
          lockSeconds,
          attemptsLeft: 0
        });
      }

      const attemptsLeft = 3 - newAttempts;
      return res.status(401).json({
        error: \`PIN incorrecto. Le quedan \${attemptsLeft} intento(s) antes del bloqueo.\`,
        locked: false,
        attemptsLeft
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login: Login tradicional usuario/contraseña
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await db.query(
      \`SELECT u.*, r.nombreRol 
       FROM usuarios u 
       JOIN roles r ON u.rolId = r.id 
       WHERE u.username = ? AND (u.passwordHash = ? OR u.pinHash = ?)\`, 
      [username, password, password]
    );

    if (rows.length > 0) {
      const user = rows[0];
      await db.query(
        'INSERT INTO auditoria_logs (usuarioId, usuarioNombre, accion, detalles) VALUES (?, ?, ?, ?)',
        [user.id, user.nombre, 'LOGIN_PASSWORD', 'Inicio de sesión tradicional']
      );

      const { passwordHash, pinHash, ...userInfo } = user;
      res.json(userInfo);
    } else {
      res.status(401).json({ error: 'Credenciales inválidas' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;`;

const auditoriaCode = `const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/auditoria
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM auditoria_logs ORDER BY fecha DESC LIMIT 100');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auditoria
router.post('/', async (req, res) => {
  try {
    const { usuarioId, usuarioNombre, accion, detalles } = req.body;
    if (!accion) return res.status(400).json({ error: 'Acción requerida' });

    const [result] = await db.query(
      'INSERT INTO auditoria_logs (usuarioId, usuarioNombre, accion, detalles) VALUES (?, ?, ?, ?)',
      [usuarioId || null, usuarioNombre || 'Sistema', accion, detalles || '']
    );

    res.status(201).json({ id: result.insertId, usuarioId, usuarioNombre, accion, detalles, fecha: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;`;

const usuariosCode = `const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
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
    const [result] = await db.query(
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
    await db.query(\`UPDATE usuarios SET \${fields.join(', ')} WHERE id = ?\`, values);
    res.json({ id: Number(id), success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM usuarios WHERE id = ?', [id]);
    res.json({ success: true, id: Number(id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;`;

const serverCode = `const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
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
  console.log(\`API running on http://localhost:\${port}\`);
});
`;

fs.writeFileSync(path.join(__dirname, '../restaurant_web_api/routes/clientesRoutes.js'), clientesCode);
fs.writeFileSync(path.join(__dirname, '../restaurant_web_api/routes/facturasRoutes.js'), facturasCode);
fs.writeFileSync(path.join(__dirname, '../restaurant_web_api/routes/metodosPagoRoutes.js'), metodosPagoCode);
fs.writeFileSync(path.join(__dirname, '../restaurant_web_api/routes/configuracionRoutes.js'), configuracionCode);
fs.writeFileSync(path.join(__dirname, '../restaurant_web_api/routes/authRoutes.js'), authCode);
fs.writeFileSync(path.join(__dirname, '../restaurant_web_api/routes/auditoriaRoutes.js'), auditoriaCode);
fs.writeFileSync(path.join(__dirname, '../restaurant_web_api/routes/usuariosRoutes.js'), usuariosCode);
fs.writeFileSync(path.join(__dirname, '../restaurant_web_api/server.js'), serverCode);

console.log('All backend routes (auth, auditoria, usuarios, etc.) updated successfully!');
