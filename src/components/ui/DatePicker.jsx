import React, { useRef } from 'react';
import { Calendar } from 'lucide-react';
import './DatePicker.css';

/**
 * Format an ISO date string (YYYY-MM-DD) or Date object to DD/MM/YYYY (dia/mes/año)
 */
export function formatIsoToDMY(dateStr) {
  if (!dateStr) return '';
  const cleanStr = String(dateStr).trim();
  if (cleanStr.includes('-')) {
    const parts = cleanStr.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${day}/${month}/${year}`;
    }
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function DatePicker({
  value = '',
  onChange,
  className = '',
  style = {},
  min,
  max,
  disabled = false,
  id,
  name,
  placeholder = 'dd/mm/aaaa'
}) {
  const hiddenInputRef = useRef(null);

  const formattedDisplay = formatIsoToDMY(value);

  const handleContainerClick = () => {
    if (hiddenInputRef.current && !disabled) {
      if (typeof hiddenInputRef.current.showPicker === 'function') {
        try {
          hiddenInputRef.current.showPicker();
        } catch {
          hiddenInputRef.current.focus();
        }
      } else {
        hiddenInputRef.current.focus();
      }
    }
  };

  return (
    <div 
      className={`custom-datepicker-container ${className}`} 
      style={style}
      onClick={handleContainerClick}
    >
      <Calendar size={15} className="custom-datepicker-icon" />
      <input
        type="text"
        readOnly
        className="custom-datepicker-display"
        value={formattedDisplay}
        placeholder={placeholder}
        disabled={disabled}
      />
      <input
        ref={hiddenInputRef}
        type="date"
        id={id}
        name={name}
        value={value || ''}
        onChange={onChange}
        min={min}
        max={max}
        disabled={disabled}
        className="custom-datepicker-hidden-native"
        tabIndex={-1}
      />
    </div>
  );
}

