import { useEffect, useState, type FormEvent } from 'react';

import {
  approveOrder,
  createManualOrder,
  fetchOrderDetail,
  rejectOrder,
  requestAdminBlob,
} from '../api';
import { prepareImageForUpload } from '../image';
import {
  ORDER_STATUS,
  REQUEST_STATUS,
  type AdminCredentials,
  type AdminRaffle,
  type OrderDetail,
  type OrderListRow,
  type OrderStatus,
  type RequestStatus,
} from '../types';
import { formatDate, formatMoney, toStatusLabel } from '../utils';

interface OrdersPageProps {
  readonly credentials: AdminCredentials;
  readonly orders: readonly OrderListRow[];
  readonly raffles: readonly AdminRaffle[];
  readonly ordersStatus: RequestStatus;
  readonly focusedOrderId: string;
  readonly onRefresh: () => void;
  readonly onFocusedOrderHandled: () => void;
  readonly message: string;
  readonly setMessage: (message: string) => void;
}

interface ManualFormState {
  readonly raffleId: string;
  readonly fullName: string;
  readonly documentNumber: string;
  readonly email: string;
  readonly phone: string;
  readonly city: string;
  readonly quantity: string;
  readonly specificNumbers: string;
}

const emptyManualForm = (raffleId: string): ManualFormState => ({
  raffleId,
  fullName: '',
  documentNumber: '',
  email: '',
  phone: '',
  city: '',
  quantity: '1',
  specificNumbers: '',
});

export const OrdersPage = ({
  credentials,
  orders,
  raffles,
  ordersStatus,
  focusedOrderId,
  onRefresh,
  onFocusedOrderHandled,
  message,
  setMessage,
}: OrdersPageProps) => {
  const sellableRaffles = raffles.filter(
    (raffle) => raffle.status === 'active' || raffle.status === 'paused',
  );
  const defaultRaffleId =
    sellableRaffles.find((raffle) => raffle.status === 'active')?.id ??
    sellableRaffles[0]?.id ??
    raffles[0]?.id ??
    '';

  const [isManualOpen, setIsManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState<ManualFormState>(() =>
    emptyManualForm(defaultRaffleId),
  );
  const [manualProof, setManualProof] = useState<File | null>(null);
  const [manualStatus, setManualStatus] = useState<RequestStatus>(REQUEST_STATUS.idle);
  const [manualError, setManualError] = useState('');

  const updateManualField = (field: keyof ManualFormState, value: string) => {
    setManualForm((current) => ({ ...current, [field]: value }));
  };

  const openManual = () => {
    setManualForm(emptyManualForm(defaultRaffleId));
    setManualProof(null);
    setManualError('');
    setManualStatus(REQUEST_STATUS.idle);
    setIsManualOpen(true);
  };

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setManualError('');

    const parsedSpecific = manualForm.specificNumbers
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => Number(value));

    if (parsedSpecific.some((value) => !Number.isInteger(value) || value < 0)) {
      setManualError('Los números específicos deben ser enteros válidos separados por coma.');
      return;
    }

    const quantity = Number(manualForm.quantity);

    if (parsedSpecific.length === 0 && (!Number.isInteger(quantity) || quantity < 1)) {
      setManualError('Indica una cantidad válida o una lista de números específicos.');
      return;
    }

    setManualStatus(REQUEST_STATUS.loading);

    try {
      const proof = manualProof ? await prepareImageForUpload(manualProof) : undefined;

      await createManualOrder(credentials, {
        ...(manualForm.raffleId ? { raffleId: manualForm.raffleId } : {}),
        fullName: manualForm.fullName.trim(),
        documentNumber: manualForm.documentNumber.trim(),
        email: manualForm.email.trim(),
        phone: manualForm.phone.trim(),
        ...(manualForm.city.trim() ? { city: manualForm.city.trim() } : {}),
        ...(parsedSpecific.length > 0
          ? { selectedNumbers: parsedSpecific }
          : { numbersRequested: quantity }),
        ...(proof ? { proof } : {}),
      });

      setManualStatus(REQUEST_STATUS.success);
      setIsManualOpen(false);
      setMessage('Compra manual registrada y aprobada. Los números quedaron asignados.');
      onRefresh();
    } catch (error: unknown) {
      setManualStatus(REQUEST_STATUS.error);
      setManualError(
        error instanceof Error ? error.message : 'No se pudo registrar la compra manual.',
      );
    }
  };

  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedDetail, setSelectedDetail] = useState<OrderDetail | null>(null);
  const [proofUrl, setProofUrl] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus>(ORDER_STATUS.all);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [detailStatus, setDetailStatus] = useState<RequestStatus>(REQUEST_STATUS.idle);
  const [actionStatus, setActionStatus] = useState<RequestStatus>(REQUEST_STATUS.idle);

  useEffect(() => {
    if (!focusedOrderId || orders.length === 0) {
      return;
    }

    if (orders.some((order) => order.id === focusedOrderId)) {
      setSelectedOrderId(focusedOrderId);
      onFocusedOrderHandled();
      return;
    }

    setMessage('La orden del enlace no está disponible o no pertenece a este vendedor.');
    onFocusedOrderHandled();
  }, [focusedOrderId, onFocusedOrderHandled, orders, setMessage]);

  useEffect(() => {
    if (focusedOrderId) {
      return;
    }

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
  }, [focusedOrderId, orders, selectedOrderId]);

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

  useEffect(() => {
    setRejectionReason(selectedDetail?.order.rejectionReason ?? '');
  }, [selectedDetail?.order.id, selectedDetail?.order.rejectionReason]);

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
          <button type="button" className="btn btn-primary toolbar-cta" onClick={openManual}>
            + Compra manual
          </button>
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
                placeholder="Escribe el motivo real para informar al comprador."
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

      {isManualOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Compra manual">
          <div className="modal-card panel">
            <header className="panel-head panel-head-row">
              <div>
                <h2>Registrar compra manual</h2>
                <p className="muted">
                  La orden se crea aprobada y los números se asignan de inmediato.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setIsManualOpen(false)}
              >
                Cerrar
              </button>
            </header>

            <form className="manual-order-form" onSubmit={(event) => void handleManualSubmit(event)}>
              <div className="form-grid">
                <label className="field field-span-2">
                  <span>Campaña</span>
                  <select
                    value={manualForm.raffleId}
                    onChange={(event) => updateManualField('raffleId', event.target.value)}
                  >
                    {raffles.length === 0 ? <option value="">Sin campañas</option> : null}
                    {raffles.map((raffle) => (
                      <option key={raffle.id} value={raffle.id}>
                        {raffle.title} ({raffle.status})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Nombre completo *</span>
                  <input
                    value={manualForm.fullName}
                    onChange={(event) => updateManualField('fullName', event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span>Documento *</span>
                  <input
                    value={manualForm.documentNumber}
                    onChange={(event) => updateManualField('documentNumber', event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span>Email *</span>
                  <input
                    type="email"
                    value={manualForm.email}
                    onChange={(event) => updateManualField('email', event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span>WhatsApp / teléfono *</span>
                  <input
                    value={manualForm.phone}
                    onChange={(event) => updateManualField('phone', event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span>Ciudad</span>
                  <input
                    value={manualForm.city}
                    onChange={(event) => updateManualField('city', event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Cantidad de números</span>
                  <input
                    type="number"
                    min={1}
                    value={manualForm.quantity}
                    onChange={(event) => updateManualField('quantity', event.target.value)}
                  />
                </label>
                <label className="field field-span-2">
                  <span>Números específicos (opcional)</span>
                  <input
                    placeholder="Ej: 12, 34, 99 (deja vacío para asignar automáticamente)"
                    value={manualForm.specificNumbers}
                    onChange={(event) => updateManualField('specificNumbers', event.target.value)}
                  />
                </label>
                <label className="field field-span-2">
                  <span>Comprobante del cliente (opcional)</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    onChange={(event) => setManualProof(event.target.files?.[0] ?? null)}
                  />
                  {manualProof ? <small className="muted">{manualProof.name}</small> : null}
                </label>
              </div>

              {manualError ? <p className="alert alert-error">{manualError}</p> : null}

              <div className="panel-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setIsManualOpen(false)}
                  disabled={manualStatus === REQUEST_STATUS.loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={manualStatus === REQUEST_STATUS.loading}
                >
                  {manualStatus === REQUEST_STATUS.loading
                    ? 'Registrando…'
                    : 'Registrar compra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};
