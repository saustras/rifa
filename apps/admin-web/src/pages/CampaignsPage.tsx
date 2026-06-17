import { activateRaffle, downloadRaffleExportCsv } from '../api';
import { PUBLIC_WEB_URL } from '../config';
import type { AdminCredentials, AdminRaffle, OrderListRow } from '../types';
import { formatMoney, getRaffleProgress } from '../utils';

interface CampaignsPageProps {
  readonly credentials: AdminCredentials;
  readonly raffles: readonly AdminRaffle[];
  readonly orders: readonly OrderListRow[];
  readonly activeCampaignId: string | null;
  readonly onCreate: () => void;
  readonly onEdit: (raffleId: string) => void;
  readonly onClone: (raffleId: string) => void;
  readonly onRefresh: () => void;
}

export const CampaignsPage = ({
  credentials,
  raffles,
  orders,
  activeCampaignId,
  onCreate,
  onEdit,
  onClone,
  onRefresh,
}: CampaignsPageProps) => {
  if (raffles.length === 0) {
    return (
      <article className="panel panel-empty">
        <h2>No hay campañas</h2>
        <p>Crea tu primera campaña para empezar a vender participaciones.</p>
        <button type="button" className="btn btn-primary" onClick={onCreate}>
          Crear campaña
        </button>
      </article>
    );
  }

  return (
    <section className="campaigns-section">
      <div className="panel-head panel-head-row">
        <h2>Mis campañas</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={onCreate}>
          + Nueva campaña
        </button>
      </div>
      <div className="campaigns-grid">
        {raffles.map((raffle) => {
          const progress = getRaffleProgress(orders, raffle.id, raffle.numberMax, raffle.numberMin);

          const isLive = raffle.id === activeCampaignId;

          return (
            <article
              key={raffle.id}
              className={`panel campaign-card${isLive ? ' campaign-card-live' : ''}`}
            >
              <header className="panel-head panel-head-row">
                <div>
                  <span className="panel-eyebrow">/{raffle.slug}</span>
                  <h2>{raffle.title}</h2>
                </div>
                <div className="campaign-card-badges">
                  {isLive ? (
                    <span className="status-pill status-live">
                      <span className="live-dot" aria-hidden="true" /> En curso
                    </span>
                  ) : null}
                  <span className={`status-pill status-${raffle.status}`}>
                    {raffle.status === 'active' ? 'Activa' : raffle.status}
                  </span>
                </div>
              </header>

              {raffle.coverImageUrl ? (
                <img
                  className="campaign-card-thumb"
                  src={raffle.coverImageUrl}
                  alt=""
                  loading="lazy"
                />
              ) : null}

              {raffle.description ? <p className="muted">{raffle.description}</p> : null}

              <dl className="campaign-meta">
                <div>
                  <dt>Precio</dt>
                  <dd>{formatMoney(raffle.pricePerNumber, raffle.currency)}</dd>
                </div>
                <div>
                  <dt>Números</dt>
                  <dd>
                    {raffle.numberMin} – {raffle.numberMax}
                  </dd>
                </div>
                <div>
                  <dt>Pago</dt>
                  <dd>{raffle.paymentMethodLabel ?? 'Transferencia'}</dd>
                </div>
              </dl>

              <div className="campaign-progress">
                <div className="progress-head">
                  <strong>Vendidas</strong>
                  <span>
                    {progress.sold} / {progress.total}
                  </span>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${progress.percentage}%` }} />
                </div>
              </div>

              <div className="panel-actions">
                <a
                  className="btn btn-primary"
                  href={`${PUBLIC_WEB_URL}/?slug=${raffle.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver landing
                </a>
                <details className="campaign-options-menu">
                  <summary className="btn btn-ghost" aria-label={`Opciones de ${raffle.title}`}>
                    Opciones
                  </summary>
                  <div className="campaign-options-popover">
                    <button type="button" onClick={() => onEdit(raffle.id)}>
                      Editar campaña
                    </button>
                    <button type="button" onClick={() => onClone(raffle.id)}>
                      Crear a partir de campaña
                    </button>
                    {!isLive ? (
                      <button
                        type="button"
                        onClick={() =>
                          void activateRaffle(credentials, raffle.id).then(() => onRefresh())
                        }
                      >
                        Poner en curso
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void downloadRaffleExportCsv(credentials, raffle.id)}
                    >
                      Exportar CSV
                    </button>
                  </div>
                </details>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
