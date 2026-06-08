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
        <h2>Cuenta</h2>
        <p className="muted">
          Administra el acceso al panel y mantén segura la operación de tus campañas.
        </p>

        <dl className="health-list">
          <div>
            <dt>Usuario</dt>
            <dd>{session?.user.username ?? 'Sin sesión'}</dd>
          </div>
          <div>
            <dt>Rol</dt>
            <dd>Administrador</dd>
          </div>
          <div>
            <dt>Sesión activa hasta</dt>
            <dd>
              {session ? new Date(session.expiresAt * 1000).toLocaleString() : 'Sin sesión'}
            </dd>
          </div>
        </dl>

        <div className="settings-actions">
          <button type="button" className="btn btn-primary">
            Cambiar contraseña
          </button>
          <button type="button" className="btn btn-ghost" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
        <p className="settings-note">
          El cambio de contraseña quedará habilitado cuando conectemos el dominio con HTTPS.
        </p>
      </article>

      <article className="panel">
        <h2>Estado de la app</h2>
        <dl className="health-list">
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
            <dd>{API_BASE_URL ? 'Conectado al servidor configurado' : 'Conectado al servidor principal'}</dd>
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
        <h2>Preferencias</h2>
        <ul className="settings-option-list">
          <li>
            <strong>Notificaciones</strong>
            <span>Configura los avisos de pagos aprobados, rechazados y nuevos comprobantes.</span>
          </li>
          <li>
            <strong>Datos de pago</strong>
            <span>Actualiza las instrucciones, cuenta bancaria o QR desde cada campaña.</span>
          </li>
          <li>
            <strong>Dominio y enlaces</strong>
            <span>Cuando tengas dominio, conectaremos la landing y el panel con HTTPS.</span>
          </li>
          <li>
            <strong>Respaldo de información</strong>
            <span>Antes de vender en producción, activaremos copias de seguridad de la base de datos.</span>
          </li>
        </ul>
      </article>
    </section>
  );
};
