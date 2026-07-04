import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import './SearchableSelect.css';

export default function SearchableSelect({ 
  options = [], // { value: string, label: string }
  value, 
  onChange, 
  placeholder = 'Buscar...',
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => String(o.value) === String(value));
  const displayValue = selectedOption ? selectedOption.label : '';

  const filteredOptions = options.filter(o => 
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`searchable-select ${disabled ? 'disabled' : ''}`} ref={wrapperRef}>
      <div 
        className="select-trigger form-input" 
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={!selectedOption ? 'placeholder' : ''}>
          {selectedOption ? displayValue : placeholder}
        </span>
        <ChevronDown size={16} className={`arrow ${isOpen ? 'open' : ''}`} />
      </div>

      {isOpen && (
        <div className="select-dropdown">
          <div className="select-search">
            <Search size={14} className="search-icon" />
            <input
              autoFocus
              type="text"
              placeholder="Escriba para filtrar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="select-options">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => (
                <div
                  key={option.value}
                  className={`select-option ${String(option.value) === String(value) ? 'selected' : ''}`}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearch('');
                  }}
                >
                  {option.label}
                </div>
              ))
            ) : (
              <div className="select-no-results">No se encontraron resultados</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
