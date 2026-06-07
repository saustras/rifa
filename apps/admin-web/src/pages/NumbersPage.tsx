import { useEffect, useMemo, useState } from 'react';

import { blockNumber, fetchRaffleNumbers, releaseNumber } from '../api';
import type { AdminCredentials, AdminRaffle, AdminRaffleNumber } from '../types';

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

export const NumbersPage = ({ credentials, raffles }: NumbersPageProps) => {
  const [selectedRaffleId, setSelectedRaffleId] = useState(raffles[0]?.id ?? '');
  const [numbers, setNumbers] = useState<readonly AdminRaffleNumber[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedNumberId, setSelectedNumberId] = useState<string>('');

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

  const summary = useMemo(() => {
    const total = numbers.length;
    const available = numbers.filter((item) => item.status === 'available').length;
    const reserved = numbers.filter((item) => item.status === 'reserved').length;
    const assigned = numbers.filter((item) => item.status === 'assigned').length;
    const blocked = numbers.filter((item) => item.status === 'blocked').length;

    return { total, available, reserved, assigned, blocked };
  }, [numbers]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return numbers.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesSearch =
        !query || item.displayNumber.includes(query) || String(item.number).includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [numbers, search, statusFilter]);

  const selectedNumber = numbers.find((item) => item.id === selectedNumberId);

  const handleBlock = async () => {
    if (!selectedNumberId) {
      return;
    }

    const ok = await blockNumber(credentials, selectedNumberId);

    if (!ok) {
      setError('No se pudo bloquear el número.');
      return;
    }

    await loadNumbers(selectedRaffleId);
    setError('');
  };

  const handleRelease = async () => {
    if (!selectedNumberId) {
      return;
    }

    const ok = await releaseNumber(credentials, selectedNumberId);

    if (!ok) {
      setError('No se pudo liberar el número.');
      return;
    }

    await loadNumbers(selectedRaffleId);
    setError('');
  };

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
          </div>
        </header>

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

        <div className="numbers-grid">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`number-tile status-${item.status}${item.id === selectedNumberId ? ' is-selected' : ''}`}
              onClick={() => setSelectedNumberId(item.id)}
            >
              {item.displayNumber}
              <small>{STATUS_LABELS[item.status] ?? item.status}</small>
            </button>
          ))}
        </div>

        {selectedNumber ? (
          <div className="panel-actions">
            <span className="muted">
              Seleccionado: <strong>{selectedNumber.displayNumber}</strong>
            </span>
            {selectedNumber.status === 'available' ? (
              <button type="button" className="btn btn-ghost" onClick={() => void handleBlock()}>
                Bloquear
              </button>
            ) : null}
            {selectedNumber.status === 'blocked' || selectedNumber.status === 'reserved' ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleRelease()}
              >
                Liberar
              </button>
            ) : null}
          </div>
        ) : null}
      </article>
    </section>
  );
};
