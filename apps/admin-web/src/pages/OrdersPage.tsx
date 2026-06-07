import { useEffect, useState } from 'react';

import { approveOrder, fetchOrderDetail, rejectOrder, requestAdminBlob } from '../api';
import {
  ORDER_STATUS,
  REQUEST_STATUS,
  type AdminCredentials,
  type OrderDetail,
  type OrderListRow,
  type OrderStatus,
  type RequestStatus,
} from '../types';
import { formatDate, formatMoney, toStatusLabel } from '../utils';

interface OrdersPageProps {
  readonly credentials: AdminCredentials;
  readonly orders: readonly OrderListRow[];
  readonly ordersStatus: RequestStatus;
  readonly onRefresh: () => void;
  readonly message: string;
  readonly setMessage: (message: string) => void;
}

export const OrdersPage = ({
  credentials,
  orders,
  ordersStatus,
  onRefresh,
  message,
  setMessage,
}: OrdersPageProps) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedDetail, setSelectedDetail] = useState<OrderDetail | null>(null);
  const [proofUrl, setProofUrl] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus>(ORDER_STATUS.all);
  const [rejectionReason, setRejectionReason] = useState<string>(
    'Comprobante no válido o incompleto.',
  );
  const [detailStatus, setDetailStatus] = useState<RequestStatus>(REQUEST_STATUS.idle);
  const [actionStatus, setActionStatus] = useState<RequestStatus>(REQUEST_STATUS.idle);

  useEffect(() => {
    if (orders.length === 0) {
      setSelectedOrderId('');
      return;
    }

    if (!selectedOrderId || !orders.some((order) => order.id === selectedOrderId)) {
      const nextId =
        orders.find(
          (order) => order.status === ORDER_STATUS.pendingReview && order.paymentProofStorageKey,
        )?.id ??
        orders[0]?.id ??
        '';
      setSelectedOrderId(nextId);
    }
  }, [orders, selectedOrderId]);

  useEffect(() => {
    if (!selectedOrderId) {
      setSelectedDetail(null);
      setProofUrl('');
      return;
    }

    let isActive = true;
    let nextProofUrl = '';

    const loadDetail = async () => {
      setDetailStatus(REQUEST_STATUS.loading);

      try {
        const detail = await fetchOrderDetail(credentials, selectedOrderId);

        if (!isActive) {
          return;
        }

        setSelectedDetail(detail);
        setDetailStatus(REQUEST_STATUS.success);

        if (detail.order.paymentProofStorageKey) {
          const proof = await requestAdminBlob(
            `/api/admin/orders/${selectedOrderId}/proof`,
            credentials,
          );

          if (!isActive) {
            return;
          }

          nextProofUrl = URL.createObjectURL(proof);
          setProofUrl(nextProofUrl);
        } else {
          setProofUrl('');
        }
      } catch (error: unknown) {
        if (!isActive) {
          return;
        }

        setDetailStatus(REQUEST_STATUS.error);
        setSelectedDetail(null);
        setProofUrl('');
        setMessage(error instanceof Error ? error.message : 'No se pudo cargar el detalle.');
      }
    };

    void loadDetail();

    return () => {
      isActive = false;

      if (nextProofUrl) {
        URL.revokeObjectURL(nextProofUrl);
      }
    };
  }, [credentials, selectedOrderId, setMessage]);

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = statusFilter === ORDER_STATUS.all || order.status === statusFilter;
    const searchTarget = [
      order.customerName,
      order.customerEmail,
      order.customerPhone,
      order.raffleTitle,
      order.id,
    ]
      .join(' ')
      .toLowerCase();

    return matchesStatus && searchTarget.includes(search.trim().toLowerCase());
  });

  const canReview = selectedDetail?.order.status === ORDER_STATUS.pendingReview;
  const canApprove = Boolean(canReview && selectedDetail?.order.paymentProofStorageKey);

  const handleApprove = async () => {
    if (!selectedDetail) {
      return;
    }

    setActionStatus(REQUEST_STATUS.loading);
    setMessage('');

    try {
      await approveOrder(credentials, selectedDetail.order.id);
      setActionStatus(REQUEST_STATUS.success);
      setMessage('Orden aprobada. Los números quedaron confirmados.');
      onRefresh();
    } catch (error: unknown) {
      setActionStatus(REQUEST_STATUS.error);
      setMessage(error instanceof Error ? error.message : 'No se pudo aprobar la orden.');
    }
  };

  const handleReject = async () => {
    if (!selectedDetail || rejectionReason.trim().length < 3) {
      setMessage('Escribí un motivo de rechazo de al menos 3 caracteres.');
      return;
    }

    setActionStatus(REQUEST_STATUS.loading);
    setMessage('');

    try {
      await rejectOrder(credentials, selectedDetail.order.id, rejectionReason.trim());
      setActionStatus(REQUEST_STATUS.success);
      setMessage('Orden rechazada.');
      onRefresh();
    } catch (error: unknown) {
      setActionStatus(REQUEST_STATUS.error);
      setMessage(error instanceof Error ? error.message : 'No se pudo rechazar la orden.');
    }
  };

  return (
    <div className="orders-layout">
      <section className="panel orders-table-panel">
        <div className="toolbar">
          <label className="field field-grow">
            <span>Buscar</span>
            <input
              placeholder="Cliente, email, teléfono, rifa o ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Estado</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as OrderStatus)}
            >
              <option value={ORDER_STATUS.all}>Todos</option>
              <option value={ORDER_STATUS.pendingReview}>Pendientes</option>
              <option value={ORDER_STATUS.paid}>Pagadas</option>
              <option value={ORDER_STATUS.rejected}>Rechazadas</option>
            </select>
          </label>
        </div>

        {ordersStatus === REQUEST_STATUS.loading ? (
          <p className="muted" role="status">
            Cargando órdenes…
          </p>
        ) : null}

        {ordersStatus !== REQUEST_STATUS.loading && filteredOrders.length === 0 ? (
          <p className="muted">No hay órdenes para mostrar.</p>
        ) : null}

        {filteredOrders.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Campaña</th>
                  <th>Estado</th>
                  <th>Comprobante</th>
                  <th>Monto</th>
                  <th>Fecha</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className={order.id === selectedOrderId ? 'is-selected' : ''}>
                    <td>
                      <div className="cell-user">
                        <span className="avatar-sm">
                          {order.customerName.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <strong>{order.customerName}</strong>
                          <small>{order.customerEmail}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong>{order.raffleTitle}</strong>
                      <small>{order.numbersRequested} particip.</small>
                    </td>
                    <td>
                      <span className={`status-pill status-${order.status}`}>
                        {toStatusLabel(order.status)}
                      </span>
                    </td>
                    <td>{order.paymentProofStorageKey ? 'Subido' : '—'}</td>
                    <td className="money">{formatMoney(order.amount, order.currency)}</td>
                    <td className="muted">{formatDate(order.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setSelectedOrderId(order.id)}
                      >
                        Revisar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <aside className="panel orders-detail-panel">
        <header className="panel-head panel-head-row">
          <div>
            <h2>Detalle de revisión</h2>
            <p className="muted">
              {selectedDetail
                ? `Orden ${selectedDetail.order.id.slice(0, 8)}`
                : 'Selecciona una orden'}
            </p>
          </div>
          {selectedDetail ? (
            <span className={`status-pill status-${selectedDetail.order.status}`}>
              {toStatusLabel(selectedDetail.order.status)}
            </span>
          ) : null}
        </header>

        {detailStatus === REQUEST_STATUS.loading ? (
          <p className="muted" role="status">
            Cargando detalle…
          </p>
        ) : null}

        {!selectedDetail && detailStatus !== REQUEST_STATUS.loading ? (
          <p className="muted">Selecciona una orden para revisar cliente, números y comprobante.</p>
        ) : null}

        {selectedDetail ? (
          <>
            <dl className="detail-grid">
              <div>
                <dt>Cliente</dt>
                <dd>{selectedDetail.customer.fullName}</dd>
              </div>
              <div>
                <dt>Teléfono</dt>
                <dd>{selectedDetail.customer.phone}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{selectedDetail.customer.email}</dd>
              </div>
              <div>
                <dt>Monto</dt>
                <dd>{formatMoney(selectedDetail.order.amount, selectedDetail.order.currency)}</dd>
              </div>
            </dl>

            <div className="numbers-row">
              {selectedDetail.numbers.length > 0 ? (
                selectedDetail.numbers.map((number) => (
                  <span className="number-chip" key={number.id}>
                    {number.displayNumber}
                  </span>
                ))
              ) : (
                <span className="muted">Sin números asignados todavía.</span>
              )}
            </div>

            <div className="proof-frame">
              {proofUrl ? (
                <img src={proofUrl} alt={`Comprobante de ${selectedDetail.customer.fullName}`} />
              ) : (
                <span className="muted">Esta orden no tiene comprobante.</span>
              )}
            </div>

            <label className="field">
              <span>Motivo de rechazo</span>
              <textarea
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                disabled={!canReview || actionStatus === REQUEST_STATUS.loading}
              />
            </label>

            <div className="panel-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canApprove || actionStatus === REQUEST_STATUS.loading}
                onClick={() => void handleApprove()}
              >
                Aprobar pago
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={!canReview || actionStatus === REQUEST_STATUS.loading}
                onClick={() => void handleReject()}
              >
                Rechazar
              </button>
            </div>
          </>
        ) : null}

        {message ? (
          <p className="alert" role="status">
            {message}
          </p>
        ) : null}
      </aside>
    </div>
  );
};
