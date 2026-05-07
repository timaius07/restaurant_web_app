# Implementación de Facturación Dividida (Split Billing)

Se implementará la funcionalidad para facturar los productos de un pedido por separado. Esto es útil cuando varios clientes en una misma mesa desean pagar sus partes de forma independiente.

## User Review Required

- **Estructura de Datos**: Se añadirá `cantidadFacturada` a los `DetallePedido` existentes y nuevos. También se añadirá el arreglo `detalles` a la entidad `Factura` para guardar los items específicos que se cobraron en esa transacción. ¿Estás de acuerdo con este enfoque estructural de cara a una futura BD relacional?
- **Flujo de Usuario (UI)**: En el modal de facturación, se mostrará la cantidad original, la pendiente de facturar y un control numérico o botones (+/-) para elegir cuántos productos de esa línea se desean facturar en el momento. Si no se factura todo el pedido, la mesa no se libera ni se marca el pedido como "Pagado" hasta completar el 100%.

## Proposed Changes

### Contexto y Almacenamiento (`src/context/AppContext.jsx`)

- **Modificar `addDetalle`**: Inicializar el campo `cantidadFacturada: 0` al crear un nuevo detalle de pedido.
- **Modificar `emitirFactura`**: 
  - Recibir un parámetro adicional `itemsAFacturar` (lista de `detalleId` y `cantidad`).
  - Calcular el subtotal y los impuestos basándose **únicamente** en los items seleccionados.
  - Guardar dentro de la nueva `Factura` el detalle de los productos cobrados (para el futuro histórico de BD).
  - Actualizar `cantidadFacturada` en cada registro de `DetallePedido`.
  - Evaluar si la sumatoria de `cantidadFacturada` de todos los detalles del pedido es igual o mayor a la cantidad original. Solo si se ha facturado el 100%, cambiar el estado del pedido a "Pagado" y liberar la mesa.

### UI de Facturación (`src/pages/Facturacion.jsx`)

- **Estado de Items a Facturar**: Crear un estado local en el modal de facturación para llevar el control de cuáles items y qué cantidades se quieren facturar.
- **Sección de Productos**: Cambiar la tabla del modal para reflejar:
  - Producto
  - Pendiente (Cant. original - Cant. ya facturada)
  - A facturar (Control numérico ajustable entre 0 y el pendiente)
  - Subtotal dinámico de la línea.
- **Cálculo de Totales**: Ajustar el cálculo del subtotal, IVA y Total para reaccionar inmediatamente a los cambios en "A facturar".
- **Visualización de Factura**: Modificar el modal de "Ver Factura" (historial) para que lea los detalles guardados dentro del objeto `Factura` en vez de intentar adivinar por el pedido.

## Verification Plan

### Manual Verification
1. Abrir un pedido con varios items (ej. 2 hamburguesas, 1 refresco).
2. Servir el pedido e ir a Facturación.
3. Al facturar, cambiar la cantidad de la hamburguesa a 1 y dejar el refresco en 0.
4. Emitir la factura. Verificar que el total es correcto para esa única hamburguesa.
5. Verificar que el pedido sigue mostrándose en pendientes de facturar.
6. Volver a abrir la facturación para ese pedido. Verificar que el pendiente es de 1 hamburguesa y 1 refresco.
7. Facturar el restante. Confirmar que ahora sí el pedido desaparece de pendientes y la mesa se libera.
8. Revisar el historial de facturas para ver ambas transacciones detalladas correctamente.
