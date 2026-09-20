# Sistema de Comandas — Walkthrough Final

## ✅ Resumen

El sistema de gestión de comandas está 100% funcional y corriendo en `http://localhost:5173/`.

---

## Capturas del Sistema

### Login
![Login page](/C:/Users/Marco/.gemini/antigravity/brain/989fa42d-431b-4025-93de-68a12ab92565/.system_generated/click_feedback/click_feedback_1777438980287.png)

### Dashboard (Admin)
![Dashboard](/C:/Users/Marco/.gemini/antigravity/brain/989fa42d-431b-4025-93de-68a12ab92565/.system_generated/click_feedback/click_feedback_1777438992299.png)

### Mesas (Grid visual)
![Mesas](/C:/Users/Marco/.gemini/antigravity/brain/989fa42d-431b-4025-93de-68a12ab92565/.system_generated/click_feedback/click_feedback_1777439000459.png)

### Agregar Producto al Pedido
![Add Product](/C:/Users/Marco/.gemini/antigravity/brain/989fa42d-431b-4025-93de-68a12ab92565/.system_generated/click_feedback/click_feedback_1777439135165.png)

### Vista Cajero — Pedidos
![Cajero Pedidos](/C:/Users/Marco/.gemini/antigravity/brain/989fa42d-431b-4025-93de-68a12ab92565/.system_generated/click_feedback/click_feedback_1777439285967.png)

---

## Flujo del Ciclo Completo Verificado

```
Mesero abre pedido en mesa libre (Mesa 1)
  → Agrega productos (con categoría, cantidad, notas)
  → Envía a cocina (estado: Preparando)
    → Cocina ve ticket → Inicia preparación → Marca como Servido
      → Cajero ve pedido "Servido" → Factura con método de pago
        → Mesa vuelve a "Libre" automáticamente
          → Factura queda en historial con número FAC-2026-XXXX
```

---

## Roles y Páginas de Inicio

| Rol | Página al hacer login |
|-----|----------------------|
| **Admin** | `/dashboard` — KPIs + gráficas |
| **Mesero** | `/mesas` — Grid de mesas |
| **Cocina** | `/cocina` — Cola de comandas |
| **Cajero** | `/pedidos` — Lista de pedidos |

## Credenciales Demo

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| admin | admin123 | Admin |
| mesero1 | mesero123 | Mesero |
| cocina1 | cocina123 | Cocina |
| cajero1 | cajero123 | Cajero |

---

## Archivos Creados

| Archivo | Descripción |
|---------|-------------|
| `src/styles/globals.css` | Design system completo (dark/light, variables, animaciones) |
| `src/data/seedData.js` | Datos iniciales (mesas, productos, clientes, etc.) |
| `src/services/storageService.js` | Capa CRUD sobre localStorage |
| `src/context/AuthContext.jsx` | Autenticación y sesión por rol |
| `src/context/AppContext.jsx` | Estado global de toda la app |
| `src/components/layout/Sidebar.jsx` | Menú lateral dinámico por rol |
| `src/components/layout/Topbar.jsx` | Barra superior (tema, moneda, usuario) |
| `src/pages/Login.jsx` | Login + acceso rápido demo |
| `src/pages/Dashboard.jsx` | KPIs + gráficas de ventas |
| `src/pages/Mesas.jsx` | Grid visual de mesas con estados |
| `src/pages/Pedidos/DetallePedido.jsx` | Gestión de líneas de pedido |
| `src/pages/Pedidos/ListaPedidos.jsx` | Lista con filtros por estado |
| `src/pages/ColaComandas.jsx` | Vista de cocina con tickets |
| `src/pages/Facturacion.jsx` | Emisión y historial de facturas |
| `src/pages/Clientes.jsx` | CRUD de clientes |
| `src/pages/Productos.jsx` | CRUD de productos con stock |
| `src/pages/Categorias.jsx` | CRUD de categorías |
| `src/pages/Usuarios.jsx` | CRUD de usuarios (solo Admin) |
| `src/pages/MetodosPago.jsx` | CRUD de métodos de pago |
| `src/pages/Configuracion.jsx` | IVA, moneda, tema, nombre restaurante |
| `src/pages/Reportes.jsx` | Gráficas de ventas y top productos |

---

## Próximos pasos sugeridos

- **Backend Node.js**: Reemplazar `storageService.js` con llamadas fetch/axios
- **Autenticación real**: JWT con bcrypt en el backend
- **PWA**: Agregar `vite-plugin-pwa` para usar en tabletas offline
- **Impresión de tickets**: Hojas de estilo `@media print` específicas por ticket
- **Multi-sucursal**: Agregar tabla de sucursales al modelo de datos
