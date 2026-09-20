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

-- Registra tu soda actual como el primer tenant
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
const schemaChecked = new Set();

// Asegura compatibilidad de columnas e índices necesarios sin romper datos existentes
async function ensureTenantSchema(pool, dbSchema) {
  if (schemaChecked.has(dbSchema)) return;
  try {
    // 1. Asegurar columna passwordHash en usuarios
    const [cols] = await pool.query("SHOW COLUMNS FROM usuarios LIKE 'passwordHash'");
    if (cols.length === 0) {
      await pool.query("ALTER TABLE usuarios ADD COLUMN passwordHash VARCHAR(255) DEFAULT NULL AFTER username");
      console.log(\`[DB] Columna passwordHash agregada exitosamente a \${dbSchema}.usuarios\`);
    }

    // 2. Asegurar índice compuesto en pedidos (estado, fechaApertura)
    const [indexes] = await pool.query("SHOW INDEX FROM pedidos WHERE Key_name = 'idx_pedidos_estado_fecha'");
    if (indexes.length === 0) {
      await pool.query("CREATE INDEX idx_pedidos_estado_fecha ON pedidos (estado, fechaApertura)");
      console.log(\`[DB] Índice idx_pedidos_estado_fecha creado en \${dbSchema}.pedidos\`);
    }

    schemaChecked.add(dbSchema);
  } catch (err) {
    // Si la tabla no existe aún (ej: recién inicializando), ignorar silenciosamente
    console.warn(\`[DB Schema Check \${dbSchema}]: \${err.message}\`);
  }
}

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

  ensureTenantSchema(pool, dbSchema).catch(e => console.error(e));

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

// 4. middlewares/authMiddleware.js
const authMiddlewareCode = `const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'SodaLaTica@2026#SecretJwtKey!Prod';

// Extrae y valida el token si existe (sin bloquear peticiones anónimas que lo necesiten opcionalmente)
function authenticateToken(req, res, next) {
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.auth_token) {
    token = req.cookies.auth_token;
  }

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      req.user = null;
    } else {
      req.user = decoded;
    }
    next();
  });
}

// Exige autenticación obligatoria para rutas protegidas
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Sesión no válida o expirada. Por favor inicie sesión nuevamente.'
    });
  }
  next();
}

// Exige que el usuario posea al menos uno de los roles permitidos
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Sesión no válida o expirada. Por favor inicie sesión nuevamente.'
      });
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.nombreRol)) {
      return res.status(403).json({
        error: 'Acceso denegado: su rol no tiene permisos para realizar esta acción.'
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  requireAuth,
  requireRole,
  JWT_SECRET
};
`;

// 5. middlewares/errorHandler.js
const errorHandlerCode = `// Manejador centralizado de errores para evitar fuga de información de MySQL
function errorHandler(err, req, res, next) {
  console.error('[API Error]:', err.stack || err);

  // Conflicto por restricción de clave foránea (MySQL ER_ROW_IS_REFERENCED_2)
  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
    return res.status(409).json({
      error: 'No se puede eliminar o modificar el registro porque tiene otros registros asociados.'
    });
  }

  // Entrada duplicada (MySQL ER_DUP_ENTRY)
  if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
    return res.status(409).json({
      error: 'Ya existe un registro con esos datos (valor duplicado).'
    });
  }

  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      error: 'El archivo adjunto es demasiado grande para enviarlo.'
    });
  }

  // Si el error ya tiene status HTTP controlado
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }

  // Error genérico sin exponer detalles internos de SQL al cliente
  res.status(500).json({
    error: 'Ocurrió un error en el servidor. Por favor intente más tarde.'
  });
}

// Manejador de rutas no encontradas (404)
function notFoundHandler(req, res) {
  res.status(404).json({
    error: \`Ruta no encontrada: \${req.method} \${req.originalUrl}\`
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
`;

// 6. routes/tenantRoutes.js
const tenantRoutesCode = `const express = require('express');
const router = express.Router();
const { controlPool } = require('../db');

// GET /api/public/tenant/info/:slug
router.get('/info/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const [rows] = await controlPool.query(
      'SELECT id, nombre, slug, workflow_type, activo FROM tenants WHERE slug = ? AND activo = 1 LIMIT 1',
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Soda no encontrada o inactiva' });
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/public/tenant/list
router.get('/list', async (req, res, next) => {
  try {
    const [rows] = await controlPool.query(
      'SELECT id, nombre, slug, workflow_type FROM tenants WHERE activo = 1 ORDER BY nombre ASC'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
`;

// 7. routes/authRoutes.js
const authCode = `const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { JWT_SECRET } = require('../middlewares/authMiddleware');

const RAW_KEY = process.env.PIN_SECRET_KEY || 'SodaLaTica@2025#PinKey!XZ';
const AES_KEY = crypto.createHash('sha256').update(RAW_KEY).digest();

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

// Rate Limiter estricto para intentos de login por IP
const isDev = process.env.NODE_ENV !== 'production';
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: isDev ? 1000 : 30, // Más permisivo en desarrollo local para pruebas
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de autenticación desde esta IP. Intente de nuevo en 15 minutos.' }
});

// Tracker en memoria por usuario para lockout progresivo de PIN
const failedAttempts = new Map();

const getLockDurationSeconds = (attempts) => {
  if (attempts === 3) return 30;
  if (attempts === 4) return 120;
  if (attempts === 5) return 300;
  if (attempts === 6) return 600;
  return 3600;
};

// Generador de JWT seguro y configuración de cookie HttpOnly
function generateAuthResponse(res, user, tenantSlug) {
  const payload = {
    id: user.id,
    username: user.username,
    nombre: user.nombre,
    email: user.email,
    rolId: user.rolId,
    nombreRol: user.nombreRol,
    puedeCancelarServido: user.puedeCancelarServido,
    tenantSlug
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

  // Cookie HttpOnly segura
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000
  });

  return {
    success: true,
    token,
    ...payload
  };
}

// GET /api/auth/roles-public: Lista de roles públicos para la pantalla de login
router.get('/roles-public', async (req, res, next) => {
  try {
    const [rows] = await req.dbPool.query(
      'SELECT * FROM roles ORDER BY id ASC'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/users-public: Lista de empleados para la grilla visual de inicio de sesión
router.get('/users-public', async (req, res, next) => {
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
    next(err);
  }
});

// POST /api/auth/login-pin: Inicio de sesión con PIN de 4 dígitos
router.post('/login-pin', authLimiter, async (req, res, next) => {
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
    let validPin = false;
    let shouldMigrateHash = false;

    if (user.pinHash) {
      if (user.pinHash.startsWith('$2a$') || user.pinHash.startsWith('$2b$')) {
        // Formato seguro bcrypt
        validPin = bcrypt.compareSync(String(pin), user.pinHash);
      } else if (user.pinHash.includes(':')) {
        // Formato legado AES
        const decrypted = decryptPin(user.pinHash);
        if (decrypted !== null && String(decrypted) === String(pin)) {
          validPin = true;
          shouldMigrateHash = true;
        }
      } else if (String(user.pinHash) === String(pin)) {
        // Texto plano legado
        validPin = true;
        shouldMigrateHash = true;
      }
    }

    // Compatibilidad: si el PIN coincide con passwordHash legado
    if (!validPin && user.passwordHash && String(user.passwordHash) === String(pin)) {
      validPin = true;
      shouldMigrateHash = true;
    }

    if (validPin) {
      failedAttempts.delete(key);

      // Migrar automáticamente al hash bcrypt seguro para el futuro
      if (shouldMigrateHash) {
        const newHash = bcrypt.hashSync(String(pin), 10);
        await req.dbPool.query('UPDATE usuarios SET pinHash = ? WHERE id = ?', [newHash, user.id]).catch(() => {});
      }

      try {
        await req.dbPool.query(
          'INSERT INTO auditoria_logs (usuarioId, usuarioNombre, accion, detalles) VALUES (?, ?, ?, ?)',
          [user.id, user.nombre, 'LOGIN_PIN', 'Inicio de sesión con PIN']
        );
      } catch (auditErr) {}

      const authData = generateAuthResponse(res, user, tenantSlug);
      return res.json(authData);
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
    next(err);
  }
});

// POST /api/auth/login: Login tradicional con usuario y contraseña
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    const [rows] = await req.dbPool.query(
      \`SELECT u.*, r.nombreRol
       FROM usuarios u
       JOIN roles r ON u.rolId = r.id
       WHERE u.username = ? AND u.activo = 1\`,
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = rows[0];
    let validPassword = false;
    let shouldMigratePassword = false;

    if (user.passwordHash) {
      if (user.passwordHash.startsWith('$2a$') || user.passwordHash.startsWith('$2b$')) {
        validPassword = bcrypt.compareSync(password, user.passwordHash);
      } else if (user.passwordHash === password) {
        validPassword = true;
        shouldMigratePassword = true;
      }
    } else if (user.pinHash) {
      // Fallback si la soda solo tenía configurado PIN
      if (user.pinHash.includes(':')) {
        const decrypted = decryptPin(user.pinHash);
        if (decrypted && decrypted === password) {
          validPassword = true;
          shouldMigratePassword = true;
        }
      } else if (user.pinHash === password) {
        validPassword = true;
        shouldMigratePassword = true;
      }
    }

    if (validPassword) {
      if (shouldMigratePassword) {
        const newHash = bcrypt.hashSync(password, 10);
        await req.dbPool.query('UPDATE usuarios SET passwordHash = ? WHERE id = ?', [newHash, user.id]).catch(() => {});
      }

      try {
        await req.dbPool.query(
          'INSERT INTO auditoria_logs (usuarioId, usuarioNombre, accion, detalles) VALUES (?, ?, ?, ?)',
          [user.id, user.nombre, 'LOGIN_PASSWORD', 'Inicio de sesión tradicional']
        );
      } catch (e) {}

      const tenantSlug = req.tenant?.slug || 'default';
      const authData = generateAuthResponse(res, user, tenantSlug);
      return res.json(authData);
    }

    return res.status(401).json({ error: 'Credenciales inválidas' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout: Cierre de sesión y limpieza de cookies
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true, message: 'Sesión cerrada correctamente' });
});

module.exports = router;
`;

// 8. routes/usuariosRoutes.js
const usuariosCode = `const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');

// Solo los Administradores pueden gestionar usuarios
router.use(requireAuth);
router.use(requireRole('Admin'));

// GET /api/usuarios: Excluye hashes y contraseñas por seguridad
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await req.dbPool.query(
      \`SELECT u.id, u.username, u.nombre, u.email, u.rolId, u.activo, u.puedeCancelarServido, 
              (u.pinHash IS NOT NULL AND u.pinHash != '') AS tienePin,
              r.nombreRol
       FROM usuarios u
       JOIN roles r ON u.rolId = r.id
       ORDER BY u.rolId ASC, u.nombre ASC\`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/usuarios: Creación con hashing seguro
router.post('/', async (req, res, next) => {
  try {
    const { username, passwordHash, pinHash, email, nombre, rolId, puedeCancelarServido } = req.body;

    if (!username || !nombre || !rolId) {
      return res.status(400).json({ error: 'Nombre, usuario y rol son requeridos' });
    }

    // Hashear con bcrypt
    const passwordToHash = passwordHash || 'Cambiar123!';
    const hashedPass = bcrypt.hashSync(passwordToHash, 10);
    const hashedPin = pinHash ? bcrypt.hashSync(String(pinHash), 10) : null;

    const [result] = await req.dbPool.query(
      'INSERT INTO usuarios (username, passwordHash, pinHash, email, nombre, rolId, puedeCancelarServido, activo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
      [username.trim(), hashedPass, hashedPin, email ? email.trim() : '', nombre.trim(), Number(rolId), puedeCancelarServido ? 1 : 0]
    );

    res.status(201).json({
      id: result.insertId,
      username: username.trim(),
      email: email || '',
      nombre: nombre.trim(),
      rolId: Number(rolId),
      puedeCancelarServido: !!puedeCancelarServido,
      tienePin: !!hashedPin
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/usuarios/:id: Actualización segura
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { username, passwordHash, pinHash, email, nombre, rolId, puedeCancelarServido, activo } = req.body;

    const fields = [];
    const values = [];

    if (username !== undefined) { fields.push('username = ?'); values.push(username.trim()); }
    if (passwordHash) { fields.push('passwordHash = ?'); values.push(bcrypt.hashSync(passwordHash, 10)); }
    if (pinHash) { fields.push('pinHash = ?'); values.push(bcrypt.hashSync(String(pinHash), 10)); }
    if (email !== undefined) { fields.push('email = ?'); values.push(email.trim()); }
    if (nombre !== undefined) { fields.push('nombre = ?'); values.push(nombre.trim()); }
    if (rolId !== undefined) { fields.push('rolId = ?'); values.push(Number(rolId)); }
    if (puedeCancelarServido !== undefined) { fields.push('puedeCancelarServido = ?'); values.push(puedeCancelarServido ? 1 : 0); }
    if (activo !== undefined) { fields.push('activo = ?'); values.push(activo ? 1 : 0); }

    if (fields.length === 0) return res.status(400).json({ error: 'No hay datos para actualizar' });

    values.push(id);
    await req.dbPool.query(\`UPDATE usuarios SET \${fields.join(', ')} WHERE id = ?\`, values);

    res.json({ id: Number(id), success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/usuarios/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Evitar que el admin actual se auto-elimine
    if (req.user && String(req.user.id) === String(id)) {
      return res.status(400).json({ error: 'No puede eliminar su propia cuenta de usuario' });
    }

    await req.dbPool.query('DELETE FROM usuarios WHERE id = ?', [id]);
    res.json({ success: true, id: Number(id) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
`;

// 9. routes/facturasRoutes.js (Fix N+1 y filtros)
const facturasCode = `const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');

router.use(requireAuth);

// GET /api/facturas: Resuelve el N+1 trayendo los detalles en una sola consulta por lotes
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = parseInt(req.query.offset, 10) || 0;

    let query = 'SELECT * FROM facturas';
    const params = [];

    if (req.query.fechaDesde && req.query.fechaHasta) {
      query += ' WHERE fechaEmision BETWEEN ? AND ?';
      params.push(req.query.fechaDesde, req.query.fechaHasta);
    }

    query += ' ORDER BY fechaEmision DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [facturas] = await req.dbPool.query(query, params);

    // Resolver N+1 con un único SELECT IN
    if (facturas.length > 0) {
      const facturaIds = facturas.map(f => f.id);
      const [allDetalles] = await req.dbPool.query(
        'SELECT * FROM detalle_facturas WHERE facturaId IN (?)',
        [facturaIds]
      );

      const detallesByFactura = {};
      for (const d of allDetalles) {
        if (!detallesByFactura[d.facturaId]) {
          detallesByFactura[d.facturaId] = [];
        }
        detallesByFactura[d.facturaId].push(d);
      }

      for (const f of facturas) {
        f.detalles = detallesByFactura[f.id] || [];
      }
    }

    res.json(facturas);
  } catch (err) {
    next(err);
  }
});

// POST /api/facturas: Transacción protegida con bloqueo FOR UPDATE
router.post('/', requireRole('Admin', 'Cajero'), async (req, res, next) => {
  let conn;
  try {
    conn = await req.dbPool.getConnection();
    if (conn.beginTransaction) await conn.beginTransaction();

    let { pedidoId, metodoPagoId, clienteId, subtotal, impuestos, servicio, total, detalles } = req.body;

    if (!pedidoId || !metodoPagoId) {
      if (conn) conn.release();
      return res.status(400).json({ error: 'pedidoId y metodoPagoId son obligatorios' });
    }

    // Bloqueo a nivel de fila para evitar duplicación con concurrencia
    const [rows] = await conn.query(
      "SELECT numeroFactura FROM facturas WHERE numeroFactura LIKE 'F-%' ORDER BY id DESC LIMIT 1 FOR UPDATE"
    );

    let nextNum = 1;
    if (rows && rows.length > 0 && rows[0].numeroFactura) {
      const numOnly = rows[0].numeroFactura.replace(/\\D/g, '');
      const parsed = parseInt(numOnly, 10);
      if (!isNaN(parsed)) {
        nextNum = parsed + 1;
      }
    }

    const numeroFactura = \`F-\${String(nextNum).padStart(6, '0')}\`;
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
      servicio: servicio || 0,
      total,
      fechaEmision: new Date().toISOString(),
      detalles: insertedDetalles
    });
  } catch (err) {
    if (conn && conn.rollback) await conn.rollback();
    next(err);
  } finally {
    if (conn && conn.release) conn.release();
  }
});

module.exports = router;
`;

// 10. routes/pedidosRoutes.js
const pedidosCode = `const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/authMiddleware');

router.use(requireAuth);

// GET /api/pedidos: Soporte para filtro por estado (ej: ?estado=Abierto,Preparando,Servido) y límite
router.get('/', async (req, res, next) => {
  try {
    let query = 'SELECT * FROM pedidos';
    const params = [];

    if (req.query.estado) {
      const estados = req.query.estado.split(',').map(s => s.trim());
      query += ' WHERE estado IN (?)';
      params.push(estados);
    }

    query += ' ORDER BY fechaApertura DESC';

    if (req.query.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(req.query.limit, 10));
    }

    const [pedidos] = await req.dbPool.query(query, params);
    res.json(pedidos);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { mesaId, usuarioId, clienteId, tipoPedido } = req.body;
    const resolvedUsuarioId = usuarioId || req.user?.id;

    if (!resolvedUsuarioId) {
      return res.status(400).json({ error: 'usuarioId es requerido para crear un pedido' });
    }

    const [result] = await req.dbPool.query(
      'INSERT INTO pedidos (mesaId, usuarioId, clienteId, tipoPedido) VALUES (?, ?, ?, ?)',
      [mesaId || null, resolvedUsuarioId, clienteId || null, tipoPedido || 'Local']
    );
    res.status(201).json({ id: result.insertId, mesaId, usuarioId: resolvedUsuarioId, clienteId, tipoPedido, estado: 'Abierto' });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
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
  } catch (err) {
    next(err);
  }
});

router.get('/:id/detalles', async (req, res, next) => {
  try {
    const [detalles] = await req.dbPool.query('SELECT * FROM detalle_pedidos WHERE pedidoId = ?', [req.params.id]);
    res.json(detalles);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/detalles', async (req, res, next) => {
  try {
    const { productoId, cantidad, notas } = req.body;
    const [prods] = await req.dbPool.query('SELECT precioUnitario FROM productos WHERE id = ?', [productoId]);
    const precio = prods[0]?.precioUnitario || 0;

    const [result] = await req.dbPool.query(
      'INSERT INTO detalle_pedidos (pedidoId, productoId, cantidad, precioMomento, notas) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, productoId, cantidad, precio, notas]
    );
    res.status(201).json({ id: result.insertId, pedidoId: req.params.id, productoId, cantidad, precioMomento: precio, notas });
  } catch (err) {
    next(err);
  }
});

router.put('/detalles/:id', async (req, res, next) => {
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
  } catch (err) {
    next(err);
  }
});

router.delete('/detalles/:id', async (req, res, next) => {
  try {
    await req.dbPool.query('DELETE FROM detalle_pedidos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
`;

// 11. routes/mesasRoutes.js
const mesasCode = `const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await req.dbPool.query('SELECT * FROM mesas ORDER BY numeroMesa');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('Admin'), async (req, res, next) => {
  try {
    const { numeroMesa, capacidad, estado } = req.body;
    const [result] = await req.dbPool.query(
      'INSERT INTO mesas (numeroMesa, capacidad, estado) VALUES (?, ?, ?)',
      [numeroMesa, capacidad, estado || 'Libre']
    );
    res.status(201).json({ id: result.insertId, numeroMesa, capacidad, estado: estado || 'Libre' });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { numeroMesa, capacidad, estado } = req.body;
    if ((numeroMesa !== undefined || capacidad !== undefined) && req.user?.nombreRol !== 'Admin') {
      return res.status(403).json({ error: 'Solo los administradores pueden cambiar la capacidad o número de mesa' });
    }

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
    next(err);
  }
});

router.delete('/:id', requireRole('Admin'), async (req, res, next) => {
  try {
    await req.dbPool.query('DELETE FROM mesas WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
`;

// 12. routes/productosRoutes.js
const productosCode = `const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await req.dbPool.query('SELECT * FROM productos WHERE activo = TRUE');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('Admin'), async (req, res, next) => {
  try {
    const { nombre, descripcion, precioUnitario, categoriaId } = req.body;
    if (!nombre || precioUnitario === undefined || !categoriaId) {
      return res.status(400).json({ error: 'Nombre, precio unitario y categoría son requeridos' });
    }

    const [result] = await req.dbPool.query(
      'INSERT INTO productos (nombre, descripcion, precioUnitario, categoriaId) VALUES (?, ?, ?, ?)',
      [nombre, descripcion || '', precioUnitario, categoriaId]
    );
    res.status(201).json({ id: result.insertId, nombre, descripcion, precioUnitario, categoriaId, activo: true });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRole('Admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, precioUnitario, categoriaId, activo } = req.body;

    const [result] = await req.dbPool.query(
      \`UPDATE productos 
       SET nombre = ?, descripcion = ?, precioUnitario = ?, categoriaId = ?, activo = ? 
       WHERE id = ?\`,
      [nombre, descripcion, precioUnitario, categoriaId, activo ?? true, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({ message: 'Producto actualizado exitosamente', id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
`;

// 13. routes/categoriasRoutes.js
const categoriasCode = `const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await req.dbPool.query('SELECT * FROM categorias');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('Admin'), async (req, res, next) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre de la categoría es requerido' });

    const [result] = await req.dbPool.query('INSERT INTO categorias (nombre) VALUES (?)', [nombre.trim()]);
    res.status(201).json({ id: result.insertId, nombre: nombre.trim() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
`;

// 14. routes/clientesRoutes.js
const clientesCode = `const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await req.dbPool.query('SELECT * FROM clientes');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { nombre, identificacionFiscal, telefono, email } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre del cliente es requerido' });

    const [result] = await req.dbPool.query(
      'INSERT INTO clientes (nombre, identificacionFiscal, telefono, email) VALUES (?, ?, ?, ?)',
      [nombre.trim(), identificacionFiscal || '', telefono || '', email || '']
    );
    res.status(201).json({ id: result.insertId, nombre: nombre.trim(), identificacionFiscal, telefono, email });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, identificacionFiscal, telefono, email } = req.body;
    await req.dbPool.query(
      'UPDATE clientes SET nombre = ?, identificacionFiscal = ?, telefono = ?, email = ? WHERE id = ?',
      [nombre, identificacionFiscal || '', telefono || '', email || '', id]
    );
    res.json({ id: Number(id), nombre, identificacionFiscal, telefono, email });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('Admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    await req.dbPool.query('DELETE FROM clientes WHERE id = ?', [id]);
    res.json({ success: true, id: Number(id) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
`;

// 15. routes/metodosPagoRoutes.js
const metodosPagoCode = `const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await req.dbPool.query('SELECT * FROM metodos_pago');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('Admin'), async (req, res, next) => {
  try {
    const { nombre, activo } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre del método de pago es requerido' });

    const [result] = await req.dbPool.query(
      'INSERT INTO metodos_pago (nombre, activo) VALUES (?, ?)',
      [nombre.trim(), activo !== undefined ? activo : true]
    );
    res.status(201).json({ id: result.insertId, nombre: nombre.trim(), activo: activo !== undefined ? activo : true });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRole('Admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, activo } = req.body;
    const fields = [];
    const values = [];
    if (nombre !== undefined) { fields.push('nombre = ?'); values.push(nombre.trim()); }
    if (activo !== undefined) { fields.push('activo = ?'); values.push(activo); }
    if (fields.length === 0) return res.status(400).json({ error: 'No hay datos para actualizar' });
    values.push(id);
    await req.dbPool.query(\`UPDATE metodos_pago SET \${fields.join(', ')} WHERE id = ?\`, values);
    res.json({ id: Number(id), nombre, activo });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('Admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    await req.dbPool.query('DELETE FROM metodos_pago WHERE id = ?', [id]);
    res.json({ success: true, id: Number(id) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
`;

// 16. routes/configuracionRoutes.js
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
const configuracionCode = `const express = require('express');

const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');

router.use(requireAuth);

// Configuración se lee completamente de la base de datos
// No hay valores hardcoded - todo viene de la tabla configuraciones

async function ensureConfigTable(pool) {
  try {
    await pool.query(\`
      CREATE TABLE IF NOT EXISTS configuraciones (
        clave VARCHAR(50) PRIMARY KEY,
        valor TEXT NOT NULL
      )
    \`);
  } catch (e) {}
}

router.get('/', async (req, res, next) => {
  try {
    await ensureConfigTable(req.dbPool);
    const [rows] = await req.dbPool.query('SELECT * FROM configuraciones');
    const config = { ...DEFAULT_CONFIGS };
    
    // Si hay tenant info, usar el nombre del tenant
    if (req.tenant && req.tenant.nombre) {
      config.nombreRestaurante = req.tenant.nombre;
    }
    
    // Leer todos los valores de la tabla configuraciones
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
      if (valor !== undefined && valor !== null) {
        await req.dbPool.query(
          'INSERT INTO configuraciones (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)',
          [clave, String(valor)]
        );
      }
    }

    // Devolver la configuración actualizada (completamente de la base de datos)
    const [rows] = await req.dbPool.query('SELECT * FROM configuraciones');
    const config = {};
    
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
    next(err);
  }
});

module.exports = router;
`;

// 17. routes/auditoriaRoutes.js
const auditoriaCode = `const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');

router.use(requireAuth);

router.get('/', requireRole('Admin'), async (req, res, next) => {
  try {
    const [rows] = await req.dbPool.query('SELECT * FROM auditoria_logs ORDER BY fecha DESC LIMIT 150');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { usuarioId, usuarioNombre, accion, detalles } = req.body;
    if (!accion) return res.status(400).json({ error: 'Acción requerida' });

    const resolvedUsuarioId = usuarioId || req.user?.id || null;
    const resolvedNombre = usuarioNombre || req.user?.nombre || 'Sistema';

    const [result] = await req.dbPool.query(
      'INSERT INTO auditoria_logs (usuarioId, usuarioNombre, accion, detalles) VALUES (?, ?, ?, ?)',
      [resolvedUsuarioId, resolvedNombre, accion, detalles || '']
    );

    res.status(201).json({ id: result.insertId, usuarioId: resolvedUsuarioId, usuarioNombre: resolvedNombre, accion, detalles, fecha: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
`;

// 18. routes/emailRoutes.js (Envío de emails con PDF adjunto usando Resend)
const emailCode = `const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/authMiddleware');
const { Resend } = require('resend');

const EMAIL_REGEX = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
const MAX_PDF_BYTES = 5 * 1024 * 1024;

function stripBase64(value) {
  if (!value || typeof value !== 'string') return '';
  const comma = value.indexOf(',');
  if (value.startsWith('data:') && comma !== -1) {
    return value.slice(comma + 1).replace(/\\s/g, '');
  }
  return value.replace(/\\s/g, '');
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

router.post('/send-invoice', requireAuth, async (req, res, next) => {
  try {
    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: 'RESEND_API_KEY no está configurada en el servidor' });
    }

    const { facturaId, email, asunto, pdfBase64 } = req.body;

    if (!email || !EMAIL_REGEX.test(String(email).trim())) {
      return res.status(400).json({ error: 'Email del cliente es requerido y debe ser válido' });
    }

    if (!pdfBase64) {
      return res.status(400).json({ error: 'PDF de la factura es requerido' });
    }

    if (!facturaId) {
      return res.status(400).json({ error: 'facturaId es requerido' });
    }

    const [facturas] = await req.dbPool.query(
      'SELECT * FROM facturas WHERE id = ?',
      [facturaId]
    );

    if (facturas.length === 0) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    const factura = facturas[0];
    let cliente = {};

    if (factura.clienteId) {
      const [clientes] = await req.dbPool.query(
        'SELECT * FROM clientes WHERE id = ?',
        [factura.clienteId]
      );
      cliente = clientes[0] || {};
    }

    const settings = { nombreRestaurante: req.tenant?.nombre || 'Sistema de Comandas', telefono: '' };
    try {
      const [configRows] = await req.dbPool.query('SELECT clave, valor FROM configuraciones');
      for (const row of configRows) {
        settings[row.clave] = row.valor;
      }
    } catch (configErr) {
      console.warn('No se pudo leer configuraciones para el email:', configErr.code || configErr.message);
    }

    const pdfContent = stripBase64(pdfBase64);
    const pdfBuffer = Buffer.from(pdfContent, 'base64');

    if (!pdfBuffer.length) {
      return res.status(400).json({ error: 'El PDF adjunto no es válido' });
    }

    if (pdfBuffer.length > MAX_PDF_BYTES) {
      return res.status(400).json({ error: 'El PDF es demasiado grande para enviarlo por correo' });
    }

    const restaurantName = settings.nombreRestaurante || 'Sistema de Comandas';
    const toEmail = String(email).trim();
    const fecha = factura.fechaEmision
      ? new Date(factura.fechaEmision).toLocaleDateString('es-CR')
      : '';

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: toEmail,
      subject: asunto || \`Factura \${factura.numeroFactura} - \${restaurantName}\`,
      html: \`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Estimado/a \${escapeHtml(cliente.nombre || 'Cliente')},</h2>
          <p style="color: #666;">Adjuntamos su factura electrónica por su compra.</p>
          <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px;">
            <p style="margin: 0; color: #666;"><strong>N° Factura:</strong> \${escapeHtml(factura.numeroFactura)}</p>
            <p style="margin: 5px 0 0 0; color: #666;"><strong>Fecha:</strong> \${escapeHtml(fecha)}</p>
            <p style="margin: 5px 0 0 0; color: #666;"><strong>Total:</strong> \${escapeHtml(factura.total)}</p>
          </div>
          <p style="color: #666;">Gracias por su preferencia.</p>
          <p style="color: #666;">\${escapeHtml(restaurantName)}\${settings.telefono ? ' | Tel: ' + escapeHtml(settings.telefono) : ''}</p>
        </div>
      \`,
      attachments: [
        {
          filename: \`Factura_\${factura.numeroFactura}.pdf\`,
          content: pdfBuffer.toString('base64'),
          contentType: 'application/pdf',
        },
      ],
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(502).json({
        error: error.message || 'No se pudo enviar el correo. Verifica la configuración de Resend.',
      });
    }

    res.json({
      success: true,
      message: 'Email enviado correctamente',
      factura: factura.numeroFactura,
      email: toEmail,
      resendId: data?.id,
    });
  } catch (err) {
    console.error('Error al enviar email con Resend:', err);
    next(err);
  }
});

module.exports = router;
`;

// 19. server.js
const serverCode = `const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const tenantResolverMiddleware = require('./middlewares/tenantResolver');
const { authenticateToken } = require('./middlewares/authMiddleware');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const tenantRoutes = require('./routes/tenantRoutes');

const app = express();
const port = process.env.PORT || 5000;

// 1. Cabeceras de Seguridad HTTP (Helmet)
app.use(helmet());

// 2. CORS restringido y credenciales
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) 
  : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error('No permitido por política de CORS'));
  },
  credentials: true
}));

// 3. Parser de payload: 8mb solo para adjuntos de factura; 100kb en el resto
app.use((req, res, next) => {
  const limit = req.path.startsWith('/api/email') ? '8mb' : '100kb';
  return express.json({ limit })(req, res, next);
});
app.use(cookieParser());

// 4. Rate Limiter Global (300 req/min por IP)
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes desde esta dirección IP, intente más tarde.' }
});
app.use('/api/', globalLimiter);

// 5. Health Check & Tenant Metadata Públicas
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});
app.use('/api/public/tenant', tenantRoutes);

// 6. Tenant Resolver Dinámico (Aislamiento por Schema)
app.use(tenantResolverMiddleware);

// 7. Middleware de Autenticación Universal (Bearer token o HttpOnly cookie)
app.use(authenticateToken);

// 8. Rutas de Negocio
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
app.use('/api/email', require('./routes/emailRoutes'));

// 9. Manejadores de Errores y 404 Centralizados (Sin fuga de información SQL)
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  console.log(\`API Multi-Tenant running on http://localhost:\${port}\`);
});
`;

// 19. .env.example
const envExampleContent = `# Base de Datos MySQL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password
CONTROL_DB_NAME=control_db
PORT=5000

# Seguridad JWT y PIN
JWT_SECRET=reemplazar_con_clave_secreta_jwt_de_alta_entropia
PIN_SECRET_KEY=reemplazar_con_clave_secreta_para_pins

# CORS y Entorno
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
NODE_ENV=production

# Configuración de Email (Resend)
# Con el dominio de prueba onboarding@resend.dev solo puedes enviar al email de la cuenta Resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=onboarding@resend.dev
`;

// Asegurar directorios
const middlewaresDir = path.join(targetApiDir, 'middlewares');
const routesDir = path.join(targetApiDir, 'routes');
if (!fs.existsSync(middlewaresDir)) fs.mkdirSync(middlewaresDir, { recursive: true });
if (!fs.existsSync(routesDir)) fs.mkdirSync(routesDir, { recursive: true });

// Escribir todos los archivos al backend
fs.writeFileSync(path.join(targetApiDir, 'database_tenant_schema.sql'), databaseTenantSql);
fs.writeFileSync(path.join(targetApiDir, 'db.js'), dbCode);
fs.writeFileSync(path.join(targetApiDir, 'middlewares/tenantResolver.js'), tenantResolverCode);
fs.writeFileSync(path.join(targetApiDir, 'middlewares/authMiddleware.js'), authMiddlewareCode);
fs.writeFileSync(path.join(targetApiDir, 'middlewares/errorHandler.js'), errorHandlerCode);
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
fs.writeFileSync(path.join(targetApiDir, 'routes/emailRoutes.js'), emailCode);
fs.writeFileSync(path.join(targetApiDir, 'server.js'), serverCode);
fs.writeFileSync(path.join(targetApiDir, '.env.example'), envExampleContent);

console.log('✅ Archivos generados exitosamente en restaurant_web_api.');
