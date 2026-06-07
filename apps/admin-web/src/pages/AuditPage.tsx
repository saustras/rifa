import { useMemo, useState } from 'react';

import type { AdminAuditLog, AdminNotificationLog } from '../types';
import { formatDate } from '../utils';

interface AuditPageProps {
  readonly auditLogs: readonly AdminAuditLog[];
  readonly notifications: readonly AdminNotificationLog[];
}

const ACTION_LABELS: Record<string, string> = {
  raffle_created: 'Campaña creada',
  raffle_updated: 'Campaña actualizada',
  order_created: 'Orden creada',
  proof_uploaded: 'Comprobante subido',
  order_approved: 'Orden aprobada',
  order_rejected: 'Orden rechazada',
  number_blocked: 'Número bloqueado',
  number_released: 'Número liberado',
  draw_result_registered: 'Resultado registrado',
};

export const AuditPage = ({ auditLogs, notifications }: AuditPageProps) => {
  const [tab, setTab] = useState<'audit' | 'notifications'>('audit');

  const failedNotifications = useMemo(
    () => notifications.filter((item) => item.status === 'failed').length,
    [notifications],
  );

  return (
    <section className="audit-layout">
      <div className="tab-row">
        <button
          type="button"
          className={`tab-btn${tab === 'audit' ? ' is-active' : ''}`}
          onClick={() => setTab('audit')}
        >
          Auditoría ({auditLogs.length})
        </button>
        <button
          type="button"
          className={`tab-btn${tab === 'notifications' ? ' is-active' : ''}`}
          onClick={() => setTab('notifications')}
        >
          Notificaciones ({notifications.length})
          {failedNotifications > 0 ? (
            <span className="sidebar-badge">{failedNotifications}</span>
          ) : null}
        </button>
      </div>

      {tab === 'audit' ? (
        <article className="panel">
          <h2>Registro de auditoría</h2>
          {auditLogs.length === 0 ? (
            <p className="muted">Sin eventos registrados todavía.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Acción</th>
                    <th>Entidad</th>
                    <th>ID</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="muted">{formatDate(log.createdAt)}</td>
                      <td>{ACTION_LABELS[log.action] ?? log.action}</td>
                      <td>{log.entityType}</td>
                      <td className="mono">{log.entityId.slice(0, 12)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      ) : (
        <article className="panel">
          <h2>Historial de notificaciones</h2>
          <p className="muted">Correos al comprador y alertas Telegram al vendedor.</p>
          {notifications.length === 0 ? (
            <p className="muted">Sin notificaciones enviadas.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Canal</th>
                    <th>Tipo</th>
                    <th>Destino</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((item) => (
                    <tr key={item.id}>
                      <td className="muted">{formatDate(item.createdAt)}</td>
                      <td>{item.channel}</td>
                      <td>{item.type}</td>
                      <td>{item.recipient}</td>
                      <td>
                        <span className={`status-pill status-${item.status}`}>{item.status}</span>
                        {item.errorMessage ? (
                          <small className="block-muted">{item.errorMessage}</small>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      )}
    </section>
  );
};
