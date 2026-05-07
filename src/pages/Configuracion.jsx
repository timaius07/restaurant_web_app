import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';

const TASAS = [1, 3, 13];
const MONEDAS = ['CRC', 'USD'];
const TEMAS = [{ v:'dark', l:'🌙 Oscuro' }, { v:'light', l:'☀️ Claro' }];

export default function Configuracion() {
  const { settings, updateSettings } = useApp();

  const save = (changes) => { updateSettings(changes); toast.success('Configuración guardada'); };

  return (
    <div className="page-container animate-fade">
      <div className="page-header"><h1>Configuración</h1><p>Ajustes globales del sistema</p></div>

      <div style={{ display:'grid',gap:16,maxWidth:560 }}>
        {/* Restaurante */}
        <div className="card">
          <div className="card-title" style={{ marginBottom:16 }}>Información del Restaurante</div>
          <div className="form-group">
            <label className="form-label">Nombre del Restaurante</label>
            <input className="form-input" defaultValue={settings.nombreRestaurante}
              onBlur={e => save({ nombreRestaurante: e.target.value })} />
          </div>
        </div>

        {/* Moneda */}
        <div className="card">
          <div className="card-title" style={{ marginBottom:16 }}>Moneda</div>
          <div style={{ display:'flex',gap:10 }}>
            {MONEDAS.map(m => (
              <button key={m} className={`btn ${settings.moneda===m ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => save({ moneda: m })}>
                {m === 'CRC' ? '₡ Colones (CRC)' : '$ Dólares (USD)'}
              </button>
            ))}
          </div>
          {settings.moneda === 'USD' && (
            <div className="form-group" style={{ marginTop:16 }}>
              <label className="form-label">Tasa de Cambio (₡ por $1)</label>
              <input className="form-input" type="number" defaultValue={settings.tasaCambio}
                style={{ maxWidth:160 }}
                onBlur={e => save({ tasaCambio: Number(e.target.value) })} />
            </div>
          )}
        </div>

        {/* IVA */}
        <div className="card">
          <div className="card-title" style={{ marginBottom:4 }}>Porcentaje de IVA</div>
          <div className="card-subtitle" style={{ marginBottom:16 }}>Aplica a todas las facturas emitidas</div>
          <div style={{ display:'flex',gap:10 }}>
            {TASAS.map(t => (
              <button key={t} className={`btn ${settings.tasaImpuesto===t ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => save({ tasaImpuesto: t })}>
                {t}%
              </button>
            ))}
          </div>
        </div>

        {/* Tema */}
        <div className="card">
          <div className="card-title" style={{ marginBottom:16 }}>Apariencia</div>
          <div style={{ display:'flex',gap:10 }}>
            {TEMAS.map(({ v, l }) => (
              <button key={v} className={`btn ${settings.tema===v ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => save({ tema: v })}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
