import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Save, Check, ShieldAlert, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../services/apiService';
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
    whatsapp_template: '',
    moneda: 'CRC',
    tasaCambio: 520,
    tasaImpuesto: 13,
    cargar_servicio_mesa: false,
    regimenSimplificado: true,
    tema: 'dark'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const handleRevokeTerminals = async () => {
    const confirmed = await confirmDialog({
      title: '¿Cerrar sesión en todas las terminales?',
      text: 'Esta acción incrementará la versión de seguridad de tu soda y desconectará inmediatamente todas las terminales, tabletas y pantallas. Se requerirá iniciar sesión nuevamente con la contraseña del restaurante.',
      confirmButtonText: 'Sí, desconectar todo',
      cancelButtonText: 'Cancelar',
      icon: 'warning',
      isDanger: true,
    });

    if (!confirmed) return;

    setRevoking(true);
    try {
      await api.post('/configuracion/revoke-terminals');
      toast.success('Todas las terminales han sido desconectadas');
      localStorage.removeItem('session');
      localStorage.removeItem('tenant_slug');
      setTimeout(() => {
        window.location.href = '/';
      }, 900);
    } catch (err) {
      toast.error(err.message || 'Error al revocar terminales');
      setRevoking(false);
    }
  };

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
        whatsapp_template: settings.whatsapp_template || '',
        moneda: settings.moneda || 'CRC',
        tasaCambio: settings.tasaCambio !== undefined ? settings.tasaCambio : 520,
        tasaImpuesto: settings.tasaImpuesto !== undefined ? settings.tasaImpuesto : 13,
        cargar_servicio_mesa: settings.cargar_servicio_mesa || false,
        regimenSimplificado: settings.regimenSimplificado !== undefined ? settings.regimenSimplificado : true,
        tema: settings.tema || 'dark'
      });
    }
  }, [settings]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
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
    try {
      await updateSettings(formData);
    } catch (err) {
      console.error('Error al guardar configuración:', err);
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
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Plantilla de Notificación por WhatsApp Web</span>
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

            <div className="form-group" style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="form-label" style={{ margin: 0 }}>Cargar 10% de Servicio en Mesas</span>
                <label className={`toggle-switch ${formData.cargar_servicio_mesa ? 'active' : ''}`}>
                  <input
                    type="checkbox"
                    name="cargar_servicio_mesa"
                    checked={formData.cargar_servicio_mesa}
                    onChange={handleChange}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                Si está activo, se cobrará un 10% de servicio en las facturas de comandas servidas en mesa. No aplica para barra ni delivery.
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="form-label" style={{ margin: 0 }}>Régimen de Tributación Simplificada (RTS)</span>
                <label className={`toggle-switch ${formData.regimenSimplificado ? 'active' : ''}`}>
                  <input
                    type="checkbox"
                    name="regimenSimplificado"
                    checked={formData.regimenSimplificado}
                    onChange={handleChange}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                {formData.regimenSimplificado
                  ? 'Activo: los precios del menú son precios finales al consumidor. El IVA se liquida trimestralmente ante Hacienda sobre las compras del negocio, no se cobra por separado al cliente. El 10% de servicio (Ley 9116) se calcula sobre el subtotal de productos.'
                  : 'Inactivo (Régimen Tradicional): el IVA se calcula y cobra por encima del precio del producto. Confirme con su contador antes de cambiar esta opción.'
                }
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

        {/* Seguridad de Terminales (Revocación Masiva) */}
        <div className="card" style={{ border: '1px solid rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <ShieldAlert size={20} style={{ color: '#ef4444' }} />
            <div className="card-title" style={{ margin: 0, color: '#ef4444' }}>Seguridad de Terminales</div>
          </div>
          <div className="card-subtitle" style={{ marginBottom: 16 }}>
            Control de sesiones y dispositivos conectados a esta soda
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
            padding: '14px 16px',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-md, 10px)',
            border: '1px solid var(--border)'
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 4 }}>
                Cerrar sesión en todas las terminales
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: 520, lineHeight: 1.4 }}>
                Si sospechas que una terminal fue extraviada o deseas forzar la desconexión de todas las tabletas, cocinas y cajas vinculadas a esta soda, presiona este botón. Todos los dispositivos deberán volver a ingresar la contraseña del local.
              </div>
            </div>

            <button
              type="button"
              className="btn btn-danger"
              onClick={handleRevokeTerminals}
              disabled={revoking}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              <LogOut size={16} />
              {revoking ? 'Desconectando...' : 'Desconectar Terminales'}
            </button>
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

