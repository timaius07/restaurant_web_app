// ───────────────────────────────────────────
// HACIENDA SERVICE — Consulta Tributaria (Costa Rica)
// Endpoint público de consulta ATV de Hacienda
// ───────────────────────────────────────────

export const HACIENDA_CONFIG = {
  ENDPOINT_URL: 'https://api.hacienda.go.cr/fe/ae?identificacion=',
  TIMEOUT_MS: 8000,
};

/**
 * Consulta la información tributaria de un contribuyente en el API de Hacienda de Costa Rica.
 * 
 * @param {string} identificacion - Número de cédula (Física, Jurídica, NITE o DIMEX)
 * @returns {Promise<{ nombre: string, tipoIdentificacion: string, situacion: object } | null>}
 */
export async function consultarClienteHacienda(identificacion) {
  if (!identificacion) return null;

  // Limpiar guiones y caracteres no numéricos
  const cleanId = String(identificacion).replace(/\D/g, '').trim();

  // Las cédulas de Costa Rica válidas tienen entre 9 y 12 dígitos
  if (cleanId.length < 9 || cleanId.length > 12) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HACIENDA_CONFIG.TIMEOUT_MS);

  try {
    const response = await fetch(`${HACIENDA_CONFIG.ENDPOINT_URL}${cleanId}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return { error: 'Cédula no registrada en Hacienda' };
      }
      throw new Error(`Error en consulta Hacienda (HTTP ${response.status})`);
    }

    const data = await response.json();
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.warn('Tiempo de espera agotado al consultar Hacienda');
      return { error: 'Tiempo de espera agotado al consultar Hacienda' };
    }
    console.error('Error al consultar el API de Hacienda:', err);
    return null;
  }
}
