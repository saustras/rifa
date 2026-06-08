import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';

import { AdminShell } from './components/AdminShell';
import {
  clearStoredSession,
  fetchCustomers,
  fetchOrders,
  fetchRaffles,
  getStoredSession,
  loginAdmin,
  toAdminCredentials,
} from './api';
import { CampaignFormPage } from './pages/CampaignFormPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { DashboardPage } from './pages/DashboardPage';
import { NumbersPage } from './pages/NumbersPage';
import { OrdersPage } from './pages/OrdersPage';
import { ParticipantsPage } from './pages/ParticipantsPage';
import { SettingsPage } from './pages/SettingsPage';
import {
  REQUEST_STATUS,
  type AdminCustomer,
  type AdminRaffle,
  type AdminSession,
  type AdminView,
  type OrderListRow,
  type RequestStatus,
} from './types';
import { getMetrics } from './utils';
import './styles.css';

function App() {
  const [session, setSession] = useState<AdminSession | null>(getStoredSession);
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginStatus, setLoginStatus] = useState<RequestStatus>(REQUEST_STATUS.idle);
  const [loginMessage, setLoginMessage] = useState('');
  const [currentView, setCurrentView] = useState<AdminView>('dashboard');
  const [editingRaffleId, setEditingRaffleId] = useState<string | null>(null);
  const [orders, setOrders] = useState<readonly OrderListRow[]>([]);
  const [raffles, setRaffles] = useState<readonly AdminRaffle[]>([]);
  const [customers, setCustomers] = useState<readonly AdminCustomer[]>([]);
  const [ordersStatus, setOrdersStatus] = useState<RequestStatus>(REQUEST_STATUS.loading);
  const [rafflesStatus, setRafflesStatus] = useState<RequestStatus>(REQUEST_STATUS.loading);
  const [message, setMessage] = useState<string>('');

  const loadData = useCallback(async (): Promise<void> => {
    if (!session) {
      setOrdersStatus(REQUEST_STATUS.idle);
      setRafflesStatus(REQUEST_STATUS.idle);
      return;
    }

    const credentials = toAdminCredentials(session);

    setOrdersStatus(REQUEST_STATUS.loading);
    setRafflesStatus(REQUEST_STATUS.loading);
    setMessage('');

    try {
      const [nextOrders, nextRaffles, nextCustomers] = await Promise.all([
        fetchOrders(credentials),
        fetchRaffles(credentials),
        fetchCustomers(credentials),
      ]);

      setOrders(nextOrders);
      setRaffles(nextRaffles);
      setCustomers(nextCustomers);
      setOrdersStatus(REQUEST_STATUS.success);
      setRafflesStatus(REQUEST_STATUS.success);
    } catch (error: unknown) {
      setOrdersStatus(REQUEST_STATUS.error);
      setRafflesStatus(REQUEST_STATUS.error);
      setMessage(error instanceof Error ? error.message : 'No se pudieron cargar los datos.');
    }
  }, [session]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    setLoginStatus(REQUEST_STATUS.loading);
    setLoginMessage('');

    try {
      const nextSession = await loginAdmin({ username: loginUsername, password: loginPassword });
      setSession(nextSession);
      setLoginPassword('');
      setLoginStatus(REQUEST_STATUS.success);
    } catch (error: unknown) {
      setLoginStatus(REQUEST_STATUS.error);
      setLoginMessage(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    }
  };

  const handleLogout = () => {
    clearStoredSession();
    setSession(null);
    setOrders([]);
    setRaffles([]);
    setCustomers([]);
    setCurrentView('dashboard');
  };

  const handleCampaignFormDone = () => {
    setEditingRaffleId(null);
    setCurrentView('campaigns');
    void loadData();
  };

  const pendingCount = getMetrics(orders).pending;
  const activeCampaign = raffles.find((raffle) => raffle.status === 'active') ?? null;
  const activeRaffleSlug = activeCampaign?.slug ?? raffles[0]?.slug;

  const renderPage = () => {
    if (!session) {
      return null;
    }

    const credentials = toAdminCredentials(session);

    if (currentView === 'campaign-form') {
      return (
        <CampaignFormPage
          credentials={credentials}
          raffleId={editingRaffleId}
          activeCampaignId={activeCampaign?.id ?? null}
          onDone={handleCampaignFormDone}
          onCancel={() => {
            setEditingRaffleId(null);
            setCurrentView('campaigns');
          }}
        />
      );
    }

    switch (currentView) {
      case 'dashboard':
        return (
          <DashboardPage
            orders={orders}
            raffles={raffles}
            onGoOrders={() => setCurrentView('orders')}
            onGoCampaigns={() => setCurrentView('campaigns')}
          />
        );
      case 'campaigns':
        return rafflesStatus === REQUEST_STATUS.loading ? (
          <p className="muted" role="status">
            Cargando campañas…
          </p>
        ) : (
          <CampaignsPage
            credentials={credentials}
            orders={orders}
            raffles={raffles}
            activeCampaignId={activeCampaign?.id ?? null}
            onRefresh={() => void loadData()}
            onCreate={() => {
              setEditingRaffleId(null);
              setCurrentView('campaign-form');
            }}
            onEdit={(raffleId) => {
              setEditingRaffleId(raffleId);
              setCurrentView('campaign-form');
            }}
          />
        );
      case 'orders':
        return (
          <OrdersPage
            credentials={credentials}
            orders={orders}
            ordersStatus={ordersStatus}
            onRefresh={() => void loadData()}
            message={message}
            setMessage={setMessage}
          />
        );
      case 'participants':
        return <ParticipantsPage customers={customers} />;
      case 'numbers':
        return <NumbersPage credentials={credentials} raffles={raffles} />;
      case 'settings':
        return <SettingsPage session={session} onLogout={handleLogout} />;
      default:
        return null;
    }
  };

  if (!session) {
    return (
      <main className="login-page">
        <section className="login-card" aria-labelledby="login-title">
          <div className="login-brand" aria-hidden="true">
            <span className="sidebar-brand-mark">
              <svg viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="18" stroke="#F4B21B" strokeWidth="3" />
                <circle cx="20" cy="20" r="6" fill="#F4B21B" />
              </svg>
            </span>
          </div>
          <h1 id="login-title">Admin ORYUM</h1>
          <p className="muted">Ingresa con tu usuario administrador para gestionar la rifa.</p>

          {loginMessage ? (
            <p className="alert" role="alert">
              {loginMessage}
            </p>
          ) : null}

          <form className="login-form" onSubmit={(event) => void handleLoginSubmit(event)}>
            <label className="field">
              <span>Usuario</span>
              <input
                autoComplete="username"
                value={loginUsername}
                onChange={(event) => setLoginUsername(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Contraseña</span>
              <input
                autoComplete="current-password"
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                required
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={loginStatus === 'loading'}>
              {loginStatus === 'loading' ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <AdminShell
      currentView={currentView}
      pendingCount={pendingCount}
      activeRaffleSlug={activeRaffleSlug}
      adminUsername={session.user.username}
      onNavigate={(view) => {
        if (view !== 'campaign-form') {
          setEditingRaffleId(null);
        }
        setCurrentView(view);
      }}
      onRefresh={() => void loadData()}
      onLogout={handleLogout}
    >
      {message && currentView !== 'orders' ? (
        <p className="alert" role="status">
          {message}
        </p>
      ) : null}
      {renderPage()}
    </AdminShell>
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element was not found.');
}

createRoot(rootElement).render(<App />);
