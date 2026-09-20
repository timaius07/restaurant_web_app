import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

/**
 * Custom confirmation dialog powered by SweetAlert2.
 * Replaces native browser window.confirm(...) with a clean, dynamic, theme-aware prompt.
 */
export const confirmDialog = async ({
  title = '¿Confirmar acción?',
  text = 'Esta acción no se puede deshacer',
  confirmButtonText = 'Sí, continuar',
  cancelButtonText = 'Cancelar',
  icon = 'warning', // 'warning' | 'error' | 'success' | 'info' | 'question'
  isDanger = true,
}) => {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

  const result = await Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    confirmButtonColor: isDanger ? '#ef4444' : '#f97316',
    cancelButtonColor: isDark ? '#2a3a48' : '#94a3b8',
    background: isDark ? '#132735' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    borderRadius: '16px',
    customClass: {
      popup: 'swal2-responsive-popup',
      title: 'swal2-responsive-title',
      confirmButton: 'swal2-responsive-btn',
      cancelButton: 'swal2-responsive-btn',
    },
  });

  return result.isConfirmed;
};
