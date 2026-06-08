import { DEFAULT_SELLER_SETTINGS } from '@rifa/shared';
import { useEffect, useState, type FormEvent } from 'react';

import { ImageUploadField } from '../components/ImageUploadField';
import {
  fetchDbHealth,
  fetchSellerSettings,
  updateSellerSettings,
  uploadDefaultPaymentQr,
} from '../api';
import { API_BASE_URL, PUBLIC_WEB_URL } from '../config';
import type { AdminCredentials, AdminSession, SellerSettings } from '../types';

interface SettingsPageProps {
  readonly credentials: AdminCredentials;
  readonly session: AdminSession | null;
  readonly onLogout: () => void;
}

const readSettings = (settings?: SellerSettings | null): SellerSettings => ({
  ...DEFAULT_SELLER_SETTINGS,
  ...(settings ?? {}),
});

export const SettingsPage = ({ credentials, session, onLogout }: SettingsPageProps) => {
  const [dbHealth, setDbHealth] = useState<{
    ok: boolean;
    sellersCount?: number;
    error?: string;
  } | null>(null);
  const [settings, setSettings] = useState<SellerSettings>(() => readSettings());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    void fetchDbHealth()
      .then(setDbHealth)
      .catch(() => setDbHealth({ ok: false, error: 'Sin respuesta' }));
  }, []);

  useEffect(() => {
    let active = true;

    void fetchSellerSettings(credentials)
      .then((data) => {
        if (active) {
          setSettings(readSettings(data));
        }
      })
      .catch((settingsError: unknown) => {
        if (active) {
          setError(
            settingsError instanceof Error
              ? settingsError.message
              : 'No se pudo cargar la configuración.',
          );
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [credentials]);

  const updateField = (field: keyof SellerSettings, value: string) => {
    setSettings((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    setMessage('');

    try {
      const saved = await updateSellerSettings(credentials, settings);
      setSettings(readSettings(saved));
      setMessage('Configuración guardada. Las campañas usarán estos datos por defecto.');
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQrSelect = async (file: File) => {
    setIsUploadingQr(true);
    setError('');
    setMessage('');

    try {
      const paymentQrImageUrl = await uploadDefaultPaymentQr(credentials, file);
      updateField('defaultPaymentQrImageUrl', paymentQrImageUrl);
      setMessage('QR de pago por defecto actualizado.');
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : 'No se pudo subir el QR.');
    } finally {
      setIsUploadingQr(false);
    }
  };

  if (isLoading) {
    return <p className="muted">Cargando configuración…</p>;
  }

  return (
    <form className="settings-layout" onSubmit={handleSubmit}>
      <article className="panel settings-panel-wide">
        <div className="settings-panel-head">
          <div>
            <h2>Configuración global</h2>
            <p className="muted">
              Estos datos se reutilizan en todas las campañas. La campaña solo debe cambiar lo
              específico del sorteo o del premio.
            </p>
          </div>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? 'Guardando…' : 'Guardar configuración'}
          </button>
        </div>

        {error ? <p className="alert alert-error">{error}</p> : null}
        {message ? <p className="alert alert-success">{message}</p> : null}

        <h3>Marca y organizador</h3>
        <div className="form-grid">
          <label className="field">
            <span>Nombre de marca</span>
            <input
              value={settings.brandName ?? ''}
              onChange={(event) => updateField('brandName', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Subtítulo / slogan</span>
            <input
              value={settings.brandSubtitle ?? ''}
              onChange={(event) => updateField('brandSubtitle', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Empresa organizadora</span>
            <input
              value={settings.organizerCompany ?? ''}
              onChange={(event) => updateField('organizerCompany', event.target.value)}
            />
          </label>
          <label className="field">
            <span>NIT / documento</span>
            <input
              value={settings.organizerTaxId ?? ''}
              onChange={(event) => updateField('organizerTaxId', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Dirección</span>
            <input
              value={settings.organizerAddress ?? ''}
              onChange={(event) => updateField('organizerAddress', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Ciudad</span>
            <input
              value={settings.organizerCity ?? ''}
              onChange={(event) => updateField('organizerCity', event.target.value)}
            />
          </label>
        </div>

        <h3>Contacto, footer y redes</h3>
        <div className="form-grid">
          <label className="field">
            <span>Teléfono de soporte</span>
            <input
              value={settings.supportPhone ?? ''}
              onChange={(event) => updateField('supportPhone', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Email de soporte</span>
            <input
              type="email"
              value={settings.supportEmail ?? ''}
              onChange={(event) => updateField('supportEmail', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Horario</span>
            <input
              value={settings.supportHours ?? ''}
              onChange={(event) => updateField('supportHours', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Instagram URL</span>
            <input
              value={settings.instagramUrl ?? ''}
              onChange={(event) => updateField('instagramUrl', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Facebook URL</span>
            <input
              value={settings.facebookUrl ?? ''}
              onChange={(event) => updateField('facebookUrl', event.target.value)}
            />
          </label>
          <label className="field">
            <span>YouTube URL</span>
            <input
              value={settings.youtubeUrl ?? ''}
              onChange={(event) => updateField('youtubeUrl', event.target.value)}
            />
          </label>
          <label className="field field-span-2">
            <span>Texto del footer</span>
            <textarea
              rows={2}
              value={settings.footerBrandText ?? ''}
              onChange={(event) => updateField('footerBrandText', event.target.value)}
            />
          </label>
          <label className="field field-span-2">
            <span>Copyright</span>
            <input
              value={settings.copyrightText ?? ''}
              onChange={(event) => updateField('copyrightText', event.target.value)}
            />
          </label>
        </div>
      </article>

      <article className="panel">
        <h2>Pagos por defecto</h2>
        <p className="muted">
          Se aplican a nuevas campañas y a campañas que no tengan datos de pago propios.
        </p>

        <ImageUploadField
          label="QR de pago por defecto"
          hint="Usa este QR cuando una campaña no tenga QR propio."
          previewSrc={settings.defaultPaymentQrImageUrl || null}
          emptyLabel="Sin QR global"
          previewAlt="QR de pago por defecto"
          isUploading={isUploadingQr}
          onFileSelect={(file) => void handleQrSelect(file)}
          onInvalidFile={setError}
        />

        <div className="form-grid settings-payment-grid">
          <label className="field">
            <span>Método de pago</span>
            <input
              value={settings.defaultPaymentMethodLabel ?? ''}
              onChange={(event) => updateField('defaultPaymentMethodLabel', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Titular cuenta</span>
            <input
              value={settings.defaultPaymentAccountHolder ?? ''}
              onChange={(event) => updateField('defaultPaymentAccountHolder', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Tipo de cuenta</span>
            <input
              value={settings.defaultPaymentAccountType ?? ''}
              onChange={(event) => updateField('defaultPaymentAccountType', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Número de cuenta</span>
            <input
              value={settings.defaultPaymentAccountNumber ?? ''}
              onChange={(event) => updateField('defaultPaymentAccountNumber', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Documento / NIT</span>
            <input
              value={settings.defaultPaymentDocumentNumber ?? ''}
              onChange={(event) => updateField('defaultPaymentDocumentNumber', event.target.value)}
            />
          </label>
          <label className="field field-span-2">
            <span>Instrucciones de pago</span>
            <textarea
              rows={3}
              value={settings.defaultPaymentInstructions ?? ''}
              onChange={(event) => updateField('defaultPaymentInstructions', event.target.value)}
            />
          </label>
        </div>
      </article>

      <article className="panel">
        <h2>Cuenta y estado</h2>
        <dl className="health-list">
          <div>
            <dt>Usuario</dt>
            <dd>{session?.user.username ?? 'Sin sesión'}</dd>
          </div>
          <div>
            <dt>Ventas y campañas</dt>
            <dd>
              {dbHealth === null ? (
                <span className="muted">Verificando…</span>
              ) : dbHealth.ok ? (
                <span className="status-pill status-paid">Funcionando correctamente</span>
              ) : (
                <span className="status-pill status-rejected">
                  {dbHealth.error ?? 'Requiere revisión'}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>Panel administrativo</dt>
            <dd>{API_BASE_URL ? 'Conectado al servidor configurado' : 'Servidor principal'}</dd>
          </div>
          <div>
            <dt>Landing pública</dt>
            <dd>
              <a href={PUBLIC_WEB_URL} target="_blank" rel="noreferrer">
                {PUBLIC_WEB_URL}
              </a>
            </dd>
          </div>
        </dl>

        <div className="settings-actions">
          <button type="button" className="btn btn-ghost" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </article>
    </form>
  );
};
