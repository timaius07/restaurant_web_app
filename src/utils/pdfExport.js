import html2pdf from 'html2pdf.js';
import toast from 'react-hot-toast';

/**
 * Exporta un elemento del DOM a un archivo PDF descargable usando html2pdf.js
 * @param {string} elementId ID del contenedor HTML a exportar
 * @param {string} filename Nombre del archivo .pdf de salida
 */
export const exportElementToPDF = async (elementId, filename = 'Reporte.pdf') => {
  const element = document.getElementById(elementId);
  if (!element) {
    toast.error('No se encontró el elemento para exportar');
    return;
  }

  const toastId = toast.loading('Generando documento PDF...');

  try {
    const opt = {
      margin: [8, 8, 8, 8],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    await html2pdf().set(opt).from(element).save();
    toast.success('PDF generado y descargado', { id: toastId });
  } catch (err) {
    console.error('Error al exportar PDF:', err);
    toast.error('Abriendo vista de impresión/PDF...', { id: toastId });
    window.print();
  }
};

/**
 * Genera un PDF profesional de factura y lo devuelve como Blob
 *
 * IMPORTANTE: este HTML se renderiza con html2canvas, que tiene soporte
 * incompleto/defectuoso para CSS Flexbox (secciones con display:flex a
 * menudo no se dibujan en el canvas, o colapsan a altura 0). Por eso todo
 * el layout aquí usa <table>, nunca flex.
 *
 * @param {Object} factura - Datos de la factura
 * @param {Object} settings - Configuración del negocio
 * @param {Object} cliente - Datos del cliente
 * @param {Array} items - Items de la factura
 * @param {Object} pedido - Datos del pedido
 * @returns {Promise<Blob>} Blob del PDF generado
 */
export const generateInvoicePDF = async (factura, settings, cliente, items, pedido) => {
  const { formatCurrency, formatDate } = await import('./formatters');
  const fmt = (v) => formatCurrency(v, settings.moneda, settings.tasaCambio);

  const metodoPago = pedido?.metodoPagoNombre || 'Efectivo';
  const origen = pedido?.tipoPedido === 'Delivery' ? 'Delivery / Para Llevar' : 'Consumo en local';

  const subtotalBase = factura.subtotal || Math.round(factura.total / 1.13);
  const impuestosIVA = factura.impuestos || (factura.total - subtotalBase);
  const montoServicio = factura.servicio || 0;
  const totalFinal = factura.total || 0;

  const filas = items.map((item) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${item.cantidad}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${item.productoNombre || 'Producto'}</td>
      <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${fmt(item.precioMomento)}</td>
      <td style="padding: 8px; text-align: right; border: 1px solid #ddd; font-weight: bold;">${fmt(item.precioMomento * item.cantidad)}</td>
    </tr>
  `).join('');

  // Layout 100% basado en <table> (nada de display:flex/grid) para que
  // html2canvas lo dibuje de forma confiable.
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; width: 760px; padding: 20px; color: #333; background: #fff;">
      <!-- Header del negocio -->
      <table style="width: 100%; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px;">
        <tr>
          <td style="vertical-align: top; width: 50%;">
            <h1 style="margin: 0 0 10px 0; font-size: 24px; color: #333;">${settings.nombreRestaurante || 'Sistema de Comandas'}</h1>
            <p style="margin: 5px 0; font-size: 12px; color: #666;">${settings.razonSocial || ''}</p>
            <p style="margin: 5px 0; font-size: 12px; color: #666;">Cédula Jurídica: ${settings.cedulaJuridica || 'N/A'}</p>
            <p style="margin: 5px 0; font-size: 12px; color: #666;">Teléfono: ${settings.telefono || 'N/A'}</p>
            <p style="margin: 5px 0; font-size: 12px; color: #666;">Email: ${settings.correo || 'N/A'}</p>
          </td>
          <td style="vertical-align: top; width: 50%; text-align: right;">
            <h2 style="margin: 0 0 10px 0; font-size: 20px; color: #333;">FACTURA ELECTRÓNICA</h2>
            <p style="margin: 5px 0; font-size: 14px; font-weight: bold; color: #333;">N° ${factura.numeroFactura}</p>
            <p style="margin: 5px 0; font-size: 12px; color: #666;">Fecha: ${formatDate(factura.fechaEmision)}</p>
            <p style="margin: 5px 0; font-size: 12px; color: #666;">Origen: ${origen}</p>
          </td>
        </tr>
      </table>

      <!-- Información del cliente -->
      <table style="width: 100%; margin-bottom: 20px; background: #f5f5f5; border-radius: 5px;">
        <tr>
          <td style="padding: 15px;">
            <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #333;">DATOS DEL CLIENTE</h3>
            <p style="margin: 5px 0; font-size: 12px; color: #666;"><strong>Nombre:</strong> ${cliente?.nombre || 'Cliente General'}</p>
            <p style="margin: 5px 0; font-size: 12px; color: #666;"><strong>Identificación:</strong> ${cliente?.identificacionFiscal || 'N/A'}</p>
            <p style="margin: 5px 0; font-size: 12px; color: #666;"><strong>Teléfono:</strong> ${cliente?.telefono || 'N/A'}</p>
            <p style="margin: 5px 0; font-size: 12px; color: #666;"><strong>Email:</strong> ${cliente?.email || 'N/A'}</p>
          </td>
        </tr>
      </table>

      <!-- Tabla de productos -->
      <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #333;">DETALLE DE PRODUCTOS</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
        <thead>
          <tr style="background: #333; color: white;">
            <th style="padding: 10px; text-align: left; border: 1px solid #333;">Cant.</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #333;">Descripción</th>
            <th style="padding: 10px; text-align: right; border: 1px solid #333;">P. Unit.</th>
            <th style="padding: 10px; text-align: right; border: 1px solid #333;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>

      <!-- Resumen financiero -->
      <table style="width: 100%; margin-bottom: 20px;">
        <tr>
          <td></td>
          <td style="width: 300px; padding: 15px; background: #f5f5f5; border-radius: 5px;">
            <table style="width: 100%; font-size: 12px; color: #666;">
              <tr>
                <td style="padding: 3px 0;">Subtotal (sin IVA):</td>
                <td style="padding: 3px 0; text-align: right;">${fmt(subtotalBase)}</td>
              </tr>
              <tr>
                <td style="padding: 3px 0;">IVA 13%:</td>
                <td style="padding: 3px 0; text-align: right;">${fmt(impuestosIVA)}</td>
              </tr>
              ${montoServicio > 0 ? `
              <tr>
                <td style="padding: 3px 0;">Servicio 10%:</td>
                <td style="padding: 3px 0; text-align: right;">${fmt(montoServicio)}</td>
              </tr>` : ''}
              <tr>
                <td style="padding-top: 10px; border-top: 2px solid #333; font-size: 16px; font-weight: bold; color: #333;">TOTAL:</td>
                <td style="padding-top: 10px; border-top: 2px solid #333; font-size: 16px; font-weight: bold; color: #333; text-align: right;">${fmt(totalFinal)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Pie de página -->
      <table style="width: 100%; border-top: 1px solid #ddd; padding-top: 20px;">
        <tr>
          <td style="text-align: center; font-size: 11px; color: #666;">
            <p style="margin: 5px 0;">Método de pago: ${metodoPago}</p>
            <p style="margin: 5px 0;">Gracias por su preferencia</p>
            <p style="margin: 5px 0;">${settings.nombreRestaurante || ''} | ${settings.telefono || ''}</p>
          </td>
        </tr>
      </table>
    </div>
  `;

  // Crear un elemento temporal para generar el PDF.
  // Ancho fijo (800px) para que no colapse por estar en position:absolute
  // fuera de la ventana visible.
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  tempDiv.style.position = 'absolute';
  tempDiv.style.top = '0';
  tempDiv.style.left = '-9999px';
  tempDiv.style.width = '800px';
  document.body.appendChild(tempDiv);

  // Esperar a que las fuentes web terminen de cargar antes de capturar;
  // si html2canvas dibuja antes de que carguen, el texto puede salir vacío.
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  try {
    const opt = {
      margin: [10, 10, 10, 10],
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        width: 800,
        windowWidth: 800,
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    const pdf = await html2pdf().set(opt).from(tempDiv).output('blob');
    document.body.removeChild(tempDiv);
    return pdf;
  } catch (err) {
    document.body.removeChild(tempDiv);
    throw err;
  }
};