const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/authMiddleware');
const { decrypt } = require('../services/cryptoService');
const NotificationService = require('../services/notifications/notification.service');
const { generateInvoicePDFBuffer, formatColones } = require('../services/pdfInvoiceService');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      if (row.clave === 'resend_api_key' || row.clave === 'whatsapp_api_key') {
        settings[row.clave] = decrypt(row.valor);
      } else {
        settings[row.clave] = row.valor;
      }
    }
  } catch (err) {
    console.warn('No se pudo leer configuraciones para el email:', err.code || err.message);
  }

  return settings;
}

async function getDetalleFactura(req, facturaId) {
  try {
    const [rows] = await req.dbPool.query(
      `SELECT df.id, df.cantidad, df.precioMomento, p.nombre AS descripcion, p.id AS codigo
       FROM detalle_facturas df
       LEFT JOIN productos p ON p.id = df.productoId
       WHERE df.facturaId = ?`,
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
      descripcion: `Producto #${r.productoId}`,
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
    return `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(d.codigo ?? '')}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(d.descripcion)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${escapeHtml(d.cantidad)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${formatColones(d.precioMomento)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${formatColones(total)}</td>
    </tr>
  `;
  }).join('');

  return `
  <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #ddd;">
    <div style="padding:20px; border-bottom:3px solid #333;">
      <table style="width:100%;">
        <tr>
          <td style="vertical-align:top;">
            <h2 style="margin:0 0 4px 0; color:#222;">${escapeHtml(settings.nombreRestaurante)}</h2>
            ${settings.razonSocial ? `<p style="margin:0;color:#666;font-size:13px;">${escapeHtml(settings.razonSocial)}</p>` : ''}
            <p style="margin:0;color:#666;font-size:13px;">Tel: ${escapeHtml(settings.telefono || '')}</p>
            <p style="margin:0;color:#666;font-size:13px;">Cédula Jurídica: ${escapeHtml(settings.cedulaJuridica || '')}</p>
          </td>
          <td style="text-align:right;vertical-align:top;">
            <p style="margin:0;color:#333;font-weight:bold;font-size:15px;">Comprobante de Venta</p>
            <p style="margin:2px 0 0 0;color:#777;font-size:11px;font-weight:bold;">RÉGIMEN SIMPLIFICADO</p>
            <p style="margin:4px 0 0 0;color:#666;font-size:13px;">No. ${escapeHtml(factura.numeroFactura)}</p>
            <p style="margin:0;color:#666;font-size:13px;">${escapeHtml(fecha)}</p>
          </td>
        </tr>
      </table>
    </div>

    <div style="padding:20px;">
      <table style="width:100%;background:#f7f7f7;border-radius:6px;">
        <tr>
          <td style="padding:12px;font-size:13px;color:#444;">
            <strong>Cliente:</strong> ${escapeHtml(cliente.nombre || 'Cliente General')}<br/>
            ${cliente.identificacionFiscal || cliente.cedula ? `Cédula: ${escapeHtml(cliente.identificacionFiscal || cliente.cedula)}<br/>` : ''}
            ${cliente.email ? `Email: ${escapeHtml(cliente.email)}<br/>` : ''}
          </td>
          <td style="padding:12px;font-size:13px;color:#444;text-align:right;">
            <strong>Atendido en:</strong> ${escapeHtml(origenLabel)}<br/>
            <strong>Método de pago:</strong> ${escapeHtml(metodoPagoLabel || 'Efectivo')}
          </td>
        </tr>
      </table>

      ${detalles && detalles.length ? `
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
        <tbody>${filas}</tbody>
      </table>` : '<p style="color:#999;font-size:12px;margin-top:16px;">Consumo de restaurante.</p>'}

      <table style="width:100%;margin-top:16px;font-size:13px;">
        <tr>
          <td></td>
          <td style="width:240px;">
            <table style="width:100%;">
              <tr><td style="color:#666;padding:3px 0;">Subtotal Consumo:</td><td style="text-align:right;padding:3px 0;">${formatColones(factura.subtotal || factura.total)}</td></tr>
              ${factura.servicio > 0 ? `<tr><td style="color:#666;padding:3px 0;">Servicio 10%:</td><td style="text-align:right;padding:3px 0;">${formatColones(factura.servicio)}</td></tr>` : ''}
              <tr><td style="color:#333;font-weight:bold;padding:6px 0;border-top:1px solid #ccc;font-size:15px;">Total a Pagar:</td><td style="text-align:right;font-weight:bold;padding:6px 0;border-top:1px solid #ccc;font-size:15px;">${formatColones(factura.total)}</td></tr>
            </table>
          </td>
        </tr>
      </table>

      <p style="margin-top:24px;color:#666;font-size:13px;">¡Gracias por su preferencia! Adjuntamos el comprobante de su consumo en formato PDF.</p>
    </div>

    <div style="padding:14px 20px;background:#f5f5f5;color:#888;font-size:11px;text-align:center;">
      Contribuyente acogido al Régimen de Tributación Simplificada. ${settings.nombreRestaurante} ${settings.telefono ? '| Tel: ' + escapeHtml(settings.telefono) : ''}
    </div>
  </div>
  `;
}

// -------------------------------------------------------------------------
// POST /email/send-invoice: Genera PDF con PDFKit y lo envía con Resend
// -------------------------------------------------------------------------
router.post('/send-invoice', requireAuth, async (req, res, next) => {
  try {

    const { facturaId, email, asunto } = req.body || {};

    if (!facturaId) {
      return res.status(400).json({ error: 'facturaId es requerido' });
    }

    // Consulta de factura enriquecida con datos del pedido y mesa
    const [facturas] = await req.dbPool.query(
      `SELECT f.*, p.tipoPedido, m.numeroMesa
       FROM facturas f
       LEFT JOIN pedidos p ON p.id = f.pedidoId
       LEFT JOIN mesas m ON m.id = p.mesaId
       WHERE f.id = ?`,
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
      : (factura.numeroMesa ? `Mesa ${factura.numeroMesa}` : 'Consumo en Salón');

    console.log(`[send-invoice] Generando comprobante Régimen Simplificado para #${factura.numeroFactura}...`);
    const pdfBuffer = await generateInvoicePDFBuffer({
      settings,
      factura,
      cliente,
      detalles,
      metodoPagoLabel,
      origenLabel,
    });
    console.log(`[send-invoice] PDF generado exitosamente: ${pdfBuffer.length} bytes`);

    const restaurantName = settings.nombreRestaurante || 'Soda / Restaurante';
    const fecha = factura.fechaEmision ? new Date(factura.fechaEmision).toLocaleDateString('es-CR') : '';
    const html = buildInvoiceHtml({ settings, factura, cliente, detalles, fecha, metodoPagoLabel, origenLabel });

    const data = await NotificationService.sendEmail({
      tenantConfig: settings,
      to: toEmail,
      subject: asunto || `Comprobante ${factura.numeroFactura} - ${restaurantName}`,
      html,
      attachments: [
        {
          filename: `Comprobante_${factura.numeroFactura}.pdf`,
          content: pdfBuffer.toString('base64'),
          contentType: 'application/pdf',
        },
      ]
    });

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
      `SELECT f.*, p.tipoPedido, m.numeroMesa
       FROM facturas f
       LEFT JOIN pedidos p ON p.id = f.pedidoId
       LEFT JOIN mesas m ON m.id = p.mesaId
       WHERE f.id = ?`,
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
      : (factura.numeroMesa ? `Mesa ${factura.numeroMesa}` : 'Consumo en Salón');

    const pdfBuffer = await generateInvoicePDFBuffer({
      settings,
      factura,
      cliente,
      detalles,
      metodoPagoLabel,
      origenLabel,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Comprobante_${factura.numeroFactura}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error al generar vista previa de PDF:', err);
    next(err);
  }
});

// -------------------------------------------------------------------------
// POST /email/send-delivery-whatsapp: Notificación de Delivery por WhatsApp vía YCloud
// -------------------------------------------------------------------------
router.post('/send-delivery-whatsapp', requireAuth, async (req, res, next) => {
  try {
    const { pedidoId, phone: inputPhone, message: customMessage } = req.body || {};

    if (!pedidoId) {
      return res.status(400).json({ error: 'pedidoId es requerido' });
    }

    // Consulta del pedido y cliente asociado
    const [pedidos] = await req.dbPool.query(
      `SELECT p.*, c.nombre AS clienteNombre, c.telefono AS clienteTelefono, c.email AS clienteEmail
       FROM pedidos p
       LEFT JOIN clientes c ON c.id = p.clienteId
       WHERE p.id = ?`,
      [pedidoId]
    );

    if (pedidos.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const pedido = pedidos[0];
    const phone = inputPhone || pedido.clienteTelefono;

    if (!phone) {
      return res.status(400).json({ error: 'El cliente no tiene un teléfono registrado para notificaciones de WhatsApp.' });
    }

    // Consulta de los productos incluidos en el pedido
    const [detalles] = await req.dbPool.query(
      `SELECT dp.cantidad, p.nombre AS productoNombre
       FROM detalle_pedidos dp
       JOIN productos p ON p.id = dp.productoId
       WHERE dp.pedidoId = ?`,
      [pedidoId]
    );

    const settings = await getBusinessSettings(req);
    const restaurantName = settings.nombreRestaurante || 'Nuestro Restaurante';

    let estadoLabel = pedido.estado;
    if (pedido.estado === 'Servido') estadoLabel = 'Listo para entrega / retiro 📦';
    else if (pedido.estado === 'Preparando') estadoLabel = 'En preparación en cocina 👨‍🍳';
    else if (pedido.estado === 'Abierto') estadoLabel = 'Recibido y registrado 📝';

    const resumenItems = detalles.map(d => `${d.cantidad}x ${d.productoNombre}`).join(', ') || 'Sin productos especificados';
    const pedidoNum = `#${String(pedido.id).padStart(2, '0')}`;

    let messageToSend = customMessage;
    if (!messageToSend) {
      messageToSend = `🛵 *${restaurantName}* - Notificación de Delivery\n\n` +
        `¡Hola *${pedido.clienteNombre || 'Cliente'}*!\n` +
        `Tu pedido *${pedidoNum}* ha cambiado de estado a: *${estadoLabel}*.\n\n` +
        `📦 *Resumen:* ${resumenItems}\n\n` +
        `¡Gracias por preferirnos!`;
    }

    const result = await NotificationService.sendWhatsapp({
      tenantConfig: settings,
      phone,
      message: messageToSend
    });

    res.json({
      success: true,
      message: 'Notificación de WhatsApp enviada correctamente mediante YCloud',
      pedidoId: pedido.id,
      phone: NotificationService.formatPhoneNumber(phone),
      provider: result.provider,
      messageId: result.id
    });
  } catch (err) {
    console.error('Error al enviar notificación de Delivery por WhatsApp:', err);
    res.status(500).json({ error: err.message || 'Error al enviar la notificación por WhatsApp' });
  }
});

module.exports = router;

