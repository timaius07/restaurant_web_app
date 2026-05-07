// Formatters for currency, dates, etc.

export function formatCurrency(amount, moneda = 'CRC', tasaCambio = 520) {
  if (moneda === 'USD') {
    const usd = amount / tasaCambio;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usd);
  }
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', minimumFractionDigits: 0 }).format(amount);
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('es-CR', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDateOnly(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-CR', { dateStyle: 'medium' });
}

export function generateFacturaNumber(count) {
  const year = new Date().getFullYear();
  return `FAC-${year}-${String(count).padStart(4, '0')}`;
}

export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
