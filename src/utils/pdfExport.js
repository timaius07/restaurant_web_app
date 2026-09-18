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
      margin:       [8, 8, 8, 8],
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
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

  // Crear HTML profesional para la factura
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333;">
      <!-- Header del negocio -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
        <div style="flex: 1;">
          <h1 style="margin: 0 0 10px 0; font-size: 24px; color: #333;">${settings.nombreRestaurante || 'Sistema de Comandas'}</h1>
          <p style="margin: 5px 0; font-size: 12px; color: #666;">${settings.razonSocial || ''}</p>
          <p style="margin: 5px 0; font-size: 12px; color: #666;">Cédula Jurídica: ${settings.cedulaJuridica || 'N/A'}</p>
          <p style="margin: 5px 0; font-size: 12px; color: #666;">Teléfono: ${settings.telefono || 'N/A'}</p>
          <p style="margin: 5px 0; font-size: 12px; color: #666;">Email: ${settings.correo || 'N/A'}</p>
        </div>
        <div style="text-align: right; flex: 1;">
          <h2 style="margin: 0 0 10px 0; font-size: 20px; color: #333;">FACTURA ELECTRÓNICA</h2>
          <p style="margin: 5px 0; font-size: 14px; font-weight: bold; color: #333;">N° ${factura.numeroFactura}</p>
          <p style="margin: 5px 0; font-size: 12px; color: #666;">Fecha: ${formatDate(factura.fechaEmision)}</p>
          <p style="margin: 5px 0; font-size: 12px; color: #666;">Origen: ${origen}</p>
        </div>
      </div>

      <!-- Información del cliente -->
      <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 5px;">
        <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #333;">DATOS DEL CLIENTE</h3>
        <p style="margin: 5px 0; font-size: 12px; color: #666;"><strong>Nombre:</strong> ${cliente?.nombre || 'Cliente General'}</p>
        <p style="margin: 5px 0; font-size: 12px; color: #666;"><strong>Identificación:</strong> ${cliente?.identificacionFiscal || 'N/A'}</p>
        <p style="margin: 5px 0; font-size: 12px; color: #666;"><strong>Teléfono:</strong> ${cliente?.telefono || 'N/A'}</p>
        <p style="margin: 5px 0; font-size: 12px; color: #666;"><strong>Email:</strong> ${cliente?.email || 'N/A'}</p>
      </div>

      <!-- Tabla de productos -->
      <div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #333;">DETALLE DE PRODUCTOS</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #333; color: white;">
              <th style="padding: 10px; text-align: left; border: 1px solid #333;">Cant.</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #333;">Descripción</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #333;">P. Unit.</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #333;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${item.cantidad}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${item.productoNombre || 'Producto'}</td>
                <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${fmt(item.precioMomento)}</td>
                <td style="padding: 8px; text-align: right; border: 1px solid #ddd; font-weight: bold;">${fmt(item.precioMomento * item.cantidad)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Resumen financiero -->
      <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
        <div style="width: 300px; padding: 15px; background: #f5f5f5; border-radius: 5px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12px; color: #666;">
            <span>Subtotal (sin IVA):</span>
            <span>${fmt(subtotalBase)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12px; color: #666;">
            <span>IVA 13%:</span>
            <span>${fmt(impuestosIVA)}</span>
          </div>
          ${montoServicio > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12px; color: #666;">
              <span>Servicio 10%:</span>
              <span>${fmt(montoServicio)}</span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 2px solid #333; font-size: 16px; font-weight: bold; color: #333;">
            <span>TOTAL:</span>
            <span>${fmt(totalFinal)}</span>
          </div>
        </div>
      </div>

      <!-- Pie de página -->
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 11px; color: #666;">
        <p style="margin: 5px 0;">Método de pago: ${metodoPago}</p>
        <p style="margin: 5px 0;">Gracias por su preferencia</p>
        <p style="margin: 5px 0;">${settings.nombreRestaurante || ''} | ${settings.telefono || ''}</p>
      </div>
    </div>
  `;

  // Crear un elemento temporal para generar el PDF
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  document.body.appendChild(tempDiv);

  try {
    const opt = {
      margin:       [10, 10, 10, 10],
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    const pdf = await html2pdf().set(opt).from(tempDiv).output('blob');
    document.body.removeChild(tempDiv);
    return pdf;
  } catch (err) {
    document.body.removeChild(tempDiv);
    throw err;
  }
};
