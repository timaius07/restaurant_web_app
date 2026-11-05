export const DEFAULT_WHATSAPP_TEMPLATE = 
`*PEDIDO #{numeroPedido}*

Cliente: {cliente}

*Productos:*
{productos}

*Total: {total}*

Estado actual: {estado}`;

/**
 * Genera el mensaje formateado para WhatsApp a partir de una plantilla y variables.
 * @param {string} template - Plantilla con etiquetas tipo {cliente}, {total}, etc.
 * @param {object} data - Datos para reemplazar en la plantilla.
 * @returns {string} Mensaje procesado.
 */
export function formatWhatsAppMessage(template, data) {
  const tmpl = template && template.trim() ? template : DEFAULT_WHATSAPP_TEMPLATE;

  return tmpl
    .replace(/\{numeroPedido\}/gi, data.numeroPedido ?? '')
    .replace(/\{cliente\}/gi, data.cliente ?? '')
    .replace(/\{telefono\}/gi, data.telefono ?? '')
    .replace(/\{productos\}/gi, data.productos ?? '')
    .replace(/\{total\}/gi, data.total ?? '')
    .replace(/\{estado\}/gi, data.estado ?? '')
    .replace(/\{restaurante\}/gi, data.restaurante ?? '')
    .replace(/\{tipoPedido\}/gi, data.tipoPedido ?? '');
}
