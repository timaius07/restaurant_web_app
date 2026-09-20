# Configuración de Envío de Facturas por Email

## Resumen de Implementación

Se ha implementado un sistema profesional de envío de facturas por email con PDF adjunto, similar al formato de facturación electrónica de Hacienda.

## Características Implementadas

### Frontend
- **Generación de PDF profesional**: Nueva función `generateInvoicePDF` en `src/utils/pdfExport.js` que crea PDFs con diseño profesional
- **Envío automático**: Modificación de `sendFacturaByEmail` en `src/pages/Facturacion.jsx` para enviar emails automáticamente en lugar de abrir cliente de correo local
- **PDF adjunto**: El PDF se genera en el frontend y se envía como base64 al backend para adjuntarlo al email

### Backend
- **Endpoint de email**: Nueva ruta `/api/email/send-invoice` en `routes/emailRoutes.js`
- **Nodemailer**: Integración con nodemailer para envío de emails profesionales
- **Autenticación**: El endpoint requiere autenticación (`requireAuth`)

## Configuración del Backend

### 1. Instalar Dependencias

En el directorio del backend (`../restaurant_web_api`), instalar nodemailer:

```bash
npm install nodemailer
```

### 2. Configurar Variables de Entorno

Agregar las siguientes variables al archivo `.env` del backend:

```env
# Configuración de Email (Nodemailer)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_password_app
EMAIL_FROM="Sistema de Comandas" <tu_email@gmail.com>
```

### 3. Regenerar el Backend

Ejecutar el script `update_api.cjs` para regenerar el backend con la nueva funcionalidad:

```bash
node update_api.cjs
```

Esto creará:
- `routes/emailRoutes.js` - Ruta para envío de emails
- Actualización de `server.js` - Incluye la nueva ruta de email
- Actualización de `.env.example` - Variables de configuración de email

## Configuración de Proveedores de Email

### Gmail (Recomendado)

1. Habilitar autenticación de 2 pasos en la cuenta de Gmail
2. Generar una "Contraseña de aplicación":
   - Ir a https://myaccount.google.com/apppasswords
   - Seleccionar "Correo" y "Otro (nombre personalizado)"
   - Copiar la contraseña generada
3. Configurar `.env`:
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=la_contraseña_de_aplicación_generada
EMAIL_FROM="Tu Restaurante" <tu_email@gmail.com>
```

### Outlook/Hotmail

```env
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=tu_email@outlook.com
EMAIL_PASS=tu_contraseña
EMAIL_FROM="Tu Restaurante" <tu_email@outlook.com>
```

### SendGrid (Para uso empresarial)

```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASS=SG.YOUR_API_KEY
EMAIL_FROM="Tu Restaurante" <noreply@tudominio.com>
```

### Otros Proveedores

Consultar la documentación de tu proveedor de email para obtener:
- `EMAIL_HOST`: Servidor SMTP
- `EMAIL_PORT`: Puerto (587 para TLS, 465 para SSL)
- `EMAIL_SECURE`: `true` para SSL (puerto 465), `false` para TLS (puerto 587)
- `EMAIL_USER`: Usuario de autenticación
- `EMAIL_PASS`: Contraseña de autenticación

## Funcionamiento del Sistema

### Flujo de Envío

1. **Usuario hace clic en el icono de correo** en el historial de facturas
2. **Frontend genera PDF profesional** usando `generateInvoicePDF`
3. **PDF se convierte a base64** para transferencia segura
4. **Frontend envía al backend**:
   - `facturaId`: ID de la factura
   - `email`: Email del cliente
   - `asunto`: Asunto personalizado del email
   - `mensaje`: Cuerpo del mensaje
   - `pdfBase64`: PDF en formato base64
5. **Backend recibe y procesa**:
   - Valida autenticación del usuario
   - Obtiene datos adicionales de la factura y cliente
   - Convierte base64 a buffer
   - Envía email con PDF adjunto usando nodemailer
6. **Cliente recibe email** con PDF profesional adjunto

### Diseño del PDF

El PDF generado incluye:
- **Header profesional**: Logo/nombre del negocio, razón social, cédula jurídica, contacto
- **Datos de factura**: Número de factura, fecha, origen (mesa/delivery)
- **Datos del cliente**: Nombre, identificación fiscal, teléfono, email
- **Tabla de productos**: Cantidad, descripción, precio unitario, subtotal
- **Resumen financiero**: Subtotal, IVA 13%, servicio (si aplica), total
- **Pie de página**: Método de pago, agradecimiento, información de contacto

## Personalización del Email

### Asunto del Email

El asunto se genera automáticamente como:
```
Factura Electrónica {numeroFactura} — {nombreRestaurante}
```

### Cuerpo del Email

El cuerpo del email se genera automáticamente como:
```
Estimado/a {nombreCliente},

Adjuntamos su factura electrónica por su compra.

Gracias por su preferencia.
{nombreRestaurante} | Tel: {telefono}
```

## Troubleshooting

### Error: "Email del cliente es requerido"
- Solución: Registrar email del cliente en el sistema antes de enviar factura

### Error: "Error al enviar el email"
- Verificar configuración de variables de entorno
- Confirmar que las credenciales de email son correctas
- Verificar que el puerto y host del SMTP son correctos
- Revisar logs del backend para más detalles

### Error: "PDF de la factura es requerido"
- Este error es interno y no debería ocurrir
- Si persiste, verificar que `html2pdf.js` está instalado correctamente

### Emails no llegan
- Verificar carpeta de spam del destinatario
- Confirmar que el remitente está configurado correctamente
- Verificar límites de envío del proveedor de email
- Revisar logs del backend para errores SMTP

## Seguridad

- **Autenticación requerida**: Solo usuarios autenticados pueden enviar emails
- **Validación de email**: Se valida que el cliente tenga email registrado
- **HTTPS recomendado**: Para producción, usar HTTPS para todas las comunicaciones
- **No exponer credenciales**: Nunca cometer archivos `.env` con contraseñas reales

## Pruebas

### Prueba de Desarrollo

1. Configurar email de desarrollo
2. Crear una factura de prueba
3. Registrar email de prueba en el cliente
4. Enviar factura por email
5. Verificar que el email llegue con PDF adjunto

### Prueba de Producción

1. Configurar email de producción
2. Verificar dominio SPF/DKIM si es necesario
3. Probar con clientes reales
4. Monitorear logs del backend

## Actualización del Plan Original

Esta implementación reemplaza el sistema anterior que usaba `mailto:` (que solo abría el cliente de correo local) por un sistema profesional de envío automático con PDF adjunto, similar al formato de facturación electrónica mostrado en el ejemplo.

## Archivos Modificados

- `src/utils/pdfExport.js` - Nueva función `generateInvoicePDF`
- `src/pages/Facturacion.jsx` - Modificación de `sendFacturaByEmail`
- `update_api.cjs` - Agregada ruta de email y configuración
- `.env.example` - Variables de configuración de email

## Archivos Nuevos

- `routes/emailRoutes.js` - Ruta de envío de emails (generado por update_api.cjs)