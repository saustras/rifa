import { useMemo, useState } from 'react';

import type { AdminCustomer } from '../types';
import { formatDate } from '../utils';

interface ParticipantsPageProps {
  readonly customers: readonly AdminCustomer[];
}

export const ParticipantsPage = ({ customers }: ParticipantsPageProps) => {
  const [search, setSearch] = useState('');

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
                <tr key={customer.id}>
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
    </section>
  );
};
