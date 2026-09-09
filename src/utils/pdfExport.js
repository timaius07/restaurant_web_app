import html2pdf from 'html2pdf.js';
import toast from 'react-hot-toast';

/**
 * Exporta un elemento del DOM a un archivo PDF descargable usando html2pdf.js
 * @param {string} elementId ID del contenedor HTML a exportar
 * @param {string} filename Nombre del archivo .pdf de salida
 */
export const exportElementToPDF = async (elementId, filename = 'Reporte.pdf') => {
  const element = document.getElementById(elementId);
  if (!element) {
    toast.error('No se encontró el elemento para exportar');
    return;
  }

  const toastId = toast.loading('Generando documento PDF...');

  try {
    const opt = {
      margin:       [8, 8, 8, 8],
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    await html2pdf().set(opt).from(element).save();
    toast.success('PDF generado y descargado', { id: toastId });
  } catch (err) {
    console.error('Error al exportar PDF:', err);
    toast.error('Abriendo vista de impresión/PDF...', { id: toastId });
    window.print();
  }
};
