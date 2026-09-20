const fs = require('fs');
const path = require('path');

const backendDir = 'c:\\Users\\Marco\\Documents\\GitHub\\restaurant_web_api';
const authRoutesPath = path.join(backendDir, 'routes', 'authRoutes.js');
const schemaPath = path.join(backendDir, 'database_schema.sql');

// Patch authRoutes.js
let authCode = fs.readFileSync(authRoutesPath, 'utf8');

if (!authCode.includes('/roles-public')) {
  authCode = authCode.replace(
    '// GET /api/auth/users-public: Lista de empleados para la grilla visual de inicio de sesión',
    '// GET /api/auth/roles-public: Lista de roles\nrouter.get(\'/roles-public\', async (req, res, next) => {\n  try {\n    const [rows] = await req.dbPool.query(\'SELECT id, nombreRol FROM roles ORDER BY id ASC\');\n    res.json(rows);\n  } catch (err) {\n    next(err);\n  }\n});\n\n// GET /api/auth/users-public: Lista de empleados para la grilla visual de inicio de sesión'
  );
}

authCode = authCode.replace(
  'puedeCancelarServido: user.puedeCancelarServido,',
  'puedeCancelarServido: user.puedeCancelarServido,\n    rutas: user.rutas || [],'
);

authCode = authCode.replace(
  'const authData = generateAuthResponse(res, user, tenantSlug);\n      return res.json(authData);',
  'const [permRows] = await req.dbPool.query(\'SELECT ruta FROM roles_permisos WHERE rolId = ?\', [user.rolId]);\n      user.rutas = permRows.map(r => r.ruta);\n      const authData = generateAuthResponse(res, user, tenantSlug);\n      return res.json(authData);'
);

authCode = authCode.replace(
  'const tenantSlug = req.tenant?.slug || \'default\';\n      const authData = generateAuthResponse(res, user, tenantSlug);\n      return res.json(authData);',
  'const tenantSlug = req.tenant?.slug || \'default\';\n      const [permRows] = await req.dbPool.query(\'SELECT ruta FROM roles_permisos WHERE rolId = ?\', [user.rolId]);\n      user.rutas = permRows.map(r => r.ruta);\n      const authData = generateAuthResponse(res, user, tenantSlug);\n      return res.json(authData);'
);

fs.writeFileSync(authRoutesPath, authCode);
console.log('authRoutes.js patched');

// Patch database_schema.sql
let schemaCode = fs.readFileSync(schemaPath, 'utf8');
if (!schemaCode.includes('CREATE TABLE IF NOT EXISTS roles_permisos')) {
  schemaCode = schemaCode.replace(
    '-- 2. USUARIOS',
    'CREATE TABLE IF NOT EXISTS roles_permisos (\n  `rolId` int NOT NULL,\n  `ruta` varchar(100) NOT NULL,\n  PRIMARY KEY (`rolId`, `ruta`),\n  CONSTRAINT `roles_permisos_ibfk_1` FOREIGN KEY (`rolId`) REFERENCES `roles` (`id`) ON DELETE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;\n\n-- 2. USUARIOS'
  );
  
  schemaCode = schemaCode.replace(
    'INSERT INTO usuarios',
    'INSERT INTO roles_permisos (rolId, ruta) VALUES\n(1, \'/dashboard\'), (1, \'/mesas\'), (1, \'/delivery\'), (1, \'/pedidos\'), (1, \'/productos\'), (1, \'/categorias\'), (1, \'/clientes\'), (1, \'/facturacion\'), (1, \'/usuarios\'), (1, \'/metodos-pago\'), (1, \'/reportes\'), (1, \'/configuracion\'),\n(2, \'/mesas\'), (2, \'/delivery\'), (2, \'/pedidos\'), (2, \'/clientes\'),\n(3, \'/cocina\'),\n(4, \'/delivery\'), (4, \'/pedidos\'), (4, \'/facturacion\');\n\nINSERT INTO usuarios'
  );
  fs.writeFileSync(schemaPath, schemaCode);
  console.log('database_schema.sql patched');
}
