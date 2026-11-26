const { Resend } = require('resend');
const https = require('https');

class NotificationService {
  /**
   * Limpia y construye el número telefónico en formato E.164 (ej: +50688888888)
   */
  static formatPhoneNumber(phone) {
    if (!phone) return '';
    let cleaned = String(phone).replace(/\D/g, '');
    if (!cleaned) return '';

    // Si el número tiene 8 dígitos (formato estándar CR/Centroamérica), agregar +506 por defecto
    if (cleaned.length === 8) {
      cleaned = '506' + cleaned;
    }

    return '+' + cleaned;
  }

  /**
   * Envia un email usando Resend con la configuración específica del tenant
   */
  static async sendEmail({ tenantConfig, to, subject, html, attachments }) {
    // 1. Resolver llaves y configuración (priorizar tenant, sino fallback global)
    const apiKey = tenantConfig?.resend_api_key || process.env.RESEND_API_KEY;
    const verifiedDomain = tenantConfig?.resend_verified_domain || process.env.RESEND_VERIFIED_DOMAIN || 'facturas@comandas.cr';
    const fromName = tenantConfig?.nombreRestaurante || 'Sistema de Restaurante';
    const replyToEmail = tenantConfig?.correo || 'no-reply@comandas.cr';

    if (!apiKey) {
      throw new Error('API Key de Resend no configurada para este tenant ni en el servidor.');
    }

    const resend = new Resend(apiKey);

    const emailOptions = {
      from: `"${fromName}" <${verifiedDomain}>`,
      replyTo: replyToEmail,
      to,
      subject,
      html,
    };

    if (attachments && attachments.length > 0) {
      emailOptions.attachments = attachments;
    }

    const { data, error } = await resend.emails.send(emailOptions);

    if (error) {
      console.error('Resend error in NotificationService:', error);
      throw new Error(error.message || 'No se pudo enviar el correo.');
    }

    return data;
  }

  /**
   * Envía un mensaje a través de la API REST de YCloud (WhatsApp)
   */
  static async sendYCloudWhatsapp({ tenantConfig, phone, message }) {
    const apiKey = tenantConfig?.ycloud_api_key || tenantConfig?.whatsapp_api_key || process.env.YCLOUD_API_KEY || process.env.WHATSAPP_API_KEY;

    if (!apiKey) {
      throw new Error('API Key de YCloud / WhatsApp no está configurada en los ajustes del sistema.');
    }

    const formattedPhone = this.formatPhoneNumber(phone);
    if (!formattedPhone) {
      throw new Error('El número de teléfono proporcionado no es válido para el envío de mensajes.');
    }

    const rawFromPhone = tenantConfig?.ycloud_from_number || tenantConfig?.whatsapp_from_number || tenantConfig?.telefono || process.env.YCLOUD_FROM_NUMBER || process.env.WHATSAPP_FROM_NUMBER;
    const formattedFromPhone = this.formatPhoneNumber(rawFromPhone);

    const payloadObject = {
      to: formattedPhone,
      type: 'text',
      text: {
        body: message,
      },
    };

    if (formattedFromPhone) {
      payloadObject.from = formattedFromPhone;
    }

    const postData = JSON.stringify(payloadObject);

    // 1. Probar usando fetch global de Node 18+ si está disponible
    if (typeof fetch === 'function') {
      try {
        const response = await fetch('https://api.ycloud.com/v2/whatsapp/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
          body: postData,
        });

        const resData = await response.json().catch(() => ({}));

        if (!response.ok) {
          const errorDetail = resData.error?.message || resData.message || `Status HTTP ${response.status}`;
          console.error('[YCloud API Error]:', resData);
          throw new Error(`YCloud Error: ${errorDetail}`);
        }

        console.log(`[YCloud WhatsApp] Notificación enviada exitosamente a ${formattedPhone}. ID: ${resData.id || resData.wamid}`);
        return {
          success: true,
          provider: 'YCloud',
          id: resData.id || resData.wamid,
          data: resData,
        };
      } catch (fetchErr) {
        if (fetchErr.message && fetchErr.message.startsWith('YCloud Error:')) {
          throw fetchErr;
        }
        console.warn('[YCloud fetch fallbacking to https module]:', fetchErr.message);
      }
    }

    // 2. Fallback usando el módulo nativo `https` de Node.js
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.ycloud.com',
        port: 443,
        path: '/v2/whatsapp/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body || '{}');
            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log(`[YCloud WhatsApp https] Notificación enviada a ${formattedPhone}. ID: ${parsed.id || parsed.wamid}`);
              resolve({
                success: true,
                provider: 'YCloud',
                id: parsed.id || parsed.wamid,
                data: parsed,
              });
            } else {
              const msg = parsed.error?.message || parsed.message || `HTTP ${res.statusCode}`;
              reject(new Error(`YCloud Error: ${msg}`));
            }
          } catch (e) {
            reject(new Error(`Respuesta no válida de YCloud: ${body}`));
          }
        });
      });

      req.on('error', (err) => {
        console.error('[YCloud https Error]:', err);
        reject(new Error(`Error de conexión con YCloud: ${err.message}`));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Envia un mensaje de WhatsApp (Utilizando YCloud)
   */
  static async sendWhatsapp({ tenantConfig, phone, message }) {
    return await this.sendYCloudWhatsapp({ tenantConfig, phone, message });
  }
}

module.exports = NotificationService;

