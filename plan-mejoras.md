---
agent: devin-local
session: tidy-salmon
created: 2026-09-14T00:58:07Z
---
# Plan Integral de Mejoras: Seguridad, Rendimiento, Arquitectura y Limpieza de Cache

Análisis integral del proyecto restaurant_web_app con mejoras en seguridad (JWT, TLS, bcrypt), rendimiento (React Query, timeout, N+1), integración nginx, y limpieza de cache/localStorage para eliminar fallbacks locales y transferir responsabilidades al backend.

# Plan Integral de Mejoras: Seguridad, Rendimiento, Arquitectura y Limpieza de Cache

## Resumen Ejecutivo

El proyecto `restaurant_web_app` es una aplicación React para gestión de restaurantes con backend Node.js/Express y MySQL. Aunque funcional, presenta múltiples oportunidades críticas de mejora en seguridad, rendimiento, arquitectura y gestión de cache/localStorage. Este plan unifica el análisis de todas las áreas con un enfoque sistemático.

## 1. Limpieza de Cache y LocalStorage (Prioridad Alta)

### Problema Identificado
El frontend tiene remanentes de la arquitectura sin backend (localStorage como base de datos), fallbacks locales, y cache de datos que ahora deberían ser responsabilidad exclusiva del backend.

### 1.1 Archivos a Eliminar

#### Eliminar Completo: `src/services/storageService.js`
- **Razón**: El comentario en línea 1 dice "swap this file for API calls when Node.js backend is ready"
- **Estado**: Las funciones CRUD genéricas (`getAll`, `saveAll`, `getById`, `create`, `update`, `remove`) NO se usan en ningún lugar del código actual
- **Acción**: Eliminar el archivo completo

### 1.2 Limpiar `src/data/seedData.js`

**Eliminar (no se usan y contienen datos obsoletos):**
- `USUARIOS` (líneas 13-18) - Contiene contraseñas en texto plano (`admin123`, `mesero123`, etc.)
- `MESAS` (líneas 20-31) - No se usa en el código actual
- `CATEGORIAS` (líneas 33-47) - No se usa en el código actual
- `PRODUCTOS` (líneas 49-103) - No se usa en el código actual
- `CLIENTES` (líneas 105-108) - No se usa en el código actual
- `METODOS_PAGO` (líneas 110-116) - No se usa en el código actual

**Mantener:**
- `ROLES` (líneas 6-11) - Se usa en `src/pages/Usuarios.jsx`
- `SETTINGS_DEFAULT` (líneas 118-128) - Se usa en `src/context/AppContext.jsx` como valores por defecto

### 1.3 Eliminar Fallbacks Locales

#### En `src/context/AuthContext.jsx`

**Eliminar fallback en `getPublicUsers` (líneas 51-67):**
```javascript
// ELIMINAR - Fallback a localStorage/seedData
} catch (err) {
  console.warn('API backend no disponible para lista de usuarios, utilizando datos de respaldo:', err);
}
const localUsers = storage.get('usuarios') || USUARIOS;
return localUsers.map(u => { ... });
```

**Cambio propuesto:**
```javascript
// NUEVO - Solo fallar si el backend no responde
} catch (err) {
  console.error('Error al obtener lista de usuarios:', err);
  throw err; // O return null con manejo de error en UI
}
```

**Eliminar fallback en `login` (líneas 99-112):**
```javascript
// ELIMINAR - Autenticación local con credenciales en claro
} catch (err) {
  const localUsers = storage.get('usuarios') || USUARIOS;
  const found = localUsers.find(
    u => u.username.toLowerCase() === username.toLowerCase() &&
    (u.passwordHash === password || u.pinHash === password)
  );
  if (found) {
    // Crear sesión local sin backend
    const session = { ...found, ... };
    storage.set('session', session);
    setUser(session);
    return { ok: true, user: session };
  }
  return { ok: false, error: err.message || 'Usuario o contraseña incorrectos' };
}
```

**Cambio propuesto:**
```javascript
// NUEVO - Solo autenticación vía backend
} catch (err) {
  return { ok: false, error: err.message || 'Usuario o contraseña incorrectos' };
}
```

**Eliminar import de USUARIOS:**
- Línea 4: `import { USUARIOS, ROLES } from '../data/seedData';`
- Cambiar a: `import { ROLES } from '../data/seedData';`

#### En `src/context/AppContext.jsx`

**Eliminar fallbacks en `addUsuario` (líneas 334-341):**
```javascript
// ELIMINAR - Guardar en localStorage cuando backend falla
} catch (err) {
  console.warn('Error al guardar usuario en backend, guardando localmente:', err);
  const newId = String(Date.now());
  const newUser = { id: newId, ...data };
  const updated = [...usuarios, newUser];
  storage.set('usuarios', updated);
  setUsuarios(updated);
}
```

**Cambio propuesto:**
```javascript
// NUEVO - Solo propagar error
} catch (err) {
  console.error('Error al crear usuario:', err);
  throw err; // O mostrar toast de error
}
```

**Eliminar fallbacks en `updateUsuario` (líneas 349-354) y `deleteUsuario` (líneas 362-367)** con el mismo patrón.

**Eliminar import de USUARIOS:**
- Línea 4: `import { SETTINGS_DEFAULT, USUARIOS } from '../data/seedData';`
- Cambiar a: `import { SETTINGS_DEFAULT } from '../data/seedData';`

### 1.4 LocalStorage a Mantener (Solo UI State)

#### Mantener: `tenant_slug`
- **Ubicación**: `src/services/apiService.js` líneas 20, 26-28
- **Razón**: Es UI state (selección de tenant), no cache de datos del backend
- **Uso**: Persistir la selección de tenant entre navegaciones

#### Separar: `settings`
- **Ubicación**: `src/context/AppContext.jsx` líneas 18, 50, 71, 78, 87
- **Cambio**: Separar en dos categorías

**Settings de UI (localStorage):**
```javascript
const UI_SETTINGS_DEFAULT = {
  tema: 'dark',
};
```

**Settings de Negocio (backend):**
```javascript
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
```

#### Cambiar: `session` a Cookies HttpOnly
- **Ubicación**: `src/context/AuthContext.jsx` líneas 16, 75, 96, 109, 118
- **Razón actual**: Vulnerable a XSS
- **Cambio propuesto**: Mover a cookies HttpOnly; Secure; SameSite gestionadas por el backend
- **Implementación**: Backend debe setear cookie en login, frontend no maneja sesión directamente

### 1.5 Modificar `updateSettings` en AppContext

**Cambio propuesto:**
```javascript
const updateSettings = async (changes) => {
  // Separar cambios de UI vs negocio
  const uiChanges = {};
  const businessChanges = {};
  
  Object.keys(changes).forEach(key => {
    if (key === 'tema') {
      uiChanges[key] = changes[key];
    } else {
      businessChanges[key] = changes[key];
    }
  });
  
  // Actualizar UI settings inmediatamente (localStorage)
  if (Object.keys(uiChanges).length > 0) {
    const newSettings = { ...settings, ...uiChanges };
    storage.set('settings', newSettings);
    setSettingsState(newSettings);
    if (uiChanges.tema) {
      document.documentElement.setAttribute('data-theme', uiChanges.tema);
    }
  }
  
  // Enviar cambios de negocio al backend
  if (Object.keys(businessChanges).length > 0) {
    try {
      const updatedCfg = await api.put('/configuracion', businessChanges);
      if (updatedCfg) {
        const finalSettings = { ...settings, ...updatedCfg };
        setSettingsState(finalSettings);
      }
    } catch (err) {
      console.error('Error al guardar configuración en BD:', err);
      throw err;
    }
  }
};
```

### 1.6 Responsabilidades Claras

**Backend debe gestionar:**
- Todos los datos de negocio: mesas, categorías, productos, clientes, pedidos, facturas, usuarios, métodos de pago
- Configuración de negocio: nombreRestaurante, razónSocial, cedulaJuridica, teléfono, correo, moneda, tasaImpuesto, tasaCambio
- Autenticación: Login, validación de credenciales, emisión de token/cookie
- Sesión: Gestión de sesión con cookies HttpOnly
- Cache de metadata: Cache de tenant info (ya implementado en backend con TTL 1 min)

**Frontend debe gestionar:**
- UI State: Selección de tenant, tema, preferencias de UI
- Sesión: Solo token/cookie recibido del backend, no credenciales
- Cache transitorio: Estado React en memoria (AppContext) para UX rápida
- Cache HTTP: Via browser cache control (nginx configuration)

## 2. Seguridad (Prioridad Crítica)

### 2.1 Sin Autenticación Real en API
- **Ubicación**: `update_api.cjs` líneas 105-132 (tenantResolverMiddleware)
- **Problema**: Solo valida header `X-Tenant-Slug`, no token ni sesión
- **Impacto**: Cualquiera puede acceder a cualquier endpoint con el slug correcto
- **Código expuesto**: `GET /api/usuarios` devuelve `pinHash` y `passwordHash` en texto plano

**Recomendación:**
- Implementar JWT con middleware de autenticación
- Validar token en cada ruta sensible
- Aplicar autorización por rol en endpoints críticos (facturas, usuarios, configuración, auditoría)

### 2.2 Contraseñas en Texto Plano
- **Ubicación**: 
  - `update_api.cjs` líneas 628-629 (comparación directa)
  - `src/data/seedData.js` líneas 14-17 (credenciales semilla)
  - `update_api.cjs` línea 709 (default '1234')
- **Problema**: Sin bcrypt/argon2, comparación directa en claro
- **PIN**: AES-256-GCM reversible con clave hardcodeada `'SodaLaTica@2025#PinKey!XZ'`

**Recomendación:**
- bcrypt/argon2 para contraseñas
- Para PIN de 4 dígitos (baja entropía): guardar solo HMAC-SHA256 con sal (no reversible)
- Eliminar credenciales semilla y defaults hardcodeados

### 2.3 Tráfico HTTP Plano
- **Ubicación**: `src/services/apiService.js` línea 8
- **Problema**: Todas las credenciales viajan sin cifrar
- **Impacto**: Interceptación trivial de credenciales

**Recomendación:**
- TLS obligatorio con nginx + Certbot
- Redirigir HTTP → HTTPS
- Bloquear puerto 5000 en firewall (solo localhost)

### 2.4 CORS Totalmente Abierto
- **Ubicación**: `update_api.cjs` línea 969
- **Problema**: `app.use(cors())` acepta cualquier origen
- **Impacto**: Cualquier sitio puede usar la API desde navegador de víctima

**Recomendación:**
- Whitelist de orígenes con `cors({ origin: [...] })`
- Idealmente: servir frontend y API desde el mismo dominio (proxy reverso) y eliminar CORS

### 2.5 Sesión en localStorage
- **Ubicación**: `src/context/AuthContext.jsx` líneas 75, 96, 109
- **Problema**: Vulnerable a XSS
- **Impacto**: Sesión puede ser robada si hay XSS

**Recomendación:**
- Mover a cookies HttpOnly; Secure; SameSite
- Validar en servidor, no en cliente

### 2.6 Rate Limiting Inadecuado
- **Ubicación**: `update_api.cjs` líneas 506-615
- **Problema**: Map en memoria por usuario, no por IP
- **Impacto**: Ataque distribuido lo ignora; se reinicia con cada deploy

**Recomendación:**
- Rate limiting por IP con Redis o store persistente
- Rate limit global en nginx para `/api/auth/*`

### 2.7 Fuga de Información en Errores
- **Ubicación**: Todos los endpoints responden `res.status(500).json({ error: err.message })`
- **Problema**: Expone mensajes internos de MySQL
- **Impacto**: Información de estructura de BD expuesta

**Recomendación:**
- Middleware de error central con mensajes genéricos
- Loguear detalles en servidor, no en respuesta

### 2.8 Helmet y Headers de Seguridad
- **Problema**: No hay helmet ni headers de seguridad
- **Recomendación**: Agregar helmet con headers recomendados

## 3. Llamadas a API y Rendimiento (Prioridad Alta)

### 3.1 Recarga Completa del Estado (reload())
- **Ubicación**: `src/context/AppContext.jsx` líneas 100-102, 106-108, 111-113, etc.
- **Problema**: `reload()` se llama 27 veces, recargando 9 colecciones completas tras cada mutación
- **Impacto**: Cientos de peticiones redundantes en una jornada típica

**Recomendación:**
- Implementar React Query o SWR para invalidación selectiva de cache
- Devolver la entidad modificada desde el backend y actualizar estado local sin refetch total

### 3.2 Polling Ineficiente en ColaComandas
- **Ubicación**: `src/pages/ColaComandas.jsx` línea 14
- **Problema**: `setInterval(() => reload(), 10000)` descarga todo el estado cada 10s
- **Impacto**: 9 peticiones + detalles de pedidos activos cada 10s

**Recomendación:**
- Crear endpoint dedicado: `GET /api/pedidos?estado=Preparando&updatedSince=...`
- Considerar WebSockets/SSE para actualización en tiempo real

### 3.3 Sin Timeout ni AbortController
- **Ubicación**: `src/services/apiService.js` líneas 46, 59, 74, 89
- **Problema**: `fetch` sin `AbortController` - un backend colgado congela la UI
- **Excepción**: `haciendaService.js` implementa correctamente el patrón

**Recomendación:**
- Agregar AbortController a todas las llamadas fetch en `apiService.js`
- Timeout configurable (ej: 30s)

### 3.4 Problema N+1 en Backend
- **Ubicación**: `update_api.cjs` líneas 239-242
- **Problema**: `GET /api/facturas` ejecuta un SELECT por cada factura
- **Impacto**: Degradación lineal con el número de facturas

**Recomendación:**
- Un solo query con `WHERE facturaId IN (...)`
- O JOIN con agregación en el cliente

### 3.5 Sin Paginación ni Filtros
- **Ubicación**: Todos los endpoints en `update_api.cjs`
- **Problema**: `SELECT *` sin LIMIT/OFFSET ni filtros por estado/fecha
- **Impacto**: Transferencia de datos innecesarios

**Recomendación:**
- Implementar paginación (`LIMIT/OFFSET` o cursor) en todos los endpoints de listas
- Agregar filtros por estado/fecha
- Nunca usar `SELECT *` en endpoints expuestos

### 3.6 Bundle Monolítico
- **Ubicación**: `package.json` líneas 13, 19
- **Problema**: `recharts` (Reportes) y `html2pdf.js` (Facturación) cargan para todos
- **Impacto**: Usuarios de Cocina/Mesero descargan código que nunca usan

**Recomendación:**
- React.lazy + Suspense para lazy loading por ruta
- manualChunks en Vite para separar vendor chunks

### 3.7 Sin Caché HTTP
- **Problema**: No hay configuración de cache-control
- **Impacto**: Assets de Vite (con hash) no tienen caché agresivo

**Recomendación:**
- Configurar nginx con `Cache-Control: public, max-age=31536000, immutable` para assets con hash
- `Cache-Control: no-cache` para index.html

### 3.8 Falta de Índices de BD
- **Ubicación**: `database_schema.sql`
- **Problema**: No hay índices compuestos en consultas frecuentes
- **Sugerencia**: Índice en `(estado, fechaApertura)` para pedidos activos

## 4. Integración Nginx (Prioridad Alta)

### Estado Actual
- **Problema**: No hay configuración versionada en el repositorio
- **IP Hardcodeada**: `src/services/apiService.js` línea 8 - `http://150.136.175.75:5000/api`
- **Protocolo**: Todo es HTTP plano (sin TLS)
- **CORS**: Totalmente abierto en `update_api.cjs` línea 969

### Recomendaciones

1. **Crear archivo de configuración nginx** en `deploy/nginx.conf`:
   - Proxy reverso `/api` → backend
   - TLS con Certbot
   - Compresión gzip/brotli
   - Cache agresivo para assets con hash
   - `try_files` para SPA routing
   - Rate limiting en `/api/auth/*`
   - Headers de seguridad (HSTS, CSP, X-Frame-Options)

2. **Cambiar API URL a relativa**: Usar `/api` en lugar de IP hardcodeada
3. **Eliminar CORS** una vez frontend y API estén en el mismo dominio
4. **Configurar health check** endpoint
5. **Bloquear puerto 5000** en firewall (solo localhost)

### Configuración Nginx Sugerida

```nginx
server_tokens off;
client_max_body_size 200k;

# Compresión
gzip on;
gzip_types application/json text/css application/javascript image/svg+xml;
gzip_min_length 1024;

server {
    listen 80;
    server_name tu-dominio.cr;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tu-dominio.cr;

    # ssl_certificate / ssl_certificate_key (Certbot)

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Content-Security-Policy "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'" always;

    root /var/www/restaurant_web_app/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 30s;
    }

    # SPA fallback para React Router
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Assets con hash de Vite: caché agresivo
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }
}

# En http {}
limit_req_zone $binary_remote_addr zone=login:10m rate=10r/m;
```

## 5. Arquitectura General (Prioridad Media)

### 5.1 Backend como Template String
- **Ubicación**: `update_api.cjs` es un generador que sobrescribe archivos
- **Problema**: Backend no es un proyecto versionado propio
- **Recomendación**: Separar backend en repo propio o subdirectorio con código real

### 5.2 Migraciones de BD
- **Ubicación**: `update_api.cjs` líneas 401-412 (CREATE TABLE IF NOT EXISTS en ruta)
- **Problema**: Sin migraciones versionadas
- **Recomendación**: Implementar migraciones con Umzug o Flyway

### 5.3 Sin Tests
- **Problema**: No hay tests en el proyecto
- **Recomendación**: 
  - Vitest + React Testing Library para componentes
  - Supertest para endpoints de API
  - Mínimo: tests críticos (auth, facturas, login)

### 5.4 Errores Silenciosos
- **Ubicación**: `src/context/AppContext.jsx` líneas 335, 350, 363
- **Problema**: Fallbacks locales sin avisar al usuario
- **Recomendación**: Mostrar toast de error y estado de degradación

### 5.5 Validación de Entrada
- **Problema**: Backend no valida input (puede ser undefined → NULL)
- **Recomendación**: zod/joi/express-validator con 400

### 5.6 Sin CI/CD
- **Problema**: Deploy manual
- **Recomendación**: GitHub Actions con lint, build, tests, deploy

### 5.7 Sin Docker
- **Problema**: Deploy manual sin contenedores
- **Recomendación**: docker-compose con nginx + api + mysql

### 5.8 Documentación
- **Problema**: Sin documentación de API
- **Recomendación**: OpenAPI/Swagger o API.md

### 5.9 Logging
- **Problema**: Solo console.error dispersos
- **Recomendación**: Pino o Winston con request-id y niveles

### 5.10 Configuración
- **Problema**: 
  - `update_api.cjs` línea 481 (PIN_SECRET_KEY default)
  - `src/services/apiService.js` línea 8 (IP)
- **Recomendación**: 
  - Crear `.env.example`
  - Agregar `.env` a `.gitignore`
  - Usar variables de entorno

## Archivos Clave a Modificar

### Eliminar:
1. `src/services/storageService.js` - Eliminar completo (no se usa)

### Modificar Frontend:
1. `src/data/seedData.js` - Eliminar USUARIOS, MESAS, CATEGORIAS, PRODUCTOS, CLIENTES, METODOS_PAGO
2. `src/context/AuthContext.jsx` - Eliminar fallbacks, eliminar import USUARIOS
3. `src/context/AppContext.jsx` - Eliminar fallbacks, eliminar import USUARIOS, separar settings
4. `src/services/apiService.js` - Timeout, abort, URL relativa (eliminar IP hardcodeada)
5. `src/pages/ColaComandas.jsx` - WebSocket/SSE en lugar de polling
6. `vite.config.js` - manualChunks, lazy loading
7. `package.json` - Agregar React Query, testing libs

### Modificar Backend:
1. `update_api.cjs` - JWT middleware, bcrypt, validación, fix N+1, helmet, rate limiting
2. Generar archivo `server.js` real (no template string)
3. Agregar middleware de error central
4. Implementar gestión de sesiones con cookies HttpOnly

### Infraestructura:
1. Crear `deploy/nginx.conf`
2. Crear `docker-compose.yml`
3. Crear `.env.example`
4. Crear `.github/workflows/ci-cd.yml`

### Base de Datos:
1. `database_schema.sql` - Agregar índices
2. Implementar migraciones versionadas

## Priorización de Mejoras

### Fase 1: Críticas (Seguridad y Cache)
1. ✅ Eliminar storageService.js (no se usa)
2. ✅ Limpiar seedData.js (eliminar datos obsoletos)
3. ✅ Eliminar fallbacks en AuthContext (getPublicUsers, login)
4. ✅ Eliminar fallbacks en AppContext (usuarios)
5. ✅ Separar settings (UI vs negocio)
6. 🔄 Implementar JWT en API
7. 🔄 TLS + proxy reverso nginx
8. 🔄 bcrypt/argon2 para contraseñas
9. 🔄 Cerrar CORS + helmet

### Fase 2: Alto Impacto (Rendimiento)
10. 🔄 React Query para invalidación selectiva
11. 🔄 Timeout/abort en apiService
12. 🔄 Fix N+1 en facturas
13. 🔄 Paginación en endpoints
14. 🔄 Cambiar API URL a relativa
15. 🔄 Lazy loading de rutas

### Fase 3: Medio Impacto (UX e Infraestructura)
16. 🔄 Cache HTTP + compresión nginx
17. 🔄 Rate limiting nginx en /api/auth
18. 🔄 Mensajes de error visibles en UI
19. 🔄 Mover sesión a cookies HttpOnly
20. 🔄 Agregar .env.example

### Fase 4: Bajo Esfuerzo (Quick Wins)
21. 🔄 Eliminar err.message de respuestas
22. 🔄 Cache de tenant en frontend
23. 🔄 Agregar índices en BD
24. 🔄 Validación de entrada en backend

### Fase 5: Mejoras a Largo Plazo
25. 🔄 Tests (Vitest + Supertest)
26. 🔄 CI/CD con GitHub Actions
27. 🔄 Docker + docker-compose
28. 🔄 Migraciones versionadas
29. 🔄 Documentación de API
30. 🔄 Logging estructurado

## Beneficios Esperados

### Seguridad
- Elimina credenciales en texto plano en frontend
- Protege contra XSS con cookies HttpOnly
- Previene ataques de fuerza bruta con rate limiting
- Cifra todo el tráfico con TLS

### Rendimiento
- Reduce peticiones redundantes con React Query
- Mejora tiempo de carga con lazy loading
- Optimiza transferencia de datos con cache HTTP
- Elimina cuellos de botella con fix N+1

### Mantenibilidad
- Menos código legacy y remanentes de arquitectura anterior
- Separación clara de responsabilidades (frontend vs backend)
- Código más limpio y mantenible
- Mejor experiencia de desarrollo con tests y CI/CD

### Confiable
- Elimina fallbacks que pueden ocultar errores del backend
- Solo el backend es fuente de verdad de datos de negocio
- Mejor manejo de errores visible al usuario
- Estado de aplicación más predecible
