// infisical.plugin.js — Plugin de Vite que inyecta secretos de Infisical en build/dev time
// Los secretos se convierten en variables estáticas dentro del bundle (accesibles como import.meta.env.*)
// NUNCA expone las credenciales de Infisical al browser — solo los valores finales de los secretos.

import { InfisicalSDK } from '@infisical/sdk';
import fs from 'node:fs';
import path from 'node:path';

// Cargar variables locales de .env de forma compatible con Node 18+
function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    }
  }
}

/**
 * Plugin de Vite: infisicalPlugin()
 *
 * Carga todos los secretos del proyecto cuyo nombre empiece con el prefijo indicado
 * y los inyecta como define() estáticos en Vite (accesibles vía import.meta.env.*).
 *
 * @param {Object} options
 * @param {string} [options.prefix='F_']   Filtro de prefijo de las variables en Infisical
 * @param {string} [options.secretPath='/'] Path de secretos en Infisical
 */
export function infisicalPlugin({ prefix = 'F_', secretPath = '/' } = {}) {
  return {
    name: 'vite-plugin-infisical',
    enforce: 'pre',

    async config(userConfig, { mode }) {
      loadLocalEnv();

      const clientId = process.env.INFISICAL_CLIENT_ID;
      const clientSecret = process.env.INFISICAL_CLIENT_SECRET;
      const projectId = process.env.INFISICAL_PROJECT_ID;

      if (!clientId || !clientSecret || !projectId) {
        console.warn(
          '[Infisical] Variables de bootstrapping incompletas. ' +
          'Continuando sin cargar secretos remotos.'
        );
        return;
      }

      const client = new InfisicalSDK({ siteUrl: 'https://app.infisical.com' });

      await client.auth().universalAuth.login({ clientId, clientSecret });

      const isProd = mode === 'production' || process.env.NODE_ENV === 'production';
      const environment = isProd ? 'prod' : 'dev';

      const { secrets } = await client.secrets().listSecrets({
        projectId,
        environment,
        secretPath,
        expandSecretReferences: true,
        includeImports: true,
      });

      const resolvedDefines = {};
      const filtered = secrets.filter(s => s.secretKey.startsWith(prefix));

      for (const s of filtered) {
        // Ejemplo: F_API_URL en Infisical -> import.meta.env.VITE_API_URL en el frontend
        const viteKey = 'VITE_' + s.secretKey.slice(prefix.length);
        resolvedDefines[`import.meta.env.${viteKey}`] = JSON.stringify(s.secretValue);
        process.env[viteKey] = s.secretValue;
      }

      console.log(
        `[Infisical] ${filtered.length} secretos cargados con prefijo "${prefix}" (entorno: ${environment})`
      );

      return {
        define: resolvedDefines,
      };
    },
  };
}
