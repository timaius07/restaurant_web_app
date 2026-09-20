# Auditoría del Proyecto — Gestión de Comandas (restaurant_web_app)

**Fecha:** 2026-09-12
**Alcance:** Frontend React (src/), generador de backend (`update_api.cjs` → restaurant_web_api), configuración de build y despliegue.

> Nota: No existe ningún archivo de configuración de nginx ni Docker en el repositorio. La configuración de nginx parece mantenerse manualmente en el servidor (`150.136.175.75`). Las recomendaciones de nginx van dirigidas a ese despliegue.

---

## 1. Brechas de seguridad

### 🔴 Críticas

**S1. La API no tiene autenticación ni autorización.**
El middleware `tenantResolverMiddleware` solo exige el header `X-Tenant-Slug`, que es información pública (la app lo envía desde la pantalla de login). Cualquier persona que conozca el slug de una soda puede, sin login:
- `GET /api/usuarios` → lista completa de usuarios **incluyendo `pinHash` y `passwordHash`** en texto plano.
- `POST /api/facturas`, `DELETE /api/pedidos/detalles/:id`, `PUT /api/configuracion`, etc.
- `POST /api/auditoria` → inyectar entradas falsas en los logs de auditoría (endpoint anónimo).

El login es puramente cosmético: devuelve el objeto de usuario pero **no emite token ni crea sesión en el servidor**. El control de roles (`ProtectedRoute`) existe solo en el frontend y se puede saltar llamando a la API directamente.

**Acción:** emitir JWT (o sesión firmada) en login, validarlo en un middleware posterior a `tenantResolver`, y aplicar autorización por rol en cada ruta sensible (facturas, usuarios, configuración, auditoría).

**S2. Contraseñas y PINs almacenados y comparados en texto plano.**
- `auth/login` ejecuta `WHERE u.username = ? AND (u.passwordHash = ? OR u.pinHash = ?)` — comparación directa en claro.
- `auth/login-pin` acepta como PIN válido la **contraseña en texto plano** (`String(user.passwordHash) === String(pin)`), y acepta `pinHash` sin el formato cifrado AES.
- `usuarios` POST/PUT reciben `passwordHash`/`pinHash` en claro; si no se envían, inserta el default **`'1234'`**.
- `src/data/seedData.js` trae credenciales semilla en claro (`admin123`, `mesero123`…) y `AuthContext.login()` tiene un **fallback de autenticación local** que las usa para crear sesiones sin tocar el servidor.
- El AES-256-GCM del PIN (`encryptPin`) es cifrado simétrico reversible con una clave que, si `PIN_SECRET_KEY` no está en `.env`, cae en el default hardcodeado `'SodaLaTica@2025#PinKey!XZ'` dentro del código fuente.

**Acción:** bcrypt/argon2 para contraseñas; para el PIN de 4 dígitos (baja entropía) guardar solo un HMAC-SHA256 con sal (no reversible); eliminar el login fallback local y las credenciales semilla.

**S3. Todo el tráfico va en HTTP plano.**
El frontend apunta a `http://150.136.175.75:5000/api` por defecto (`apiService.js`, línea 8): PINs, contraseñas y datos de clientes viajan sin cifrar y son interceptables.

**Acción:** TLS obligatorio (nginx + Certbot/Let's Encrypt) y redirigir HTTP→HTTPS.

**S4. CORS totalmente abierto.**
`app.use(cors())` en `server.js` acepta cualquier origen. Combinado con S1, cualquier sitio web puede usar la API desde el navegador de una víctima.

**Acción:** whitelist de orígenes (`cors({ origin: [...] })`); idealmente, servir frontend y API desde el mismo dominio (proxy reverso) y eliminar CORS por completo.

### 🟠 Altas

**S5. Fuga de información en errores.** Todas las rutas responden `res.status(500).json({ error: err.message })`, exponiendo mensajes internos de MySQL (nombres de tablas, columnas, valores). Devolver mensaje genérico y loguear el detalle en el servidor.

**S6. Rate-limiting inadecuado.** El bloqueo por intentos de PIN es un `Map` en memoria: (a) se reinicia con cada deploy/reinicio, (b) es por usuario, no por IP — un ataque distribuido lo ignora, (c) no cubre ningún otro endpoint. Además, con el PIN de 4 dígitos hay solo 10 000 combinaciones: sin límite por IP, el PIN es fuerza-brutable en horas.

**S7. Secretos y endpoints hardcodeados en el cliente.** IP del servidor en `apiService.js`; el slug por defecto `'sodalatica'`; ausencia de `.env.example`. Además `.gitignore` **no incluye `.env`** — un `.env` con `DB_PASSWORD` y `PIN_SECRET_KEY` quedaría versionado.

**S8. Sesión en `localStorage`.** `storage.set('session', …)` guarda la sesión en localStorage: vulnerable a XSS (no se encontró `dangerouslySetInnerHTML`, pero cualquier dependencia futura puede introducirlo). Mover la sesión a cookie `HttpOnly; Secure; SameSite` validada en servidor.

**S9. Endpoint público de empleados.** `GET /api/auth/users-public` expone nombre, rol, email y foto de todos los empleados activos sin autenticación (necesario para la grilla de login, pero es información útil para ataques). Mitigar: exigir un token de "modo kiosk" rotativo, o al menos limitar campos.

### 🟡 Medias

- **S10. Eliminaciones físicas** (`DELETE` en usuarios, mesas, clientes, métodos de pago) sin soft-delete ni verificación de integridad más allá del FK error. Riesgo de pérdida de datos y de historial de auditoría.
- **S11. `express.json()` sin límite de tamaño** y sin `helmet`, sin rate limit global, sin request logging. Añadir `helmet`, `express-rate-limit`, `express.json({ limit: '100kb' })`.
- **S12. Auditoría silenciable.** Los `catch (auditErr) {}` permiten que fallos de auditoría pasen inadvertidos; la auditoría debería ser transaccional o al menos reintentar/loguear.
- **S13. Pools de BD sin techo.** `getTenantPool` crea un pool (10 conexiones) por schema sin límite de tenants; en crecimiento puede agotar conexiones de MySQL. Definir `connectionLimit` por tenant y un total máximo.

---

## 2. Rendimiento de las llamadas a la API

**P1. `reload()` recarga el mundo entero tras cada mutación.**
`AppContext.reload()` dispara 9 peticiones en paralelo (mesas, categorías, productos, clientes, pedidos, facturas, métodos de pago, configuración, usuarios) y luego **una petición por cada pedido activo** para sus detalles. Cada `addMesa`, `updateMesa`, `setMesaEstado`, `addProducto`, etc. ejecuta `await reload()` completo: una jornada típica genera cientos de peticiones redundantes que devuelven datos que no cambiaron.

*Acción:* adoptar invalidación selectiva (React Query / SWR) o, como paso intermedio, devolver la entidad modificada desde el backend y actualizar el estado local sin refetch total.

**P2. Polling de 10 s en ColaComandas recarga todo.**
`setInterval(() => reload(), 10000)` descarga las 9 colecciones + detalles solo para refrescar la cola de cocina.

*Acción:* endpoint dedicado y liviano (`GET /api/pedidos?estado=Preparando&updatedSince=…`) y/o WebSockets/SSE para actualización en tiempo real.

**P3. N+1 en el backend.**
`GET /api/facturas` ejecuta un `SELECT` adicional de detalles **por cada factura**. Con años de facturación esto se degrada linealmente.

*Acción:* un único `SELECT * FROM detalle_facturas WHERE facturaId IN (…)` o un JOIN con agregación en el cliente.

**P4. Sin paginación, filtros ni campos limitados en ningún endpoint.** `/api/pedidos` devuelve todo el historial con `SELECT *`; igual clientes y facturas. Añadir paginación (`LIMIT/OFFSET` o cursor), filtros por estado/fecha y selección explícita de columnas (nunca `SELECT *` en endpoints expuestos — mezcla seguridad y rendimiento).

**P5. `GET /api/usuarios` innecesario en cada sesión.** Devuelve `pinHash`/`passwordHash` (S1) y solo lo usa administración. Cargarlo bajo demanda.

**P6. Falta de caché HTTP.** Sin `Cache-Control`/ETag en Express y, presumiblemente, sin `gzip`/`brotli` ni caché de assets en nginx. Los assets de Vite llevan hash en el nombre: pueden servirse con `Cache-Control: public, max-age=31536000, immutable` y `index.html` con `no-cache`.

**P7. Sin timeout ni abort en `apiService`.** `fetch` sin `AbortController`: un backend colgado congela la UI indefinidamente (solo `haciendaService` lo hace bien — replicar ese patrón en `api`).

**P8. Bundle monolítico.** `recharts` (Reportes) y `html2pdf.js` (Facturación) se cargan para todos los usuarios, incluidos Cocina y Mesero que nunca los usan.

*Acción:* `React.lazy` + `Suspense` por ruta; revisar `manualChunks` en Vite para separar vendor.

**P9. Índices de BD.** Verificar índices en las foreign keys más consultadas (`pedidoId`, `facturaId`, `mesaId`, `estado`, `fechaApertura`, `fechaEmision`). El schema vive en `database_schema.sql`; el filtro de pedidos activos en `reload()` (`WHERE estado IN …`) se beneficiaría de un índice compuesto.

**P10. Cache de tenant mal ubicado.** `tenantResolver` cachea metadata 1 min en memoria (bien), pero el frontend vuelve a pedir `/public/tenant/info/:slug` en cada navegación. Cachear en el cliente con el mismo TTL.

---

## 3. Manejo de errores

**E1. Errores de red no se distinguen de errores HTTP.** En `apiService` solo se procesa `!res.ok`; un `fetch` rechazado (backend caído, DNS, timeout) propaga el TypeError crudo. Normalizar: `{ kind: 'network' | 'http' | 'timeout' }`.

**E2. Fallos silenciosos en la carga inicial.** Si `reload()` falla, se loguea en consola y la app queda con colecciones vacías sin avisar al usuario — parece que "no hay datos" en vez de "no hay conexión".

*Acción:* estado global de conectividad + banner/toast de "sin conexión con el servidor", con reintento.

**E3. Fallbacks que enmascaran problemas.** `getPublicUsers` cae a `seedData` sin aviso; `login` crea una sesión local válida con credenciales semilla aunque el backend esté caído — y esa sesión luego falla en cada llamada. Eliminar los fallbacks de autenticación (S2) y mostrar estado de degradación explícito.

**E4. Backend sin handler de errores central ni 404.** Cada ruta repite `try/catch` con `err.message` en la respuesta (S5); no hay middleware de error ni respuesta para rutas inexistentes. Unificar con middleware de error + `app.use((req,res)=>res.status(404)…)`.

**E5. Errores de negocio vs. sistema no diferenciados.** Todo cae en 500; el 429 del rate-limit es la única excepción. Definir códigos coherentes (400 validación, 401/403 auth, 404, 409 conflicto — p. ej. duplicados —, 500 interno).

**E6. `updateSettings` falla en silencio hacia el usuario.** Si `PUT /configuracion` falla, solo hay `console.error`: el usuario cree que guardó. Mostrar toast de error y revertir el estado optimista.

**E7. Sin reintentos ni deduplicación.** Llamadas idempotentes (GETs) no reintentan ante fallos transitorios; tampoco se cancelan entre navegaciones. Combinar P7 (AbortController) con reintento con backoff y "stale-while-revalidate" (React Query lo resuelve).

**E8. Validación de entrada inexistente en el backend.** Los POST/PUT confían en el cuerpo del request (`nombre` puede ser `undefined` → `INSERT` con NULL → error crudo de MySQL al cliente). Añadir validación (zod/joi/express-validator) con 400 y mensajes claros.

---

## 4. Nginx (despliegue en `150.136.175.75`)

No hay configuración versionada. Recomendación estructural: crear `nginx/conf.d/app.conf` (o `deploy/nginx.conf`) en el repo y desplegarlo con CI/CD. Contenido mínimo sugerido:

```nginx
server_tokens off;
client_max_body_size 200k;

# compresión
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

        # rate limit sobre auth (complementa S6)
        limit_req zone=login burst=5 nodelay;
    }

    # SPA fallback para React Router (rutas con /:slug/...)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # assets con hash de Vite: caché agresivo
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }
}
```

```nginx
# en http {}
limit_req_zone $binary_remote_addr zone=login:10m rate=10r/m;
```

**N1.** Proxy reverso `/api` → el frontend usa rutas relativas (`/api`), se elimina la IP hardcodeada y el CORS abierto, y todo sale por 443.

**N2.** TLS con Certbot (S3). Hoy todo es HTTP 5000 expuesto al mundo.

**N3.** `try_files` para el SPA — sin esto, recargar `/sodalatica/pedidos` da 404 según el server block actual.

**N4.** Caché y compresión (P6).

**N5.** `limit_req` en `/api/auth/*` — mitigación inmediata de fuerza bruta mientras se implementa S1/S6 (no es sustituto de auth real).

**N6.** Bloquear el puerto 5000 en el firewall (solo localhost) una vez existe el proxy.

---

## 5. Mejoras generales

1. **Tests:** no hay ninguno. Mínimo: tests de rutas críticas del API (auth, facturas) y de componentes clave (Login, ColaComandas). `vitest` + `supertest` encajan bien con el stack.
2. **CI/CD:** GitHub Actions con `lint` (`--max-warnings 0` ya está en package.json pero no corre en CI), build, tests y deploy (subir `dist` + recargar nginx + reiniciar API con PM2/systemd).
3. **Docker / docker-compose:** hoy el deploy es manual y `update_api.cjs` es un generador que sobrescribe archivos del backend. Versionar el backend como proyecto propio (no como template string) y dockerizar `nginx + api + mysql` para entornos reproducibles.
4. **Migraciones de BD:** `ensureConfigTable` hace `CREATE TABLE IF NOT EXISTS` dentro de una ruta. Usar migraciones versionadas (umzgit/Flyway) junto a `database_schema.sql`.
5. **Documentación de API:** OpenAPI/Swagger (o al menos un `API.md`) — facilita auditoría de seguridad y onboarding.
6. **Logging estructurado** (pino) con request-id y nivel configurable; hoy solo `console.error` dispersos.
7. **Manejo de configuración:** crear `.env.example`, quitar todos los defaults hardcodeados con secretos (DB password, `PIN_SECRET_KEY`, IP), añadir `.env` a `.gitignore`.
8. **Calidad de datos:** soft-delete en entidades de negocio, constraints FK revisados (DELETE de cliente con pedidos ya responde 1451 — mapearlo a 409), unicidad de `username`/`numeroMesa` con mensajes amigables.
9. **Generación de número de factura:** `MAX(numeroFactura)`-like bajo transacción con locks; con concurrencia (dos cajas facturando) puede duplicar correlativos. Usar una secuencia/ tabla contador con `SELECT … FOR UPDATE`.
10. **Seguridad del build:** revisar que `dist` no incluya sourcemaps en producción (`build.sourcemap` en vite.config) y que `dist` no se versione (hoy está en disco; `.gitignore` sí lo cubre).
11. **Separación frontend/backend:** el slug de tenant en la URL se decide en el cliente y se repite en un header; consolidar resolución de tenant en un solo lugar (backend) para evitar inconsistencias (`getCurrentTenantSlug` tiene 3 fuentes: ruta, localStorage, default).

---

## Prioridades recomendadas

| # | Acción | Impacto | Esfuerzo |
|---|--------|---------|----------|
| 1 | Autenticación real en la API (JWT + middleware + roles) — S1 | Crítico | Medio |
| 2 | TLS + proxy reverso nginx (quitar IP hardcodeada) — S3/N1 | Crítico | Bajo |
| 3 | Hash de contraseñas (bcrypt) y eliminar fallbacks locales — S2 | Crítico | Bajo |
| 4 | Cerrar CORS, helmet, rate limit por IP — S4/S6/S11 | Alto | Bajo |
| 5 | Invalidación selectiva / React Query en frontend — P1/P2 | Alto | Medio |
| 6 | Quitar `err.message` de respuestas, handler de errores central — S5/E4 | Alto | Bajo |
| 7 | Timeout/abort + estados de error visibles en UI — P7/E2/E6 | Alto | Bajo |
| 8 | Paginación + fix N+1 facturas — P3/P4 | Medio | Bajo |
| 9 | Rate limit nginx en /api/auth — N5 | Medio | Bajo |
| 10 | Lazy loading de rutas — P8 | Medio | Bajo |
