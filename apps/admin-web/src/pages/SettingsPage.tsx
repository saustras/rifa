import { useEffect, useState, type FormEvent } from 'react';

import { fetchDbHealth } from '../api';
import { API_BASE_URL, PUBLIC_WEB_URL } from '../config';
import type { AdminCredentials } from '../types';

interface SettingsPageProps {
  readonly draftCredentials: AdminCredentials;
  readonly onChange: (credentials: AdminCredentials) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export const SettingsPage = ({ draftCredentials, onChange, onSubmit }: SettingsPageProps) => {
  const [dbHealth, setDbHealth] = useState<{
    ok: boolean;
    sellersCount?: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    void fetchDbHealth()
      .then(setDbHealth)
      .catch(() => setDbHealth({ ok: false, error: 'Sin respuesta' }));
  }, []);

  return (
    <section className="settings-layout">
      <article className="panel">
        <h2>Credenciales de acceso</h2>
        <p className="muted">
          Configuración temporal para desarrollo. En producción esto será reemplazado por login
          seguro.
        </p>

        <form className="settings-form" onSubmit={onSubmit}>
          <label className="field">
            <span>API key</span>
            <input
              value={draftCredentials.apiKey}
              onChange={(event) => onChange({ ...draftCredentials, apiKey: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Seller ID</span>
            <input
              value={draftCredentials.sellerId}
              onChange={(event) => onChange({ ...draftCredentials, sellerId: event.target.value })}
            />
          </label>
          <button type="submit" className="btn btn-primary">
            Guardar y recargar
          </button>
        </form>
      </article>

      <article className="panel">
        <h2>Estado del sistema</h2>
        <dl className="health-list">
          <div>
            <dt>Base de datos (PGlite)</dt>
            <dd>
              {dbHealth === null ? (
                <span className="muted">Verificando…</span>
              ) : dbHealth.ok ? (
                <span className="status-pill status-paid">
                  Conectada · {dbHealth.sellersCount ?? 0} vendedor(es)
                </span>
              ) : (
                <span className="status-pill status-rejected">
                  {dbHealth.error ?? 'Error de conexión'}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>API</dt>
            <dd className="mono muted">{API_BASE_URL || '(proxy /api)'}</dd>
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
      </article>

      <article className="panel">
        <h2>Variables (.env.example)</h2>
        <ul className="env-hints muted">
          <li>
            <code>DATABASE_URL</code> — PGlite local en <code>./packages/db/pglite-data</code>
          </li>
          <li>
            <code>API_DEV_TOKEN</code> — token para header <code>x-api-key</code>
          </li>
          <li>
            <code>SMTP_*</code> — correos al comprador al aprobar/rechazar
          </li>
          <li>
            <code>TELEGRAM_*</code> — alerta al vendedor cuando suben comprobante
          </li>
        </ul>
      </article>
    </section>
  );
};
