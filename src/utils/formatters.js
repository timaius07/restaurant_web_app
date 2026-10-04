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
  let datePart = '';
  if (typeof dateStr === 'string' && dateStr.includes('-')) {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      datePart = `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
  }
  if (!datePart) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    datePart = `${day}/${month}/${year}`;
  }
  const dObj = new Date(dateStr);
  let timePart = '';
  if (!isNaN(dObj.getTime())) {
    timePart = `, ${dObj.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  }
  return `${datePart}${timePart}`;
}

export function formatDateOnly(dateStr) {
  if (!dateStr) return '—';
  if (typeof dateStr === 'string' && dateStr.includes('-')) {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function generateFacturaNumber(count) {
  const year = new Date().getFullYear();
  return `FAC-${year}-${String(count).padStart(4, '0')}`;
}

export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
