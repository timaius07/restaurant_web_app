import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Save, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { confirmDialog } from '../utils/sweetAlert';
import './Configuracion.css';

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
    correo: '',
    resend_api_key: '',
    resend_verified_domain: '',
    whatsapp_api_key: '',
    whatsapp_template: '',
    moneda: 'CRC',
    tasaCambio: 520,
    tasaImpuesto: 13,
    tema: 'dark'
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        nombreRestaurante: settings.nombreRestaurante || '',
        razonSocial: settings.razonSocial || '',
        cedulaJuridica: settings.cedulaJuridica || '',
        telefono: settings.telefono || '',
        correo: settings.correo || '',
        resend_api_key: settings.resend_api_key || '',
        resend_verified_domain: settings.resend_verified_domain || '',
        whatsapp_api_key: settings.whatsapp_api_key || '',
        whatsapp_template: settings.whatsapp_template || '',
        moneda: settings.moneda || 'CRC',
        tasaCambio: settings.tasaCambio !== undefined ? settings.tasaCambio : 520,
        tasaImpuesto: settings.tasaImpuesto !== undefined ? settings.tasaImpuesto : 13,
        tema: settings.tema || 'dark'
      });
    }
  }, [settings]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGuardarCambios = async (e) => {
    if (e) e.preventDefault();

    const confirmed = await confirmDialog({
      title: '¿Guardar cambios de configuración?',
      text: 'Se aplicarán los nuevos valores en el sistema y datos del restaurante.',
      confirmButtonText: 'Sí, aplicar cambios',
      cancelButtonText: 'Cancelar',
      icon: 'question',
      isDanger: false
    });

    if (!confirmed) return;

    setIsSaving(true);
    const toastId = toast.loading('Guardando configuración...');
    try {
      await updateSettings(formData);
      toast.success('Configuración guardada exitosamente', { id: toastId });
    } catch (err) {
      console.error('Error al guardar configuración:', err);
      toast.error('Error al guardar cambios', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-container animate-fade">
      <div className="page-header-row" style={{ alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>Configuración</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
            Ajustes globales del sistema y datos fiscales del restaurante
          </p>
        </div>
        <button 
          type="button" 
          className="btn btn-primary" 
          onClick={handleGuardarCambios}
          disabled={isSaving}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', fontWeight: 600 }}
        >
          <Save size={18} />
          {isSaving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
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
                placeholder="Ej. contacto@sodalatica.cr"
              />
            </div>
          </div>
        </div>

        {/* Notificaciones y API Keys */}
        <div className="card">
          <div className="card-title" style={{ marginBottom:4 }}>Integraciones y Notificaciones</div>
          <div className="card-subtitle" style={{ marginBottom:16 }}>Configuración de claves para envío de correos y mensajes</div>
          
          <div style={{ display:'grid', gap:12 }}>
            <div className="form-group">
              <label className="form-label">API Key de Resend (Emails)</label>
              <input
                className="form-input"
                type="password"
                name="resend_api_key"
                value={formData.resend_api_key}
                onChange={handleChange}
                placeholder="re_..."
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Si ya está configurada, puede que se muestre enmascarada. Ingrese la nueva para sobreescribir.</span>
            </div>

            <div className="form-group">
              <label className="form-label">Dominio Verificado (Resend)</label>
              <input
                className="form-input"
                name="resend_verified_domain"
                value={formData.resend_verified_domain}
                onChange={handleChange}
                placeholder="Ej. facturas@misoda.com"
              />
            </div>

            <div className="form-group" style={{ marginTop: 8 }}>
              <label className="form-label">API Key de WhatsApp (Genérico)</label>
              <input
                className="form-input"
                type="password"
                name="whatsapp_api_key"
                value={formData.whatsapp_api_key}
                onChange={handleChange}
                placeholder="••••••••••••"
              />
            </div>

            <div className="form-group" style={{ marginTop: 8 }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Plantilla de Notificación por WhatsApp</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '0.75rem', height: 'auto', padding: '2px 8px' }}
                  onClick={() => {
                    const defaultTmpl = `*PEDIDO #{numeroPedido}*\n\nCliente: {cliente}\n\n*Productos:*\n{productos}\n\n*Total: {total}*\n\nEstado actual: {estado}`;
                    setFormData(prev => ({ ...prev, whatsapp_template: defaultTmpl }));
                  }}
                >
                  Restaurar predeterminado
                </button>
              </label>
              <textarea
                className="form-input"
                name="whatsapp_template"
                rows={6}
                value={formData.whatsapp_template}
                onChange={handleChange}
                placeholder="*PEDIDO #{numeroPedido}*&#10;&#10;Cliente: {cliente}&#10;&#10;*Productos:*&#10;{productos}&#10;&#10;*Total: {total}*&#10;&#10;Estado: {estado}"
                style={{ fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.4' }}
              />
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span>Variables disponibles para usar en la plantilla:</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>
                  {'{numeroPedido}'}, {'{cliente}'}, {'{telefono}'}, {'{productos}'}, {'{total}'}, {'{estado}'}, {'{restaurante}'}, {'{tipoPedido}'}
                </span>
              </div>
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
                type="button"
                className={`btn ${formData.moneda === m ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFormData(prev => ({ ...prev, moneda: m }))}
              >
                {m === 'CRC' ? '₡ Colones (CRC)' : '$ Dólares (USD)'}
              </button>
            ))}
          </div>
          {formData.moneda === 'USD' && (
            <div className="form-group" style={{ marginTop:16 }}>
              <label className="form-label">Tasa de Cambio (₡ por $1)</label>
              <input
                className="form-input"
                type="number"
                name="tasaCambio"
                value={formData.tasaCambio}
                onChange={handleChange}
                style={{ maxWidth:160 }}
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
                type="button"
                className={`btn ${Number(formData.tasaImpuesto) === t ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFormData(prev => ({ ...prev, tasaImpuesto: t }))}
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
                type="button"
                className={`btn ${formData.tema === v ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFormData(prev => ({ ...prev, tema: v }))}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Botón inferior de guardar cambios */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={handleGuardarCambios}
            disabled={isSaving}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', fontWeight: 600 }}
          >
            <Save size={18} />
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

