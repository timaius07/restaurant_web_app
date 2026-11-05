import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import './SearchableSelect.css';

export default function SearchableSelect({ 
  options = [], // { value: string|number, label: string, price?: string, subtitle?: string }
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
    function handleKeyDown(e) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const selectedOption = options.find(o => String(o.value) === String(value));

  // Utility to split "Product Name — ₡2 500" into name and price if price is not explicitly provided
  const parseOptionDetails = (opt) => {
    if (!opt) return { label: '', price: null, subtitle: null };
    let labelText = opt.label || '';
    let priceText = opt.price || null;
    let subtitleText = opt.subtitle || null;

    if (!priceText && labelText.includes(' — ')) {
      const parts = labelText.split(' — ');
      labelText = parts[0];
      priceText = parts[1];
    }
    return { label: labelText, price: priceText, subtitle: subtitleText };
  };

  const selectedParsed = parseOptionDetails(selectedOption);

  const filteredOptions = options.filter(o => {
    const searchLower = search.toLowerCase().trim();
    if (!searchLower) return true;
    const { label, price, subtitle } = parseOptionDetails(o);
    return (
      label.toLowerCase().includes(searchLower) ||
      (price && price.toLowerCase().includes(searchLower)) ||
      (subtitle && subtitle.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className={`searchable-select ${disabled ? 'disabled' : ''} ${isOpen ? 'is-open' : ''}`} ref={wrapperRef}>
      <div 
        className="select-trigger form-input" 
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="select-trigger-content">
          {!selectedOption ? (
            <span className="placeholder">{placeholder}</span>
          ) : (
            <div className="trigger-selected-item">
              <span className="trigger-label">{selectedParsed.label}</span>
              {selectedParsed.price && <span className="trigger-price">{selectedParsed.price}</span>}
            </div>
          )}
        </div>
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
            {search && (
              <button 
                type="button" 
                className="clear-search-btn" 
                onClick={(e) => { e.stopPropagation(); setSearch(''); }}
                title="Limpiar búsqueda"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="select-options">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => {
                const parsed = parseOptionDetails(option);
                const isSelected = String(option.value) === String(value);

                return (
                  <div
                    key={option.value}
                    className={`select-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                      setSearch('');
                    }}
                  >
                    <div className="option-main-info">
                      <span className="option-label">{parsed.label}</span>
                      {parsed.subtitle && <span className="option-subtitle">{parsed.subtitle}</span>}
                    </div>
                    {parsed.price && <span className="option-price">{parsed.price}</span>}
                  </div>
                );
              })
            ) : (
              <div className="select-no-results">No se encontraron productos</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

