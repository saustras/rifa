import { useEffect, useMemo, useState } from 'react';

import { blockNumberByValue, fetchRaffleNumbers, registerDrawResult, releaseNumber } from '../api';
import { REQUEST_STATUS, type AdminCredentials, type AdminRaffle, type AdminRaffleNumber, type RequestStatus } from '../types';

interface NumbersPageProps {
  readonly credentials: AdminCredentials;
  readonly raffles: readonly AdminRaffle[];
}

const STATUS_LABELS: Record<string, string> = {
  available: 'Disponible',
  reserved: 'Reservado',
  assigned: 'Asignado',
  blocked: 'Bloqueado',
  winner: 'Ganador',
  cancelled: 'Cancelado',
};

const formatDate = (iso: string | null): string => {
  if (!iso) {
    return '—';
  }

  try {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const formatMoney = (amount: string | null, currency: string | null): string => {
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

export const NumbersPage = ({ credentials, raffles }: NumbersPageProps) => {
  const [selectedRaffleId, setSelectedRaffleId] = useState(raffles[0]?.id ?? '');
  const [numbers, setNumbers] = useState<readonly AdminRaffleNumber[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalNumber, setModalNumber] = useState<AdminRaffleNumber | null>(null);
  const [blockValue, setBlockValue] = useState('');
  const [message, setMessage] = useState('');
  const [winnerSource, setWinnerSource] = useState('Resultado manual');
  const [winnerNotes, setWinnerNotes] = useState('');
  const [winnerRegisterStatus, setWinnerRegisterStatus] = useState<RequestStatus>(REQUEST_STATUS.idle);

  const selectedRaffle = raffles.find((raffle) => raffle.id === selectedRaffleId) ?? null;

  const loadNumbers = async (raffleId: string) => {
    setIsLoading(true);
    setError('');

    try {
      const data = await fetchRaffleNumbers(credentials, raffleId);
      setNumbers(data);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar números.');
      setNumbers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedRaffleId && raffles[0]) {
      setSelectedRaffleId(raffles[0].id);
    }
  }, [raffles, selectedRaffleId]);

  useEffect(() => {
    if (!selectedRaffleId) {
      setNumbers([]);
      return;
    }

    void loadNumbers(selectedRaffleId);
  }, [credentials, selectedRaffleId]);

  useEffect(() => {
    setWinnerSource(selectedRaffle?.drawSourceName?.trim() || 'Resultado manual');
    setWinnerNotes('');
    setWinnerRegisterStatus(REQUEST_STATUS.idle);
  }, [modalNumber?.id, selectedRaffle?.drawSourceName]);

  const summary = useMemo(() => {
    // With lazy allocation, only taken numbers exist as rows. The total comes
    // from the raffle range and "available" is computed (range - taken).
    const total = selectedRaffle
      ? Math.max(0, selectedRaffle.numberMax - selectedRaffle.numberMin + 1)
      : 0;
    const reserved = numbers.filter((item) => item.status === 'reserved').length;
    const assigned = numbers.filter((item) => item.status === 'assigned').length;
    const blocked = numbers.filter((item) => item.status === 'blocked').length;
    const taken = numbers.length;
    const available = Math.max(0, total - taken);

    return { total, available, reserved, assigned, blocked };
  }, [numbers, selectedRaffle]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return numbers.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesSearch =
        !query || item.displayNumber.includes(query) || String(item.number).includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [numbers, search, statusFilter]);

  const handleBlockByValue = async () => {
    setError('');
    setMessage('');

    const value = Number(blockValue.trim());

    if (!selectedRaffle || !Number.isInteger(value)) {
      setError('Escribe un número válido para bloquear.');
      return;
    }

    if (value < selectedRaffle.numberMin || value > selectedRaffle.numberMax) {
      setError(
        `El número debe estar entre ${selectedRaffle.numberMin} y ${selectedRaffle.numberMax}.`,
      );
      return;
    }

    const ok = await blockNumberByValue(credentials, selectedRaffleId, value);

    if (!ok) {
      setError('No se pudo bloquear: el número ya está tomado o fuera de rango.');
      return;
    }

    setBlockValue('');
    setMessage(`Número ${value} bloqueado.`);
    await loadNumbers(selectedRaffleId);
  };

  const handleRelease = async () => {
    if (!modalNumber) {
      return;
    }

    const ok = await releaseNumber(credentials, modalNumber.id);

    if (!ok) {
      setError('No se pudo liberar el número.');
      return;
    }

    await loadNumbers(selectedRaffleId);
    setModalNumber(null);
    setError('');
  };

  const handleRegisterWinner = async () => {
    if (!modalNumber || !selectedRaffle) {
      return;
    }

    if (winnerSource.trim().length < 2) {
      setError('Escribe la fuente del resultado antes de registrar el ganador.');
      return;
    }

    setError('');
    setMessage('');
    setWinnerRegisterStatus(REQUEST_STATUS.loading);

    try {
      await registerDrawResult(credentials, selectedRaffle.id, {
        winningNumber: modalNumber.number,
        externalSource: winnerSource.trim(),
        ...(winnerNotes.trim() ? { notes: winnerNotes.trim() } : {}),
      });
      setMessage(`Número ${modalNumber.displayNumber} registrado como ganador.`);
      setWinnerNotes('');
      setWinnerRegisterStatus(REQUEST_STATUS.success);
      await loadNumbers(selectedRaffle.id);
      setModalNumber(null);
    } catch (registerError: unknown) {
      setWinnerRegisterStatus(REQUEST_STATUS.error);
      setError(
        registerError instanceof Error
          ? registerError.message
          : 'No se pudo registrar el ganador. Revisa si esa campaña ya tiene resultado.',
      );
    }
  };

  const hasBuyerInfo = modalNumber && (
    modalNumber.status === 'reserved' ||
    modalNumber.status === 'assigned' ||
    modalNumber.status === 'winner'
  ) && modalNumber.customerName;

  if (raffles.length === 0) {
    return (
      <article className="panel panel-empty">
        <h2>Sin campañas</h2>
        <p className="muted">Crea una campaña para ver el inventario de números.</p>
      </article>
    );
  }

  return (
    <section className="numbers-layout">
      <article className="panel">
        <header className="panel-head panel-head-row">
          <div>
            <h2>Números de campaña</h2>
            <p className="muted">Inventario y estado de cada participación.</p>
          </div>
          <div className="toolbar toolbar-compact">
            <label className="field">
              <span>Campaña</span>
              <select
                value={selectedRaffleId}
                onChange={(event) => setSelectedRaffleId(event.target.value)}
              >
                {raffles.map((raffle) => (
                  <option key={raffle.id} value={raffle.id}>
                    {raffle.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Estado</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">Todos</option>
                <option value="available">Disponibles</option>
                <option value="reserved">Reservados</option>
                <option value="assigned">Asignados</option>
                <option value="blocked">Bloqueados</option>
              </select>
            </label>
            <label className="field field-grow">
              <span>Buscar</span>
              <input
                placeholder="Número"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Bloquear número</span>
              <div className="block-number-row">
                <input
                  type="number"
                  placeholder="Ej: 1234"
                  value={blockValue}
                  onChange={(event) => setBlockValue(event.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => void handleBlockByValue()}
                >
                  Bloquear
                </button>
              </div>
            </label>
          </div>
        </header>

        {message ? (
          <p className="alert alert-success" role="status">
            {message}
          </p>
        ) : null}

        <div className="kpi-grid kpi-grid-compact">
          <div className="kpi-mini">
            <small>Total</small>
            <strong>{summary.total}</strong>
          </div>
          <div className="kpi-mini">
            <small>Disponibles</small>
            <strong>{summary.available}</strong>
          </div>
          <div className="kpi-mini">
            <small>Reservados</small>
            <strong>{summary.reserved}</strong>
          </div>
          <div className="kpi-mini">
            <small>Asignados</small>
            <strong>{summary.assigned}</strong>
          </div>
        </div>

        {isLoading ? (
          <p className="muted" role="status">
            Cargando números…
          </p>
        ) : null}
        {error ? (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        ) : null}

        <p className="muted">
          Se muestran solo los números tomados (vendidos, reservados o bloqueados). Los disponibles
          se asignan al azar cuando alguien compra.
        </p>

        {!isLoading && numbers.length === 0 ? (
          <p className="muted">Todavía no hay números tomados en esta campaña.</p>
        ) : null}

        <div className="numbers-grid">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`number-tile status-${item.status}${modalNumber?.id === item.id ? ' is-selected' : ''}`}
              onClick={() => setModalNumber(item)}
            >
              {item.displayNumber}
              <small>{STATUS_LABELS[item.status] ?? item.status}</small>
            </button>
          ))}
        </div>
      </article>

      {modalNumber ? (
        <>
          <button
            type="button"
            className="modal-backdrop"
            aria-label="Cerrar detalle"
            onClick={() => setModalNumber(null)}
          />
          <dialog className="number-detail-modal" open aria-labelledby="number-modal-title">
            <header className="modal-head">
              <div>
                <p className="modal-eyebrow">Detalle del número</p>
                <h2 id="number-modal-title">
                  {modalNumber.displayNumber}
                </h2>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Cerrar"
                onClick={() => setModalNumber(null)}
              >
                ×
              </button>
            </header>

            <dl className="modal-detail-grid">
              <div>
                <dt>Número</dt>
                <dd>{modalNumber.displayNumber}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>
                  <span className={`status-pill status-${modalNumber.status}`}>
                    {STATUS_LABELS[modalNumber.status] ?? modalNumber.status}
                  </span>
                </dd>
              </div>
            </dl>

            {hasBuyerInfo ? (
              <>
                <h3 className="modal-section-title">Datos del comprador</h3>
                <dl className="modal-detail-grid">
                  <div>
                    <dt>Nombre</dt>
                    <dd>{modalNumber.customerName}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{modalNumber.customerEmail ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Teléfono</dt>
                    <dd>{modalNumber.customerPhone ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Documento</dt>
                    <dd>{modalNumber.customerDocument ?? '—'}</dd>
                  </div>
                  {modalNumber.customerCity ? (
                    <div>
                      <dt>Ciudad</dt>
                      <dd>{modalNumber.customerCity}</dd>
                    </div>
                  ) : null}
                </dl>

                <h3 className="modal-section-title">Datos de la compra</h3>
                <dl className="modal-detail-grid">
                  <div>
                    <dt>Orden</dt>
                    <dd>{modalNumber.orderId ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Monto</dt>
                    <dd>{formatMoney(modalNumber.orderAmount, modalNumber.orderCurrency)}</dd>
                  </div>
                  <div>
                    <dt>Fecha</dt>
                    <dd>{formatDate(modalNumber.orderCreatedAt)}</dd>
                  </div>
                  <div>
                    <dt>Estado de la orden</dt>
                    <dd>{modalNumber.orderStatus ?? '—'}</dd>
                  </div>
                </dl>
              </>
            ) : null}

            <section className="winner-modal-section" aria-labelledby="winner-modal-section-title">
              <div>
                <p className="modal-eyebrow">Resultado de sorteo</p>
                <h3 id="winner-modal-section-title" className="modal-section-title">
                  Registrar este número como ganador
                </h3>
                <p className="muted">
                  Si la orden asociada está pagada, el sistema vincula automáticamente al comprador.
                </p>
              </div>
              <div className="winner-modal-fields">
                <label className="field">
                  <span>Fuente del resultado</span>
                  <input
                    value={winnerSource}
                    placeholder="Ej: Lotería, sorteo en vivo, acta"
                    onChange={(event) => setWinnerSource(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Notas opcionales</span>
                  <textarea
                    value={winnerNotes}
                    placeholder="Detalle interno o evidencia del resultado."
                    onChange={(event) => setWinnerNotes(event.target.value)}
                  />
                </label>
              </div>
            </section>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={winnerRegisterStatus === REQUEST_STATUS.loading || modalNumber.status === 'winner'}
                onClick={() => void handleRegisterWinner()}
              >
                {winnerRegisterStatus === REQUEST_STATUS.loading
                  ? 'Registrando…'
                  : modalNumber.status === 'winner'
                    ? 'Ya es ganador'
                    : 'Registrar ganador'}
              </button>
              {modalNumber.status === 'blocked' || modalNumber.status === 'reserved' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleRelease()}
                >
                  Liberar número
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setModalNumber(null)}
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
