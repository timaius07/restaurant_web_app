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

export function montoEnPalabras(amount, moneda = 'CRC') {
  const n = Math.round(Math.abs(Number(amount) || 0));
  if (n === 0) return `Cero ${moneda === 'USD' ? 'dólares' : 'colones'}`;

  const unidades = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const especiales = {
    10: 'diez', 11: 'once', 12: 'doce', 13: 'trece', 14: 'catorce', 15: 'quince',
    16: 'dieciséis', 17: 'diecisiete', 18: 'dieciocho', 19: 'diecinueve',
    20: 'veinte', 21: 'veintiún', 22: 'veintidós', 23: 'veintitrés', 24: 'veinticuatro',
    25: 'veinticinco', 26: 'veintiséis', 27: 'veintisiete', 28: 'veintiocho', 29: 'veintinueve'
  };
  const decenas = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const centenas = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

  function leerCentenas(num) {
    if (num === 0) return '';
    if (num === 100) return 'cien';
    let res = '';
    const c = Math.floor(num / 100);
    const resto = num % 100;
    if (c > 0) res += centenas[c] + ' ';

    if (resto > 0) {
      if (especiales[resto]) {
        res += especiales[resto];
      } else {
        const d = Math.floor(resto / 10);
        const u = resto % 10;
        if (d > 0) {
          res += decenas[d];
          if (u > 0) res += ' y ' + unidades[u];
        } else if (u > 0) {
          res += unidades[u];
        }
      }
    }
    return res.trim();
  }

  function convertir(num) {
    if (num === 0) return 'cero';
    if (num < 1000) return leerCentenas(num);
    if (num < 1000000) {
      const miles = Math.floor(num / 1000);
      const resto = num % 1000;
      const strMiles = miles === 1 ? 'mil' : `${leerCentenas(miles)} mil`;
      const strResto = resto > 0 ? ` ${leerCentenas(resto)}` : '';
      return `${strMiles}${strResto}`;
    }
    const millones = Math.floor(num / 1000000);
    const resto = num % 1000000;
    const strMillones = millones === 1 ? 'un millón' : `${leerCentenas(millones)} millones`;
    const strResto = resto > 0 ? ` ${convertir(resto)}` : '';
    return `${strMillones}${strResto}`;
  }

  const texto = convertir(n);
  const capitalizado = texto.charAt(0).toUpperCase() + texto.slice(1);
  const nombreMoneda = moneda === 'USD' ? (n === 1 ? 'dólar' : 'dólares') : (n === 1 ? 'colón' : 'colones');
  return `Son ${capitalizado} ${nombreMoneda}`;
}
