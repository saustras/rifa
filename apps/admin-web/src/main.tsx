import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
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
import { WinnersPage } from './pages/WinnersPage';
import {
  REQUEST_STATUS,
  type AdminCustomer,
  type AdminRaffle,
  type AdminSession,
  type AdminView,
  type OrderListRow,
  type RequestStatus,
} from './types';
import {
  alertNewPurchase,
  ensureNotificationPermission,
  primeNotificationAudio,
} from './notifications';
import { getMetrics } from './utils';
import './styles.css';

interface InitialAdminRoute {
  readonly view: AdminView;
  readonly orderId: string;
}

const getInitialAdminRoute = (): InitialAdminRoute => {
  if (window.location.pathname === '/orders') {
    return {
      view: 'orders',
      orderId: new URLSearchParams(window.location.search).get('orderId') ?? '',
    };
  }

  return {
    view: 'dashboard',
    orderId: '',
  };
};

const INITIAL_ADMIN_ROUTE = getInitialAdminRoute();

const formatSseAmount = (amount: string): string => {
  const parsedAmount = Number(amount);

  if (!Number.isFinite(parsedAmount)) {
    return '0';
  }

  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(parsedAmount);
};

function App() {
  const [session, setSession] = useState<AdminSession | null>(getStoredSession);
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginStatus, setLoginStatus] = useState<RequestStatus>(REQUEST_STATUS.idle);
  const [loginMessage, setLoginMessage] = useState('');
  const [currentView, setCurrentView] = useState<AdminView>(INITIAL_ADMIN_ROUTE.view);
  const [focusedOrderId, setFocusedOrderId] = useState<string>(INITIAL_ADMIN_ROUTE.orderId);
  const [editingRaffleId, setEditingRaffleId] = useState<string | null>(null);
  const [cloneSourceRaffleId, setCloneSourceRaffleId] = useState<string | null>(null);
  const [orders, setOrders] = useState<readonly OrderListRow[]>([]);
  const [raffles, setRaffles] = useState<readonly AdminRaffle[]>([]);
  const [customers, setCustomers] = useState<readonly AdminCustomer[]>([]);
  const [ordersStatus, setOrdersStatus] = useState<RequestStatus>(REQUEST_STATUS.loading);
  const [rafflesStatus, setRafflesStatus] = useState<RequestStatus>(REQUEST_STATUS.loading);
  const [message, setMessage] = useState<string>('');
  const [sseNotification, setSseNotification] = useState<string>('');
  const sseSourceRef = useRef<EventSource | null>(null);
  const purchaseAlertTimerRef = useRef<number | undefined>(undefined);
  const pendingPurchaseAlertRef = useRef<{ readonly toast: string; readonly title: string; readonly body: string } | null>(null);

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

  useEffect(() => {
    if (!session) {
      return;
    }

    primeNotificationAudio();
    void ensureNotificationPermission();
  }, [session]);

  // Keep a stable reference to the latest loadData so SSE handlers can refresh
  // without forcing the connection to be torn down and re-created.
  const loadDataRef = useRef(loadData);
  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  useEffect(() => {
    if (!session) {
      if (sseSourceRef.current) {
        sseSourceRef.current.close();
        sseSourceRef.current = null;
      }
      return;
    }

    const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
    const sseUrl = `${apiBase}/api/admin/events?token=${encodeURIComponent(session.token)}`;

    let isCancelled = false;
    let reconnectTimer: number | undefined;
    let reconnectDelay = 2000;
    const MAX_RECONNECT_DELAY = 30000;

    // Refresh the orders list whenever the server reports a change. A short
    // debounce coalesces bursts (e.g. proof + review in quick succession).
    let refreshTimer: number | undefined;
    const scheduleRefresh = () => {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
      refreshTimer = window.setTimeout(() => {
        void loadDataRef.current();
      }, 400);
    };

    const schedulePurchaseAlert = (
      toastMessage: string,
      notificationTitle: string,
      notificationBody: string,
    ) => {
      pendingPurchaseAlertRef.current = {
        toast: toastMessage,
        title: notificationTitle,
        body: notificationBody,
      };

      if (purchaseAlertTimerRef.current) {
        window.clearTimeout(purchaseAlertTimerRef.current);
      }

      purchaseAlertTimerRef.current = window.setTimeout(() => {
        const alert = pendingPurchaseAlertRef.current;

        if (!alert) {
          return;
        }

        setSseNotification(alert.toast);
        alertNewPurchase(alert.title, alert.body);
        pendingPurchaseAlertRef.current = null;
      }, 700);
    };

    const connect = () => {
      if (isCancelled) {
        return;
      }

      const source = new EventSource(sseUrl);
      sseSourceRef.current = source;

      source.addEventListener('new_order', (event) => {
        try {
          const payload = JSON.parse(event.data) as { readonly amount?: string };
          const amountLabel = formatSseAmount(payload.amount ?? '0');
          schedulePurchaseAlert(
            `Nueva compra por ${amountLabel} COP`,
            'Nueva compra recibida',
            `Hay una compra por ${amountLabel} COP pendiente de revisión.`,
          );
        } catch {
          schedulePurchaseAlert(
            'Nueva compra recibida',
            'Nueva compra recibida',
            'Hay una compra pendiente de revisión.',
          );
        }
        scheduleRefresh();
      });

      source.addEventListener('order_proof', () => {
        schedulePurchaseAlert(
          'Nuevo comprobante recibido',
          'Comprobante de pago recibido',
          'Un cliente subió el comprobante. Revisa la compra para aprobar o rechazar.',
        );
        scheduleRefresh();
      });

      source.addEventListener('order_reviewed', () => {
        scheduleRefresh();
      });

      source.addEventListener('connected', () => {
        // Connection established: reset the backoff.
        reconnectDelay = 2000;
      });

      source.onerror = () => {
        source.close();

        if (sseSourceRef.current === source) {
          sseSourceRef.current = null;
        }

        if (isCancelled) {
          return;
        }

        // Auto-reconnect with capped exponential backoff.
        reconnectTimer = window.setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
          connect();
        }, reconnectDelay);
      };
    };

    connect();

    return () => {
      isCancelled = true;

      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }

      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }

      if (purchaseAlertTimerRef.current) {
        window.clearTimeout(purchaseAlertTimerRef.current);
      }

      if (sseSourceRef.current) {
        sseSourceRef.current.close();
        sseSourceRef.current = null;
      }
    };
  }, [session]);

  useEffect(() => {
    if (!sseNotification) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSseNotification('');
    }, 6000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [sseNotification]);

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    setLoginStatus(REQUEST_STATUS.loading);
    setLoginMessage('');

    try {
      const nextSession = await loginAdmin({ username: loginUsername, password: loginPassword });
      primeNotificationAudio();
      void ensureNotificationPermission();
      setSession(nextSession);
      setLoginPassword('');
      setLoginStatus(REQUEST_STATUS.success);
      if (focusedOrderId) {
        setCurrentView('orders');
      }
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
    setFocusedOrderId('');
  };

  const handleCampaignFormDone = () => {
    setEditingRaffleId(null);
    setCloneSourceRaffleId(null);
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
          cloneFromRaffleId={cloneSourceRaffleId}
          activeCampaignId={activeCampaign?.id ?? null}
          onDone={handleCampaignFormDone}
          onCancel={() => {
            setEditingRaffleId(null);
            setCloneSourceRaffleId(null);
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
              setCloneSourceRaffleId(null);
              setCurrentView('campaign-form');
            }}
            onEdit={(raffleId) => {
              setEditingRaffleId(raffleId);
              setCloneSourceRaffleId(null);
              setCurrentView('campaign-form');
            }}
            onClone={(raffleId) => {
              setEditingRaffleId(null);
              setCloneSourceRaffleId(raffleId);
              setCurrentView('campaign-form');
            }}
          />
        );
      case 'orders':
        return (
          <OrdersPage
            credentials={credentials}
            orders={orders}
            raffles={raffles}
            ordersStatus={ordersStatus}
            focusedOrderId={focusedOrderId}
            onRefresh={() => void loadData()}
            onFocusedOrderHandled={() => setFocusedOrderId('')}
            message={message}
            setMessage={setMessage}
          />
        );
      case 'participants':
        return <ParticipantsPage credentials={credentials} customers={customers} />;
      case 'winners':
        return <WinnersPage credentials={credentials} />;
      case 'numbers':
        return <NumbersPage credentials={credentials} raffles={raffles} />;
      case 'settings':
        return <SettingsPage credentials={credentials} session={session} onLogout={handleLogout} />;
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
      {sseNotification ? (
        <div className="sse-toast" role="status">
          <span>{sseNotification}</span>
          <button
            type="button"
            className="sse-toast-close"
            aria-label="Cerrar notificación"
            onClick={() => {
              setSseNotification('');
            }}
          >
            ×
          </button>
        </div>
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
