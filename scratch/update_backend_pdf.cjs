const fs = require('fs');
const path = require('path');

const targetApiDir = path.resolve(__dirname, '../../restaurant_web_api');
const servicesDir = path.join(targetApiDir, 'services');
const routesDir = path.join(targetApiDir, 'routes');

if (!fs.existsSync(servicesDir)) {
  fs.mkdirSync(servicesDir, { recursive: true });
}

// =========================================================================
// 1. services/pdfInvoiceService.js (Adaptado 100% a Régimen Simplificado CR)
// =========================================================================
const pdfInvoiceServiceContent = `const PDFDocument = require('pdfkit');

/**
 * Formatea un número a moneda colones costarricenses (CRC)
 * Ejemplo: 11600 -> ¢11,600.00
 */
function formatColones(value) {
  const num = Number(value) || 0;
  return '\\u00a2' + num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * Genera el Buffer de un PDF vectorial profesional para Régimen de Tributación Simplificada
 */
function generateInvoicePDFBuffer({ settings = {}, factura = {}, cliente = {}, detalles = [], metodoPagoLabel = 'Efectivo', origenLabel = 'Consumo en Salón' }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 28, bottom: 28, left: 28, right: 28 },
        autoFirstPage: true,
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const fechaEmision = factura.fechaEmision ? new Date(factura.fechaEmision) : new Date();
      const dia = String(fechaEmision.getDate());
      const mes = MESES[fechaEmision.getMonth()] || '';
      const anio = String(fechaEmision.getFullYear());

      const pageWidth = 612;
      const margin = 28;
      const contentWidth = pageWidth - margin * 2; // 556 pt

      let y = 28;

      // =========================================================================
      // 1. ENCABEZADO: EMISOR (Izquierda) y LOGO / RÉGIMEN (Derecha)
      // =========================================================================
      const leftColWidth = 330;
      const rightColX = margin + leftColWidth + 10;
      const rightColWidth = contentWidth - leftColWidth - 10;

      doc.font('Helvetica-Bold').fontSize(11).fillColor('#111111')
        .text(settings.nombreRestaurante || 'Soda / Restaurante', margin, y);
      y += 13;

      doc.font('Helvetica').fontSize(8.5).fillColor('#444444');
      if (settings.razonSocial) {
        doc.text(settings.razonSocial, margin, y);
        y += 11;
      }
      if (settings.direccion) {
        doc.text(settings.direccion, margin, y);
        y += 11;
      }
      if (settings.telefono) {
        doc.text(\`Tel: \${settings.telefono}\`, margin, y);
        y += 11;
      }
      if (settings.cedulaJuridica) {
        doc.text(\`C\u00e9dula Jur\u00eddica: \${settings.cedulaJuridica}\`, margin, y);
        y += 11;
      }
      if (settings.correo) {
        doc.text(\`Email: \${settings.correo}\`, margin, y);
        y += 11;
      }

      // Logotipo o membrete de Régimen Simplificado a la derecha
      let logoDrawn = false;
      if (settings.logoBase64 || settings.logo) {
        try {
          const rawLogo = settings.logoBase64 || settings.logo;
          const commaIdx = rawLogo.indexOf(',');
          const base64Data = commaIdx !== -1 ? rawLogo.slice(commaIdx + 1) : rawLogo;
          const imgBuffer = Buffer.from(base64Data, 'base64');
          if (imgBuffer.length > 0) {
            doc.image(imgBuffer, rightColX, 28, { fit: [rightColWidth, 52], align: 'right' });
            logoDrawn = true;
          }
        } catch (logoErr) {
          console.warn('No se pudo incrustar el logo en el PDF:', logoErr.message);
        }
      }

      if (!logoDrawn) {
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#111111')
          .text(settings.nombreRestaurante || 'COMPROBANTE DE PAGO', rightColX, 30, {
            width: rightColWidth,
            align: 'right',
          });
      }

      // Subtítulo oficial del régimen
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#444444')
        .text('R\u00c9GIMEN DE TRIBUTACI\u00d3N SIMPLIFICADA', rightColX, 48, {
          width: rightColWidth,
          align: 'right',
        });
      doc.font('Helvetica').fontSize(7).fillColor('#666666')
        .text('COMPROBANTE AUTORIZADO', rightColX, 58, {
          width: rightColWidth,
          align: 'right',
        });

      y = Math.max(y, 88);

      // =========================================================================
      // 2. BARRA DE COMPROBANTE & CUADRÍCULA DE FECHA
      // =========================================================================
      const numFactura = factura.numeroFactura || \`FAC-\${factura.id || '1'}\`;

      const dateBoxWidth = 120;
      const dateBoxX = margin + contentWidth - dateBoxWidth;
      const dateBoxY = y;
      const dateBoxHeight = 28;

      // Título claro y directo de Comprobante
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#111111')
        .text(\`Comprobante de Venta No. \${numFactura}\`, margin, y + 4);

      // Cuadrícula de Fecha (Día | Mes | Año)
      doc.rect(dateBoxX, dateBoxY, dateBoxWidth, dateBoxHeight).lineWidth(0.8).strokeColor('#444444').stroke();
      doc.rect(dateBoxX, dateBoxY, dateBoxWidth, 12).fillColor('#e0e0e0').fill();

      const colW = dateBoxWidth / 3;
      doc.moveTo(dateBoxX + colW, dateBoxY).lineTo(dateBoxX + colW, dateBoxY + dateBoxHeight).strokeColor('#444444').stroke();
      doc.moveTo(dateBoxX + colW * 2, dateBoxY).lineTo(dateBoxX + colW * 2, dateBoxY + dateBoxHeight).strokeColor('#444444').stroke();

      doc.font('Helvetica-Bold').fontSize(7).fillColor('#222222');
      doc.text('D\u00eda', dateBoxX, dateBoxY + 2.5, { width: colW, align: 'center' });
      doc.text('Mes', dateBoxX + colW, dateBoxY + 2.5, { width: colW, align: 'center' });
      doc.text('A\u00f1o', dateBoxX + colW * 2, dateBoxY + 2.5, { width: colW, align: 'center' });

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#111111');
      doc.text(dia, dateBoxX, dateBoxY + 15, { width: colW, align: 'center' });
      doc.text(mes, dateBoxX + colW, dateBoxY + 15, { width: colW, align: 'center' });
      doc.text(anio, dateBoxX + colW * 2, dateBoxY + 15, { width: colW, align: 'center' });

      y = dateBoxY + dateBoxHeight + 8;

      // =========================================================================
      // 3. CUADRO DE CLIENTE & DETALLES DEL SERVICIO (2 Columnas con marco)
      // =========================================================================
      const boxW = (contentWidth - 8) / 2;
      const boxH = 74;
      const clientBoxX = margin;
      const detailBoxX = margin + boxW + 8;
      const headerH = 14;

      // Columna 1: Datos del Cliente
      doc.rect(clientBoxX, y, boxW, boxH).lineWidth(0.8).strokeColor('#555555').stroke();
      doc.rect(clientBoxX, y, boxW, headerH).fillColor('#bfbfbf').fill();
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#111111')
        .text('Informaci\u00f3n de Cliente:', clientBoxX + 6, y + 3);

      let cy = y + headerH + 4;
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#222222')
        .text(cliente.nombre || 'Cliente General', clientBoxX + 6, cy, { width: boxW - 12 });
      cy += 11;
      doc.font('Helvetica').fontSize(7.5).fillColor('#333333');
      const cedulaLabel = cliente.identificacionFiscal ? \`C\u00e9dula: \${cliente.identificacionFiscal}\` : 'C\u00e9dula: No indicada';
      doc.text(cedulaLabel, clientBoxX + 6, cy);
      cy += 10;
      doc.text('Costa Rica', clientBoxX + 6, cy);
      cy += 10;
      if (cliente.telefono) {
        doc.text(\`Tel: \${cliente.telefono}\`, clientBoxX + 6, cy);
      }

      // Columna 2: Detalles del Pedido / Venta
      doc.rect(detailBoxX, y, boxW, boxH).lineWidth(0.8).strokeColor('#555555').stroke();
      doc.rect(detailBoxX, y, boxW, headerH).fillColor('#bfbfbf').fill();
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#111111')
        .text('Detalles del Pedido:', detailBoxX + 6, y + 3);

      let dy = y + headerH + 4;
      const labelW = 90;
      const valW = boxW - labelW - 12;

      const drawDetailRow = (label, val, boldVal = false) => {
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#333333')
          .text(label, detailBoxX + 6, dy, { width: labelW });
        doc.font(boldVal ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5).fillColor('#111111')
          .text(val || '\u2014', detailBoxX + 6 + labelW, dy, { width: valW });
        dy += 10.5;
      };

      drawDetailRow('Atendido en:', origenLabel, true);
      drawDetailRow('Email Cliente:', cliente.email || '\u2014');
      drawDetailRow('Atendido por:', settings.nombreRestaurante || 'Caja Principal');
      drawDetailRow('Condici\u00f3n:', 'Pago de Contado');
      drawDetailRow('Fecha Emisi\u00f3n:', \`\${dia}/\${String(fechaEmision.getMonth() + 1).padStart(2, '0')}/\${anio}\`);

      y += boxH + 10;

      // =========================================================================
      // 4. TABLA DE PRODUCTOS (Limpia, sin desglose de IVA)
      // =========================================================================
      const cols = {
        prod: { x: margin, w: 55, align: 'left' },
        desc: { x: margin + 55, w: 225, align: 'left' },
        cant: { x: margin + 280, w: 45, align: 'center' },
        unid: { x: margin + 325, w: 50, align: 'center' },
        prec: { x: margin + 375, w: 85, align: 'right' },
        tot:  { x: margin + 460, w: 96, align: 'right' }
      };

      const tableHeaderH = 14;
      doc.rect(margin, y, contentWidth, tableHeaderH).fillColor('#bfbfbf').fill();
      doc.rect(margin, y, contentWidth, tableHeaderH).lineWidth(0.8).strokeColor('#555555').stroke();

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#111111');
      doc.text('Producto', cols.prod.x + 3, y + 3, { width: cols.prod.w - 6, align: cols.prod.align });
      doc.text('Descripci\u00f3n', cols.desc.x + 3, y + 3, { width: cols.desc.w - 6, align: cols.desc.align });
      doc.text('Cantidad', cols.cant.x, y + 3, { width: cols.cant.w, align: cols.cant.align });
      doc.text('Unidades', cols.unid.x, y + 3, { width: cols.unid.w, align: cols.unid.align });
      doc.text('Precio Unitario', cols.prec.x, y + 3, { width: cols.prec.w - 4, align: cols.prec.align });
      doc.text('Total', cols.tot.x, y + 3, { width: cols.tot.w - 4, align: cols.tot.align });

      y += tableHeaderH;

      const items = detalles.length > 0 ? detalles : [
        {
          codigo: '01',
          descripcion: 'Consumo de Alimentos y Bebidas',
          cantidad: 1,
          precioMomento: factura.total || 0,
        }
      ];

      items.forEach((item, idx) => {
        const itemQty = Number(item.cantidad) || 1;
        const itemPrice = Number(item.precioMomento) || 0;
        const itemTotal = itemQty * itemPrice;
        const itemCode = item.codigo ? String(item.codigo) : \`P\${item.productoId || item.id || (idx + 1)}\`;
        const itemDesc = item.descripcion || item.productoNombre || 'Producto';
        const rowH = 16;

        // Fila zebra sutil
        if (idx % 2 === 1) {
          doc.rect(margin, y, contentWidth, rowH).fillColor('#fafafa').fill();
        }

        doc.font('Helvetica').fontSize(7.5).fillColor('#222222');
        doc.text(itemCode, cols.prod.x + 3, y + 4, { width: cols.prod.w - 6 });
        doc.font('Helvetica-Bold').fontSize(7.5).text(itemDesc, cols.desc.x + 3, y + 4, { width: cols.desc.w - 6 });
        doc.font('Helvetica').fontSize(7.5).text(itemQty.toFixed(2), cols.cant.x, y + 4, { width: cols.cant.w, align: cols.cant.align });
        doc.text('Unidad', cols.unid.x, y + 4, { width: cols.unid.w, align: cols.unid.align });
        doc.text(formatColones(itemPrice), cols.prec.x, y + 4, { width: cols.prec.w - 4, align: cols.prec.align });
        doc.font('Helvetica-Bold').text(formatColones(itemTotal), cols.tot.x, y + 4, { width: cols.tot.w - 4, align: cols.tot.align });

        y += rowH;
      });

      y += 6;
      doc.font('Helvetica').fontSize(7).fillColor('#666666')
        .text('**** ULTIMA LINEA ****', margin, y, { width: contentWidth, align: 'center' });
      y += 14;

      // =========================================================================
      // 5. FORMA DE PAGO (Debajo de la tabla)
      // =========================================================================
      const totalPagar = Number(factura.total) || 0;
      const subtotalMonto = Number(factura.subtotal) || totalPagar;
      const montoServicio = Number(factura.servicio) || 0;

      const taxesY = y;
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#222222');
      doc.text('Forma de Pago:', margin, taxesY);
      doc.font('Helvetica').fontSize(8).fillColor('#333333')
        .text(metodoPagoLabel || 'Efectivo', margin + 85, taxesY);
      doc.font('Helvetica-Bold').fontSize(8)
        .text(formatColones(totalPagar), margin + 200, taxesY, { width: 80, align: 'right' });

      y = taxesY + 22;

      // =========================================================================
      // 6. BLOQUE FINAL: AGRADECIMIENTO / FIRMA (Izquierda) y TOTALES (Derecha)
      // =========================================================================
      const leftBottomW = 310;
      const rightBottomX = margin + leftBottomW + 10;
      const rightBottomW = contentWidth - leftBottomW - 10; // 236 pt
      const bottomStartY = y;

      // Caja: Mensaje cordial y régimen
      const termsH = 68;
      const termsW = 190;
      doc.rect(margin, bottomStartY, termsW, termsH).lineWidth(0.8).strokeColor('#555555').stroke();
      doc.rect(margin, bottomStartY, termsW, 12).fillColor('#bfbfbf').fill();
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#111111')
        .text('\u00a1Gracias por su preferencia!', margin + 4, bottomStartY + 2.5);
      doc.font('Helvetica').fontSize(7).fillColor('#444444')
        .text(
          'Esperamos que haya disfrutado de sus alimentos y bebidas. Este documento se expide conforme a las normas del R\u00e9gimen de Tributaci\u00f3n Simplificada de Costa Rica.',
          margin + 4, bottomStartY + 16, { width: termsW - 8 }
        );

      // Caja: Recibido Por / Firma
      const sigX = margin + termsW;
      const sigW = leftBottomW - termsW;
      doc.rect(sigX, bottomStartY, sigW, termsH).lineWidth(0.8).strokeColor('#555555').stroke();
      doc.rect(sigX, bottomStartY, sigW, 12).fillColor('#bfbfbf').fill();
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#111111')
        .text('Recibido Por:', sigX + 4, bottomStartY + 2.5);
      doc.font('Helvetica').fontSize(7).fillColor('#888888')
        .text('(Firma)', sigX, bottomStartY + termsH - 12, { width: sigW, align: 'center' });

      // Tabla de Totales (Directa y limpia para Soda)
      const totalsData = [
        { label: 'Subtotal Consumo:', val: formatColones(subtotalMonto) },
      ];

      if (montoServicio > 0) {
        totalsData.push({ label: 'Servicio 10% (Sal\u00f3n):', val: formatColones(montoServicio) });
      }

      totalsData.push({ label: 'Descuento:', val: formatColones(0) });
      totalsData.push({ label: 'Total a Pagar:', val: formatColones(totalPagar), isTotal: true });

      const rowTotH = 17;
      const totalsBoxH = totalsData.length * rowTotH;

      let totY = bottomStartY;
      const labelTotW = rightBottomW * 0.55;
      const valTotW = rightBottomW * 0.45;

      totalsData.forEach((row, idx) => {
        if (row.isTotal) {
          doc.rect(rightBottomX, totY, rightBottomW, rowTotH).fillColor('#e6e6e6').fill();
        } else if (idx % 2 === 0) {
          doc.rect(rightBottomX, totY, rightBottomW, rowTotH).fillColor('#f7f7f7').fill();
        }

        if (idx > 0) {
          doc.moveTo(rightBottomX, totY).lineTo(rightBottomX + rightBottomW, totY).lineWidth(0.5).strokeColor('#cccccc').stroke();
        }
        doc.moveTo(rightBottomX + labelTotW, totY).lineTo(rightBottomX + labelTotW, totY + rowTotH).lineWidth(0.5).strokeColor('#cccccc').stroke();

        doc.font(row.isTotal ? 'Helvetica-Bold' : 'Helvetica').fontSize(row.isTotal ? 8.5 : 7.5)
          .fillColor('#111111')
          .text(row.label, rightBottomX + 4, totY + 4, { width: labelTotW - 6, align: 'right' });

        doc.font('Helvetica-Bold').fontSize(row.isTotal ? 9 : 8)
          .fillColor('#111111')
          .text(row.val, rightBottomX + labelTotW + 4, totY + 4, { width: valTotW - 8, align: 'right' });

        totY += rowTotH;
      });

      // Borde exterior definitivo de totales
      doc.rect(rightBottomX, bottomStartY, rightBottomW, totalsBoxH).lineWidth(0.8).strokeColor('#555555').stroke();

      y = bottomStartY + Math.max(termsH, totalsBoxH) + 16;

      // =========================================================================
      // 7. PIE LEGAL OFICIAL DE RÉGIMEN SIMPLIFICADO
      // =========================================================================
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#333333')
        .text(
          'Contribuyente acogido al R\u00e9gimen de Tributaci\u00f3n Simplificada. Precios finales al consumidor.',
          margin, y, { width: contentWidth * 0.65 }
        );

      const horaFormateada = fechaEmision.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
      doc.font('Helvetica').fontSize(7).fillColor('#555555')
        .text(
          \`Comprobante emitido el: \${dia}/\${String(fechaEmision.getMonth() + 1).padStart(2, '0')}/\${anio} \${horaFormateada}\`,
          margin + contentWidth * 0.65, y, { width: contentWidth * 0.35, align: 'right' }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateInvoicePDFBuffer,
  formatColones,
};
`;

// =========================================================================
// 2. routes/emailRoutes.js
// =========================================================================
const emailRoutesContent = `const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/authMiddleware');
const { Resend } = require('resend');
const { generateInvoicePDFBuffer, formatColones } = require('../services/pdfInvoiceService');

const EMAIL_REGEX = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function getBusinessSettings(req) {
  const settings = {
    nombreRestaurante: req.tenant?.nombre || 'Soda / Restaurante',
    razonSocial: '',
    telefono: '',
    cedulaJuridica: '',
    correo: '',
    direccion: '',
  };

  try {
    const [rows] = await req.dbPool.query('SELECT clave, valor FROM configuraciones');
    for (const row of rows) {
      settings[row.clave] = row.valor;
    }
  } catch (err) {
    console.warn('No se pudo leer configuraciones para el email:', err.code || err.message);
  }

  return settings;
}

async function getDetalleFactura(req, facturaId) {
  try {
    const [rows] = await req.dbPool.query(
      \`SELECT df.id, df.cantidad, df.precioMomento, p.nombre AS descripcion, p.id AS codigo
       FROM detalle_facturas df
       LEFT JOIN productos p ON p.id = df.productoId
       WHERE df.facturaId = ?\`,
      [facturaId]
    );
    return rows;
  } catch (err) {
    console.warn('No se pudo enriquecer el detalle con productos, usando fallback:', err.code || err.message);
  }

  try {
    const [rows] = await req.dbPool.query(
      'SELECT id, cantidad, precioMomento, productoId FROM detalle_facturas WHERE facturaId = ?',
      [facturaId]
    );
    return rows.map((r) => ({
      ...r,
      descripcion: \`Producto #\${r.productoId}\`,
      codigo: r.productoId,
    }));
  } catch (err2) {
    console.warn('No se pudo leer el detalle de la factura:', err2.code || err2.message);
    return [];
  }
}

async function getMetodoPagoLabel(req, metodoPagoId) {
  if (!metodoPagoId) return 'Efectivo';
  try {
    const [rows] = await req.dbPool.query('SELECT nombre FROM metodos_pago WHERE id = ?', [metodoPagoId]);
    return rows[0]?.nombre || 'Efectivo';
  } catch (err) {
    console.warn('No se pudo leer el método de pago:', err.code || err.message);
    return 'Efectivo';
  }
}

function buildInvoiceHtml({ settings, factura, cliente, detalles, fecha, metodoPagoLabel, origenLabel }) {
  const filas = (detalles || []).map((d) => {
    const total = Number(d.cantidad) * Number(d.precioMomento);
    return \`
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">\${escapeHtml(d.codigo ?? '')}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">\${escapeHtml(d.descripcion)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">\${escapeHtml(d.cantidad)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">\${formatColones(d.precioMomento)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">\${formatColones(total)}</td>
    </tr>
  \`;
  }).join('');

  return \`
  <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #ddd;">
    <div style="padding:20px; border-bottom:3px solid #333;">
      <table style="width:100%;">
        <tr>
          <td style="vertical-align:top;">
            <h2 style="margin:0 0 4px 0; color:#222;">\${escapeHtml(settings.nombreRestaurante)}</h2>
            \${settings.razonSocial ? \`<p style="margin:0;color:#666;font-size:13px;">\${escapeHtml(settings.razonSocial)}</p>\` : ''}
            <p style="margin:0;color:#666;font-size:13px;">Tel: \${escapeHtml(settings.telefono || '')}</p>
            <p style="margin:0;color:#666;font-size:13px;">Cédula Jurídica: \${escapeHtml(settings.cedulaJuridica || '')}</p>
          </td>
          <td style="text-align:right;vertical-align:top;">
            <p style="margin:0;color:#333;font-weight:bold;font-size:15px;">Comprobante de Venta</p>
            <p style="margin:2px 0 0 0;color:#777;font-size:11px;font-weight:bold;">RÉGIMEN SIMPLIFICADO</p>
            <p style="margin:4px 0 0 0;color:#666;font-size:13px;">No. \${escapeHtml(factura.numeroFactura)}</p>
            <p style="margin:0;color:#666;font-size:13px;">\${escapeHtml(fecha)}</p>
          </td>
        </tr>
      </table>
    </div>

    <div style="padding:20px;">
      <table style="width:100%;background:#f7f7f7;border-radius:6px;">
        <tr>
          <td style="padding:12px;font-size:13px;color:#444;">
            <strong>Cliente:</strong> \${escapeHtml(cliente.nombre || 'Cliente General')}<br/>
            \${cliente.identificacionFiscal || cliente.cedula ? \`Cédula: \${escapeHtml(cliente.identificacionFiscal || cliente.cedula)}<br/>\` : ''}
            \${cliente.email ? \`Email: \${escapeHtml(cliente.email)}<br/>\` : ''}
          </td>
          <td style="padding:12px;font-size:13px;color:#444;text-align:right;">
            <strong>Atendido en:</strong> \${escapeHtml(origenLabel)}<br/>
            <strong>Método de pago:</strong> \${escapeHtml(metodoPagoLabel || 'Efectivo')}
          </td>
        </tr>
      </table>

      \${detalles && detalles.length ? \`
      <table style="width:100%;border-collapse:collapse;margin-top:20px;font-size:13px;">
        <thead>
          <tr style="background:#333;color:#fff;">
            <th style="padding:8px;text-align:left;">Código</th>
            <th style="padding:8px;text-align:left;">Descripción</th>
            <th style="padding:8px;text-align:center;">Cant.</th>
            <th style="padding:8px;text-align:right;">Precio</th>
            <th style="padding:8px;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>\${filas}</tbody>
      </table>\` : '<p style="color:#999;font-size:12px;margin-top:16px;">Consumo de restaurante.</p>'}

      <table style="width:100%;margin-top:16px;font-size:13px;">
        <tr>
          <td></td>
          <td style="width:240px;">
            <table style="width:100%;">
              <tr><td style="color:#666;padding:3px 0;">Subtotal Consumo:</td><td style="text-align:right;padding:3px 0;">\${formatColones(factura.subtotal || factura.total)}</td></tr>
              \${factura.servicio > 0 ? \`<tr><td style="color:#666;padding:3px 0;">Servicio 10%:</td><td style="text-align:right;padding:3px 0;">\${formatColones(factura.servicio)}</td></tr>\` : ''}
              <tr><td style="color:#333;font-weight:bold;padding:6px 0;border-top:1px solid #ccc;font-size:15px;">Total a Pagar:</td><td style="text-align:right;font-weight:bold;padding:6px 0;border-top:1px solid #ccc;font-size:15px;">\${formatColones(factura.total)}</td></tr>
            </table>
          </td>
        </tr>
      </table>

      <p style="margin-top:24px;color:#666;font-size:13px;">¡Gracias por su preferencia! Adjuntamos el comprobante de su consumo en formato PDF.</p>
    </div>

    <div style="padding:14px 20px;background:#f5f5f5;color:#888;font-size:11px;text-align:center;">
      Contribuyente acogido al Régimen de Tributación Simplificada. \${settings.nombreRestaurante} \${settings.telefono ? '| Tel: ' + escapeHtml(settings.telefono) : ''}
    </div>
  </div>
  \`;
}

// -------------------------------------------------------------------------
// POST /email/send-invoice: Genera PDF con PDFKit y lo envía con Resend
// -------------------------------------------------------------------------
router.post('/send-invoice', requireAuth, async (req, res, next) => {
  try {
    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: 'RESEND_API_KEY no está configurada en el servidor' });
    }

    const { facturaId, email, asunto } = req.body || {};

    if (!facturaId) {
      return res.status(400).json({ error: 'facturaId es requerido' });
    }

    // Consulta de factura enriquecida con datos del pedido y mesa
    const [facturas] = await req.dbPool.query(
      \`SELECT f.*, p.tipoPedido, m.numeroMesa
       FROM facturas f
       LEFT JOIN pedidos p ON p.id = f.pedidoId
       LEFT JOIN mesas m ON m.id = p.mesaId
       WHERE f.id = ?\`,
      [facturaId]
    );

    if (facturas.length === 0) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    const factura = facturas[0];

    let cliente = {};
    if (factura.clienteId) {
      const [clientes] = await req.dbPool.query('SELECT * FROM clientes WHERE id = ?', [factura.clienteId]);
      cliente = clientes[0] || {};
    }

    const toEmail = String(email || cliente.email || '').trim();
    if (!toEmail || !EMAIL_REGEX.test(toEmail)) {
      return res.status(400).json({ error: 'Email del cliente es requerido y debe ser válido' });
    }

    const [detalles, metodoPagoLabel, settings] = await Promise.all([
      getDetalleFactura(req, facturaId),
      getMetodoPagoLabel(req, factura.metodoPagoId),
      getBusinessSettings(req),
    ]);

    const origenLabel = factura.tipoPedido === 'Delivery'
      ? 'Delivery / Para Llevar'
      : (factura.numeroMesa ? \`Mesa \${factura.numeroMesa}\` : 'Consumo en Salón');

    console.log(\`[send-invoice] Generando comprobante Régimen Simplificado para #\${factura.numeroFactura}...\`);
    const pdfBuffer = await generateInvoicePDFBuffer({
      settings,
      factura,
      cliente,
      detalles,
      metodoPagoLabel,
      origenLabel,
    });
    console.log(\`[send-invoice] PDF generado exitosamente: \${pdfBuffer.length} bytes\`);

    const restaurantName = settings.nombreRestaurante || 'Soda / Restaurante';
    const fecha = factura.fechaEmision ? new Date(factura.fechaEmision).toLocaleDateString('es-CR') : '';
    const html = buildInvoiceHtml({ settings, factura, cliente, detalles, fecha, metodoPagoLabel, origenLabel });

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: toEmail,
      subject: asunto || \`Comprobante \${factura.numeroFactura} - \${restaurantName}\`,
      html,
      attachments: [
        {
          filename: \`Comprobante_\${factura.numeroFactura}.pdf\`,
          content: pdfBuffer.toString('base64'),
          contentType: 'application/pdf',
        },
      ],
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(502).json({
        error: error.message || 'No se pudo enviar el correo. Verifica la configuración de Resend.',
      });
    }

    res.json({
      success: true,
      message: 'Comprobante PDF enviado correctamente',
      factura: factura.numeroFactura,
      email: toEmail,
      resendId: data?.id,
    });
  } catch (err) {
    console.error('Error al enviar email con Resend:', err);
    next(err);
  }
});

// -------------------------------------------------------------------------
// GET /email/invoice-pdf/:facturaId: Descarga / Previsualización directa
// -------------------------------------------------------------------------
router.get('/invoice-pdf/:facturaId', requireAuth, async (req, res, next) => {
  try {
    const { facturaId } = req.params;
    const [facturas] = await req.dbPool.query(
      \`SELECT f.*, p.tipoPedido, m.numeroMesa
       FROM facturas f
       LEFT JOIN pedidos p ON p.id = f.pedidoId
       LEFT JOIN mesas m ON m.id = p.mesaId
       WHERE f.id = ?\`,
      [facturaId]
    );

    if (facturas.length === 0) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    const factura = facturas[0];

    let cliente = {};
    if (factura.clienteId) {
      const [clientes] = await req.dbPool.query('SELECT * FROM clientes WHERE id = ?', [factura.clienteId]);
      cliente = clientes[0] || {};
    }

    const [detalles, metodoPagoLabel, settings] = await Promise.all([
      getDetalleFactura(req, facturaId),
      getMetodoPagoLabel(req, factura.metodoPagoId),
      getBusinessSettings(req),
    ]);

    const origenLabel = factura.tipoPedido === 'Delivery'
      ? 'Delivery / Para Llevar'
      : (factura.numeroMesa ? \`Mesa \${factura.numeroMesa}\` : 'Consumo en Salón');

    const pdfBuffer = await generateInvoicePDFBuffer({
      settings,
      factura,
      cliente,
      detalles,
      metodoPagoLabel,
      origenLabel,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', \`inline; filename="Comprobante_\${factura.numeroFactura}.pdf"\`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error al generar vista previa de PDF:', err);
    next(err);
  }
});

module.exports = router;
`;

// Escribir archivos en targetApiDir
fs.writeFileSync(path.join(servicesDir, 'pdfInvoiceService.js'), pdfInvoiceServiceContent);
console.log('✅ Archivo actualizado: services/pdfInvoiceService.js (Régimen Simplificado CR)');

fs.writeFileSync(path.join(routesDir, 'emailRoutes.js'), emailRoutesContent);
console.log('✅ Archivo actualizado: routes/emailRoutes.js (Régimen Simplificado CR)');

console.log('🎉 Actualización completada con éxito.');
