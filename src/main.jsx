import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App.jsx';

// DSN de Sentry (se desactiva automáticamente si corre dentro de Cypress para no interferir con las pruebas)
const isCypress = typeof window !== 'undefined' && (!!window.Cypress || !!window.CYPRESS_ENV);
const sentryDsn = isCypress ? '' : (import.meta.env.VITE_SENTRY_DSN || '');

// Lista de palabras clave sensibles a censurar en payloads enviados a Sentry
const SENSITIVE_KEYS = [
  'password',
  'contrasena',
  'pin',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'secret',
  'apikey',
  'cedula',
  'tarjeta',
];

/**
 * Función recursiva para sanitizar objetos y censurar datos sensibles
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_KEYS.some((sensitive) =>
      key.toLowerCase().includes(sensitive)
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,       // Oculta textos del usuario en la reproducción de pantalla por privacidad
        blockAllMedia: true,     // Bloquea medios e imágenes en el replay
      }),
    ],
    // Tracing de rendimiento
    tracesSampleRate: 1.0,
    tracePropagationTargets: ['localhost', /^\/api/, /^https?:\/\/.*\/api/],
    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% de sesiones normales
    replaysOnErrorSampleRate: 1.0,  // 100% de sesiones con error
    
    // Filtro beforeSend: Limpia contraseñas, PINs, tokens antes de emitir a Sentry
    beforeSend(event) {
      if (event.request) {
        if (event.request.headers) {
          event.request.headers = sanitizeObject(event.request.headers);
        }
        if (event.request.data) {
          event.request.data = sanitizeObject(event.request.data);
        }
      }
      if (event.extra) {
        event.extra = sanitizeObject(event.extra);
      }
      return event;
    },

    // Filtro de breadcrumbs: Evita registrar logs locales que contengan información sensible
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'xhr' || breadcrumb.category === 'fetch') {
        if (breadcrumb.data) {
          breadcrumb.data = sanitizeObject(breadcrumb.data);
        }
      }
      return breadcrumb;
    },
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
