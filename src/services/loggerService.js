import * as Sentry from '@sentry/react';

/**
 * Registra un error tanto en la consola local como en Sentry
 * @param {string|Error} error - Objeto Error o mensaje de error
 * @param {Object} [contextData] - Datos adicionales de contexto
 */
export function logError(error, contextData = {}) {
  console.error('[Error Tracker]:', error, contextData);

  Sentry.withScope((scope) => {
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
    if (contextData && Object.keys(contextData).length > 0) {
      scope.setExtras(contextData);
    }
    Sentry.captureMessage(warningMessage, 'warning');
  });
}
