const fs = require('fs');
const path = require('path');

const targetApiDir = path.resolve(__dirname, '../../restaurant_web_api');
const routesDir = path.join(targetApiDir, 'routes');

// =========================================================================
// 1. routes/rolesRoutes.js (Gestión de Roles y Permisos - Solo Administradores)
// =========================================================================
const rolesRoutesContent = `const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');

// Solo Administradores pueden acceder a este módulo
router.use(requireAuth);
router.use(requireRole('Admin'));

// GET /api/roles: Lista todos los roles con sus rutas asignadas y total de usuarios
router.get('/', async (req, res, next) => {
  try {
    const [roles] = await req.dbPool.query(
      \`SELECT r.id, r.nombreRol,
              (SELECT COUNT(*) FROM usuarios u WHERE u.rolId = r.id AND u.activo = 1) AS totalUsuarios,
              COALESCE(GROUP_CONCAT(rp.ruta ORDER BY rp.ruta ASC), '') AS rutasStr
       FROM roles r
       LEFT JOIN roles_permisos rp ON rp.rolId = r.id
       GROUP BY r.id, r.nombreRol
       ORDER BY r.id ASC\`
    );

    const data = roles.map(r => ({
      id: r.id,
      nombreRol: r.nombreRol,
      totalUsuarios: Number(r.totalUsuarios) || 0,
      rutas: r.rutasStr ? r.rutasStr.split(',').filter(Boolean) : []
    }));

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/roles/:id/permisos: Retorna las rutas de un rol específico
router.get('/:id/permisos', async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await req.dbPool.query(
      'SELECT ruta FROM roles_permisos WHERE rolId = ? ORDER BY ruta ASC',
      [id]
    );
    res.json({
      rolId: Number(id),
      rutas: rows.map(r => r.ruta)
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/roles/:id/permisos: Actualiza las rutas asignadas a un rol
router.put('/:id/permisos', async (req, res, next) => {
  const connection = await req.dbPool.getConnection();
  try {
    const { id } = req.params;
    let { rutas = [] } = req.body;

    if (!Array.isArray(rutas)) {
      return res.status(400).json({ error: 'El campo rutas debe ser un arreglo de rutas' });
    }

    const [roleRows] = await connection.query('SELECT * FROM roles WHERE id = ?', [id]);
    if (roleRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Rol no encontrado' });
    }
    const rol = roleRows[0];

    // Protección de seguridad para Admin: siempre debe conservar acceso a roles y usuarios
    if (rol.nombreRol === 'Admin' || Number(id) === 1) {
      if (!rutas.includes('/roles')) rutas.push('/roles');
      if (!rutas.includes('/usuarios')) rutas.push('/usuarios');
      if (!rutas.includes('/dashboard')) rutas.push('/dashboard');
    }

    await connection.beginTransaction();

    // 1. Limpiar permisos existentes del rol
    await connection.query('DELETE FROM roles_permisos WHERE rolId = ?', [id]);

    // 2. Insertar los nuevos permisos activados
    if (rutas.length > 0) {
      const values = rutas.map(r => [Number(id), r]);
      await connection.query('INSERT INTO roles_permisos (rolId, ruta) VALUES ?', [values]);
    }

    // 3. Registrar en auditoría
    try {
      await connection.query(
        'INSERT INTO auditoria_logs (usuarioId, usuarioNombre, accion, detalles) VALUES (?, ?, ?, ?)',
        [
          req.user.id,
          req.user.nombre,
          'UPDATE_PERMISOS_ROL',
          \`Permisos actualizados para el rol \${rol.nombreRol} (ID: \${id}): \${rutas.length} módulos habilitados\`
        ]
      );
    } catch (auditErr) {}

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      rolId: Number(id),
      nombreRol: rol.nombreRol,
      rutas
    });
  } catch (err) {
    await connection.rollback();
    connection.release();
    next(err);
  }
});

module.exports = router;
`;

// =========================================================================
// 2. Actualizar server.js para registrar /api/roles
// =========================================================================
const serverPath = path.join(targetApiDir, 'server.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');

if (!serverContent.includes("app.use('/api/roles'")) {
  serverContent = serverContent.replace(
    "app.use('/api/usuarios', require('./routes/usuariosRoutes'));",
    "app.use('/api/usuarios', require('./routes/usuariosRoutes'));\napp.use('/api/roles', require('./routes/rolesRoutes'));"
  );
  fs.writeFileSync(serverPath, serverContent);
  console.log('✅ Ruta /api/roles registrada en server.js');
}

// =========================================================================
// 3. Actualizar routes/authRoutes.js para inyectar rutas de BD en el login
// =========================================================================
const authRoutesPath = path.join(routesDir, 'authRoutes.js');
let authContent = fs.readFileSync(authRoutesPath, 'utf8');

// Modificar generateAuthResponse para incluir rutas dinámicas
const oldFuncRegex = /function generateAuthResponse\(res, user, tenantSlug\) \{[\s\S]*?return \{[\s\S]*?\};?\s*\}/;

const newFuncCode = `async function generateAuthResponse(req, res, user, tenantSlug) {
  let rutas = [];
  try {
    const [rows] = await req.dbPool.query(
      'SELECT ruta FROM roles_permisos WHERE rolId = ? ORDER BY ruta ASC',
      [user.rolId]
    );
    rutas = rows.map(r => r.ruta);
  } catch (err) {
    console.warn('No se pudieron leer permisos para el login:', err.message);
  }

  // Si aún no hay permisos en BD para este rol, cargar configuración por defecto
  if (rutas.length === 0) {
    const fallbackRoutes = {
      'Admin': ['/dashboard', '/mesas', '/delivery', '/pedidos', '/productos', '/categorias', '/clientes', '/facturacion', '/usuarios', '/roles', '/metodos-pago', '/reportes', '/configuracion', '/cocina'],
      'Mesero': ['/dashboard', '/mesas', '/delivery', '/pedidos', '/clientes', '/facturacion'],
      'Cocina': ['/dashboard', '/cocina'],
      'Cajero': ['/dashboard', '/delivery', '/pedidos', '/facturacion', '/metodos-pago', '/reportes'],
      'Gerente': ['/dashboard', '/mesas', '/delivery', '/pedidos', '/productos', '/categorias', '/clientes', '/facturacion', '/metodos-pago', '/reportes', '/configuracion']
    };
    rutas = fallbackRoutes[user.nombreRol] || ['/dashboard'];
  }

  // Admin siempre debe tener acceso a roles
  if (user.nombreRol === 'Admin' && !rutas.includes('/roles')) {
    rutas.push('/roles');
  }

  const payload = {
    id: user.id,
    username: user.username,
    nombre: user.nombre,
    email: user.email,
    rolId: user.rolId,
    nombreRol: user.nombreRol,
    puedeCancelarServido: user.puedeCancelarServido,
    rutas,
    tenantSlug
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

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
}`;

if (oldFuncRegex.test(authContent)) {
  authContent = authContent.replace(oldFuncRegex, newFuncCode);
}

// Reemplazar las llamadas generateAuthResponse(res, user, tenantSlug) por generateAuthResponse(req, res, user, tenantSlug)
authContent = authContent.replace(/generateAuthResponse\(res, user, tenantSlug\)/g, 'await generateAuthResponse(req, res, user, tenantSlug)');

fs.writeFileSync(path.join(routesDir, 'rolesRoutes.js'), rolesRoutesContent);
console.log('✅ Archivo creado: routes/rolesRoutes.js');

fs.writeFileSync(authRoutesPath, authContent);
console.log('✅ Archivo actualizado: routes/authRoutes.js');

console.log('🎉 Backend actualizado con soporte para Roles y Permisos dinámicos.');
