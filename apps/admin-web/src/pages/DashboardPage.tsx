import { PUBLIC_WEB_URL } from '../config';
import type { AdminRaffle, OrderListRow } from '../types';
import { formatDate, formatMoney, getMetrics, getRaffleProgress, toStatusLabel } from '../utils';

interface DashboardPageProps {
  readonly orders: readonly OrderListRow[];
  readonly raffles: readonly AdminRaffle[];
  readonly onGoOrders: () => void;
  readonly onGoCampaigns: () => void;
}

export const DashboardPage = ({
  orders,
  raffles,
  onGoOrders,
  onGoCampaigns,
}: DashboardPageProps) => {
  const metrics = getMetrics(orders);
  const activeRaffle = raffles.find((raffle) => raffle.status === 'active') ?? raffles[0];
  const progress = activeRaffle
    ? getRaffleProgress(orders, activeRaffle.id, activeRaffle.numberMax, activeRaffle.numberMin)
    : null;
  const recentOrders = [...orders].slice(0, 5);

  return (
    <>
      <section className="kpi-grid" aria-label="Indicadores principales">
        <article className="kpi-card">
          <span className="kpi-icon kpi-icon-blue" aria-hidden="true">
            $
          </span>
          <div>
            <small>Ventas de hoy</small>
            <strong>{formatMoney(metrics.todayRevenue)}</strong>
            <span className="kpi-trend kpi-trend-up">Ingresos aprobados hoy</span>
          </div>
        </article>
        <article className="kpi-card">
          <span className="kpi-icon kpi-icon-green" aria-hidden="true">
            ✓
          </span>
          <div>
            <small>Ingresos confirmados</small>
            <strong>{formatMoney(metrics.revenue)}</strong>
            <span className="kpi-trend kpi-trend-up">{metrics.paid} órdenes pagadas</span>
          </div>
        </article>
        <article className="kpi-card">
          <span className="kpi-icon kpi-icon-gold" aria-hidden="true">
            #
          </span>
          <div>
            <small>Participaciones vendidas</small>
            <strong>{metrics.participationsSold.toLocaleString('es-CO')}</strong>
            <span className="kpi-trend">{metrics.total} órdenes totales</span>
          </div>
        </article>
        <article className="kpi-card">
          <span className="kpi-icon kpi-icon-orange" aria-hidden="true">
            !
          </span>
          <div>
            <small>Pendientes de revisión</small>
            <strong>{metrics.pending}</strong>
            <span className="kpi-trend">Requieren acción</span>
          </div>
        </article>
      </section>

      <section className="dashboard-grid">
        {activeRaffle && progress ? (
          <article className="panel panel-campaign">
            <header className="panel-head">
              <div>
                <span className="panel-eyebrow">Campaña activa</span>
                <h2>{activeRaffle.title}</h2>
                <p>/{activeRaffle.slug}</p>
              </div>
              <span className="status-pill status-active">Activa</span>
            </header>

            <div className="campaign-progress">
              <div className="progress-head">
                <strong>Participaciones vendidas</strong>
                <span>
                  {progress.sold.toLocaleString('es-CO')} / {progress.total.toLocaleString('es-CO')}
                </span>
              </div>
              <div className="progress-track">
                <span style={{ width: `${progress.percentage}%` }} />
              </div>
              <div className="progress-foot">
                <span>{progress.percentage}% del total</span>
                <span>
                  Precio: {formatMoney(activeRaffle.pricePerNumber, activeRaffle.currency)}
                </span>
              </div>
            </div>

            <div className="panel-actions">
              <a
                className="btn btn-primary"
                href={`${PUBLIC_WEB_URL}/?slug=${activeRaffle.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                Ver campaña
              </a>
              <button type="button" className="btn btn-ghost" onClick={onGoCampaigns}>
                Gestionar
              </button>
            </div>
          </article>
        ) : (
          <article className="panel panel-empty">
            <h2>Sin campañas activas</h2>
            <p>Crea o activa una campaña para empezar a vender participaciones.</p>
            <button type="button" className="btn btn-primary" onClick={onGoCampaigns}>
              Ver campañas
            </button>
          </article>
        )}

        <article className="panel">
          <header className="panel-head panel-head-row">
            <h2>Compras recientes</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onGoOrders}>
              Ver todas
            </button>
          </header>

          {recentOrders.length === 0 ? (
            <p className="muted">Aún no hay compras registradas.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Particip.</th>
                    <th>Monto</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <div className="cell-user">
                          <span className="avatar-sm">
                            {order.customerName.slice(0, 2).toUpperCase()}
                          </span>
                          <span>{order.customerName}</span>
                        </div>
                      </td>
                      <td>{order.numbersRequested}</td>
                      <td className="money">{formatMoney(order.amount, order.currency)}</td>
                      <td>
                        <span className={`status-pill status-${order.status}`}>
                          {toStatusLabel(order.status)}
                        </span>
                      </td>
                      <td className="muted">{formatDate(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="panel panel-actions-card">
          <h2>Acciones rápidas</h2>
          <div className="quick-actions">
            <button type="button" className="btn btn-primary" onClick={onGoCampaigns}>
              Ver campañas
            </button>
            <button type="button" className="btn btn-ghost" onClick={onGoOrders}>
              Revisar órdenes
            </button>
            <a
              className="btn btn-ghost"
              href={`${PUBLIC_WEB_URL}/?slug=${activeRaffle?.slug ?? 'rifa-demo-moto-electrica'}`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir landing
            </a>
          </div>
          <div className="tip-box">
            <strong>Consejo</strong>
            <p>
              Revisa primero las órdenes con comprobante subido para acelerar la confirmación de
              participaciones.
            </p>
          </div>
        </article>
      </section>
    </>
  );
};
