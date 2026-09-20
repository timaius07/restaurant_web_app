# Implementación de Cookies HttpOnly para Gestión de Sesión

## Estado Actual

**Frontend:** La sesión se almacena en `localStorage` con el key `session`, lo cual es vulnerable a ataques XSS.

**Backend:** No hay implementación de cookies HttpOnly actualmente. La autenticación devuelve datos de usuario pero no establece cookies.

## Objetivo

Mover la gestión de sesión de localStorage a cookies HttpOnly gestionadas por el backend para mejorar la seguridad.

## Cambios Requeridos en Backend

### 1. Instalar Dependencias

```bash
npm install cookie-parser express-session
```

### 2. Configurar Middleware de Cookies

En `server.js` o archivo de configuración:

```javascript
const cookieParser = require('cookie-parser');
const session = require('express-session');

app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-here',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,      // No accesible desde JavaScript
    secure: true,         // Solo se envía sobre HTTPS
    sameSite: 'strict',  // Protección contra CSRF
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));
```

### 3. Modificar Endpoint de Login

**Archivo:** `routes/authRoutes.js`

**Cambio actual:**
```javascript
router.post('/login', async (req, res) => {
  // ... validación de credenciales
  const { passwordHash, pinHash, ...userInfo } = user;
  userInfo.tenantSlug = req.tenant?.slug || 'default';
  res.json(userInfo); // Devuelve datos de usuario al frontend
});
```

**Nuevo:**
```javascript
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await req.dbPool.query(
      `SELECT u.*, r.nombreRol
       FROM usuarios u
       JOIN roles r ON u.rolId = r.id
       WHERE u.username = ? AND u.passwordHash = ?`,
      [username, password]
    );

    if (rows.length > 0) {
      const user = rows[0];
      
      // Establecer sesión en cookie HttpOnly
      req.session.userId = user.id;
      req.session.userName = user.nombre;
      req.session.userRole = user.nombreRol;
      req.session.tenantSlug = req.tenant?.slug || 'default';
      
      // Devolver datos básicos (sin datos sensibles)
      const { passwordHash, pinHash, ...userInfo } = user;
      res.json({
        success: true,
        user: {
          id: user.id,
          nombre: user.nombre,
          nombreRol: user.nombreRol,
          tenantSlug: req.tenant?.slug || 'default'
        }
      });
    } else {
      res.status(401).json({ error: 'Credenciales inválidas' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error en autenticación' });
  }
});
```

### 4. Modificar Endpoint de Login con PIN

**Archivo:** `routes/authRoutes.js`

```javascript
router.post('/login-pin', async (req, res) => {
  try {
    const { userId, pin } = req.body;
    // ... validación del PIN
    
    if (validPin) {
      // Establecer sesión en cookie HttpOnly
      req.session.userId = user.id;
      req.session.userName = user.nombre;
      req.session.userRole = user.nombreRol;
      req.session.tenantSlug = req.tenant?.slug || 'default';
      
      const { pinHash, passwordHash, ...userInfo } = user;
      res.json({
        success: true,
        user: {
          id: user.id,
          nombre: user.nombre,
          nombreRol: user.nombreRol,
          tenantSlug: req.tenant?.slug || 'default'
        }
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error en autenticación' });
  }
});
```

### 5. Agregar Middleware de Autenticación

**Archivo:** `middlewares/authMiddleware.js`

```javascript
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!roles.includes(req.session.userRole)) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
```

### 6. Aplicar Middleware a Rutas Sensibles

**Ejemplo en `routes/facturasRoutes.js`:**

```javascript
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');

router.get('/', requireAuth, async (req, res) => {
  // Solo usuarios autenticados pueden ver facturas
  // ...
});

router.post('/', requireAuth, requireRole('Admin', 'Cajero'), async (req, res) => {
  // Solo Admin y Cajero pueden crear facturas
  // ...
});
```

## Cambios Requeridos en Frontend

### 1. Modificar AuthContext.jsx

**Eliminar localStorage para sesión:**

```javascript
// Eliminar estas líneas:
// const session = storage.get('session');
// storage.set('session', session);
// storage.remove('session');
```

**Cambiar a solo verificar existencia de sesión:**

```javascript
const login = async (username, password) => {
  try {
    const data = await api.post('/auth/login', { username, password });
    // El backend establece la cookie automáticamente
    setUser(data.user);
    return { ok: true, user: data.user };
  } catch (err) {
    return { ok: false, error: err.message || 'Usuario o contraseña incorrectos' };
  }
};

const logout = async () => {
  try {
    await api.post('/auth/logout'); // Crear endpoint de logout en backend
  } catch (err) {
    console.error('Error al cerrar sesión:', err);
  }
  setUser(null);
};
```

### 2. Agregar Endpoint de Logout en Backend

**Archivo:** `routes/authRoutes.js`

```javascript
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error al cerrar sesión' });
    }
    res.json({ success: true });
  });
});
```

## Variables de Entorno

Agregar a `.env.example`:

```env
SESSION_SECRET=your-session-secret-key-here
```

## Beneficios de la Implementación

1. **Seguridad XSS:** Las cookies HttpOnly no son accesibles desde JavaScript, previniendo robo de sesión.
2. **Protección CSRF:** `sameSite: strict` previene ataques CSRF.
3. **Seguridad TLS:** `secure: true` asegura que las cookies solo se envíen sobre HTTPS.
4. **Gestión Centralizada:** El backend controla la sesión, no el frontend.
5. **Expiración Automática:** Las cookies tienen tiempo de expiración configurable.

## Orden de Implementación

1. Instalar dependencias en backend
2. Configurar middleware de cookies y sesión
3. Modificar endpoints de login para establecer sesión
4. Crear middleware de autenticación
5. Aplicar middleware a rutas sensibles
6. Crear endpoint de logout
7. Modificar frontend para eliminar localStorage de sesión
8. Probar flujo completo de autenticación

## Notas Importantes

- **Secrets:** Usar variables de entorno para `SESSION_SECRET`, nunca hardcodear.
- **HTTPS:** `secure: true` requiere HTTPS en producción.
- **Testing:** En desarrollo, puede usar `secure: false` para HTTP.
- **Compatibilidad:** Asegurar que el proxy nginx pase las cookies correctamente.