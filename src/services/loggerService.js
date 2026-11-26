import * as Sentry from '@sentry/react';

/**
 * Obtiene el nombre del restaurante desde localStorage (solo ui_settings) o tenant_meta
 */
function getTenantName() {
  try {
    // Intentar obtener desde tenant_meta (slug del tenant)
    const tenantMeta = JSON.parse(localStorage.getItem('tenant_meta') || '{}');
    if (tenantMeta.nombre) {
      return tenantMeta.nombre;
    }
    // Fallback al slug
    const tenantSlug = localStorage.getItem('tenant_slug');
    if (tenantSlug) {
      return tenantSlug;
    }
    return 'Unknown Tenant';
  } catch {
    return 'Unknown Tenant';
  }
}

/**
 * Registra un error tanto en la consola local como en Sentry
 * @param {string|Error} error - Objeto Error o mensaje de error
 * @param {Object} [contextData] - Datos adicionales de contexto
 */
export function logError(error, contextData = {}) {
  console.error('[Error Tracker]:', error, contextData);

  Sentry.withScope((scope) => {
    // Agregar el nombre del restaurante como tag
    scope.setTag('tenant', getTenantName());

    if (contextData && Object.keys(contextData).length > 0) {
      scope.setExtras(contextData);
    }
    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(String(error), 'error');
    }
  });
}

/**
 * Registra un warning tanto en la consola local como en Sentry
 * @param {string} warningMessage - Mensaje descriptivo del warning
 * @param {Object} [contextData] - Datos adicionales de contexto
 */
export function logWarning(warningMessage, contextData = {}) {
  console.warn('[Warning Tracker]:', warningMessage, contextData);

  Sentry.withScope((scope) => {
    // Agregar el nombre del restaurante como tag
    scope.setTag('tenant', getTenantName());

    if (contextData && Object.keys(contextData).length > 0) {
      scope.setExtras(contextData);
    }
    Sentry.captureMessage(warningMessage, 'warning');
  });
}
