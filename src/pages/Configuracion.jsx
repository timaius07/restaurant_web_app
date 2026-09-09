import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';

const TASAS = [1, 3, 13];
const MONEDAS = ['CRC', 'USD'];
const TEMAS = [{ v:'dark', l:'🌙 Oscuro' }, { v:'light', l:'☀️ Claro' }];

export default function Configuracion() {
  const { settings, updateSettings } = useApp();
  const [formData, setFormData] = useState({
    nombreRestaurante: '',
    razonSocial: '',
    cedulaJuridica: '',
    telefono: '',
    correo: ''
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        nombreRestaurante: settings.nombreRestaurante || '',
        razonSocial: settings.razonSocial || '',
        cedulaJuridica: settings.cedulaJuridica || '',
        telefono: settings.telefono || '',
        correo: settings.correo || ''
      });
    }
  }, [settings]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const save = async (changes) => {
    await updateSettings(changes);
    toast.success('Configuración guardada en la Base de Datos');
  };

  const handleBlur = (field) => {
    if (formData[field] !== settings[field]) {
      save({ [field]: formData[field] });
    }
  };

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <h1>Configuración</h1>
        <p>Ajustes globales del sistema y datos fiscales del restaurante</p>
      </div>

      <div style={{ display:'grid', gap:16, maxWidth:600 }}>
        {/* Información del Restaurante */}
        <div className="card">
          <div className="card-title" style={{ marginBottom:16 }}>Información del Restaurante</div>
          <div style={{ display:'grid', gap:12 }}>
            <div className="form-group">
              <label className="form-label">Nombre del Restaurante</label>
              <input
                className="form-input"
                name="nombreRestaurante"
                value={formData.nombreRestaurante}
                onChange={handleChange}
                onBlur={() => handleBlur('nombreRestaurante')}
                placeholder="Ej. Soda La Tica"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Razón Social</label>
              <input
                className="form-input"
                name="razonSocial"
                value={formData.razonSocial}
                onChange={handleChange}
                onBlur={() => handleBlur('razonSocial')}
                placeholder="Ej. Soda La Tica S.A."
              />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label className="form-label">Cédula Jurídica</label>
                <input
                  className="form-input"
                  name="cedulaJuridica"
                  value={formData.cedulaJuridica}
                  onChange={handleChange}
                  onBlur={() => handleBlur('cedulaJuridica')}
                  placeholder="Ej. 3-101-123456"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <input
                  className="form-input"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  onBlur={() => handleBlur('telefono')}
                  placeholder="Ej. 2222-3333"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Correo Electrónico</label>
              <input
                className="form-input"
                type="email"
                name="correo"
                value={formData.correo}
                onChange={handleChange}
                onBlur={() => handleBlur('correo')}
                placeholder="Ej. contacto@sodalatica.cr"
              />
            </div>
          </div>
        </div>

        {/* Moneda */}
        <div className="card">
          <div className="card-title" style={{ marginBottom:16 }}>Moneda</div>
          <div style={{ display:'flex', gap:10 }}>
            {MONEDAS.map(m => (
              <button
                key={m}
                className={`btn ${settings.moneda === m ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => save({ moneda: m })}
              >
                {m === 'CRC' ? '₡ Colones (CRC)' : '$ Dólares (USD)'}
              </button>
            ))}
          </div>
          {settings.moneda === 'USD' && (
            <div className="form-group" style={{ marginTop:16 }}>
              <label className="form-label">Tasa de Cambio (₡ por $1)</label>
              <input
                className="form-input"
                type="number"
                defaultValue={settings.tasaCambio}
                style={{ maxWidth:160 }}
                onBlur={e => save({ tasaCambio: Number(e.target.value) })}
              />
            </div>
          )}
        </div>

        {/* IVA */}
        <div className="card">
          <div className="card-title" style={{ marginBottom:4 }}>Porcentaje de IVA</div>
          <div className="card-subtitle" style={{ marginBottom:16 }}>Aplica a todas las facturas emitidas</div>
          <div style={{ display:'flex', gap:10 }}>
            {TASAS.map(t => (
              <button
                key={t}
                className={`btn ${settings.tasaImpuesto === t ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => save({ tasaImpuesto: t })}
              >
                {t}%
              </button>
            ))}
          </div>
        </div>

        {/* Tema */}
        <div className="card">
          <div className="card-title" style={{ marginBottom:16 }}>Apariencia</div>
          <div style={{ display:'flex', gap:10 }}>
            {TEMAS.map(({ v, l }) => (
              <button
                key={v}
                className={`btn ${settings.tema === v ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => save({ tema: v })}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

