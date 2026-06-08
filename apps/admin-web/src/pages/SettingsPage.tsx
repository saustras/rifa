import { useEffect, useState } from 'react';

import { fetchDbHealth } from '../api';
import { API_BASE_URL, PUBLIC_WEB_URL } from '../config';
import type { AdminSession } from '../types';

interface SettingsPageProps {
  readonly session: AdminSession | null;
  readonly onLogout: () => void;
}

export const SettingsPage = ({ session, onLogout }: SettingsPageProps) => {
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
        <h2>Sesión de administrador</h2>
        <p className="muted">
          El panel usa JWT enviado por header <code>Authorization</code>. Mantén el admin cerrado por
          túnel hasta configurar dominio y HTTPS.
        </p>

        <dl className="health-list">
          <div>
            <dt>Usuario</dt>
            <dd className="mono muted">{session?.user.username ?? 'Sin sesión'}</dd>
          </div>
          <div>
            <dt>Seller ID</dt>
            <dd className="mono muted">{session?.user.sellerId ?? 'Sin sesión'}</dd>
          </div>
          <div>
            <dt>Expira</dt>
            <dd className="mono muted">
              {session ? new Date(session.expiresAt * 1000).toLocaleString() : 'Sin sesión'}
            </dd>
          </div>
        </dl>

        <button type="button" className="btn btn-primary" onClick={onLogout}>
          Cerrar sesión
        </button>
      </article>

      <article className="panel">
        <h2>Estado del sistema</h2>
        <dl className="health-list">
          <div>
            <dt>Base de datos</dt>
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
            <code>DATABASE_URL</code> — PGlite local o PostgreSQL real en producción
          </li>
          <li>
            <code>ADMIN_USERNAME</code>, <code>ADMIN_PASSWORD</code>, <code>JWT_SECRET</code> — login del
            panel admin
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
