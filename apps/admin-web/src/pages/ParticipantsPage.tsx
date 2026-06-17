import { useMemo, useState } from 'react';

import { fetchCustomerDetail } from '../api';
import type { AdminCredentials, AdminCustomer, AdminCustomerDetail } from '../types';
import { formatDate } from '../utils';

interface ParticipantsPageProps {
  readonly credentials: AdminCredentials;
  readonly customers: readonly AdminCustomer[];
}

const formatMoney = (amount: string, currency: string): string => {
  const value = Number(amount);

  if (!Number.isFinite(value)) {
    return '—';
  }

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: currency || 'COP',
    maximumFractionDigits: 0,
  }).format(value);
};

const STATUS_LABELS: Record<string, string> = {
  pending_review: 'Pendiente',
  paid: 'Pagado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
};

export const ParticipantsPage = ({
  credentials,
  customers,
}: ParticipantsPageProps) => {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<AdminCustomer | null>(null);
  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return customers;
    }

    return customers.filter((customer) =>
      [customer.fullName, customer.email, customer.phone, customer.documentNumber]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [customers, search]);

  const handleOpenDetail = async (customer: AdminCustomer) => {
    setSelectedCustomer(customer);
    setIsLoadingDetail(true);

    try {
      const data = await fetchCustomerDetail(credentials, customer.id);
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedCustomer(null);
    setDetail(null);
  };

  return (
    <section className="panel">
      <header className="panel-head panel-head-row">
        <div>
          <h2>Participantes</h2>
          <p className="muted">{filtered.length} clientes registrados</p>
        </div>
        <label className="field field-inline">
          <span className="sr-only">Buscar</span>
          <input
            placeholder="Buscar por nombre, email o teléfono"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </header>

      {filtered.length === 0 ? (
        <p className="muted">
          Aún no hay participantes. Las compras crearán clientes automáticamente.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Documento</th>
                <th>Teléfono</th>
                <th>Órdenes</th>
                <th>Registro</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer) => (
                <tr
                  key={customer.id}
                  className="clickable-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => void handleOpenDetail(customer)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      void handleOpenDetail(customer);
                    }
                  }}
                >
                  <td>
                    <div className="cell-user">
                      <span className="avatar-sm">
                        {customer.fullName.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <strong>{customer.fullName}</strong>
                        <small>{customer.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>{customer.documentNumber}</td>
                  <td>{customer.phone}</td>
                  <td>{customer.ordersCount}</td>
                  <td className="muted">{formatDate(customer.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedCustomer ? (
        <>
          <button
            type="button"
            className="modal-backdrop"
            aria-label="Cerrar detalle"
            onClick={handleCloseDetail}
          />
          <dialog
            className="participant-detail-modal"
            open
            aria-labelledby="participant-modal-title"
          >
            <header className="modal-head">
              <div>
                <p className="modal-eyebrow">Detalle del participante</p>
                <h2 id="participant-modal-title">{selectedCustomer.fullName}</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Cerrar"
                onClick={handleCloseDetail}
              >
                ×
              </button>
            </header>

            <dl className="modal-detail-grid">
              <div>
                <dt>Email</dt>
                <dd>{selectedCustomer.email}</dd>
              </div>
              <div>
                <dt>Teléfono</dt>
                <dd>{selectedCustomer.phone}</dd>
              </div>
              <div>
                <dt>Documento</dt>
                <dd>{selectedCustomer.documentNumber}</dd>
              </div>
              {selectedCustomer.city ? (
                <div>
                  <dt>Ciudad</dt>
                  <dd>{selectedCustomer.city}</dd>
                </div>
              ) : null}
              <div>
                <dt>Registro</dt>
                <dd>{formatDate(selectedCustomer.createdAt)}</dd>
              </div>
              <div>
                <dt>Órdenes</dt>
                <dd>{selectedCustomer.ordersCount}</dd>
              </div>
            </dl>

            {isLoadingDetail ? (
              <p className="muted" role="status">
                Cargando historial…
              </p>
            ) : detail ? (
              <>
                <h3 className="modal-section-title">
                  Historial de compras
                </h3>

                {detail.totalOrders > 0 ? (
                  <p className="detail-total-summary">
                    {detail.totalOrders} orden{detail.totalOrders !== 1 ? 'es' : ''} · Total:{' '}
                    <strong>{formatMoney(detail.totalAmount, 'COP')}</strong>
                  </p>
                ) : null}

                {detail.orders.map((order) => (
                  <article key={order.orderId} className="participant-order-card">
                    <div className="participant-order-head">
                      <strong>{order.raffleTitle}</strong>
                      <span className={`status-pill status-${order.orderStatus === 'paid' ? 'active' : order.orderStatus === 'pending_review' ? 'pending' : 'cancelled'}`}>
                        {STATUS_LABELS[order.orderStatus] ?? order.orderStatus}
                      </span>
                    </div>
                    <dl className="participant-order-meta">
                      <div>
                        <dt>Monto</dt>
                        <dd>{formatMoney(order.amount, order.currency)}</dd>
                      </div>
                      <div>
                        <dt>Fecha</dt>
                        <dd>{formatDate(order.createdAt)}</dd>
                      </div>
                      <div>
                        <dt>Números</dt>
                        <dd>
                          {order.numbers.length > 0
                            ? order.numbers.join(', ')
                            : `${order.numbersRequested} número(s)`}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}

                {detail.totalOrders === 0 ? (
                  <p className="muted">Sin órdenes registradas.</p>
                ) : null}
              </>
            ) : (
              <p className="alert alert-error" role="alert">
                No se pudo cargar el historial de compras.
              </p>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCloseDetail}
              >
                Cerrar
              </button>
            </div>
          </dialog>
        </>
      ) : null}
    </section>
  );
};
