import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';

import { AdminShell } from './components/AdminShell';
import {
  fetchAuditLogs,
  fetchCustomers,
  fetchNotifications,
  fetchOrders,
  fetchRaffles,
  getStoredCredentials,
  persistCredentials,
} from './api';
import { AuditPage } from './pages/AuditPage';
import { CampaignFormPage } from './pages/CampaignFormPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { DashboardPage } from './pages/DashboardPage';
import { NumbersPage } from './pages/NumbersPage';
import { OrdersPage } from './pages/OrdersPage';
import { ParticipantsPage } from './pages/ParticipantsPage';
import { SettingsPage } from './pages/SettingsPage';
import {
  REQUEST_STATUS,
  type AdminAuditLog,
  type AdminCredentials,
  type AdminCustomer,
  type AdminNotificationLog,
  type AdminRaffle,
  type AdminView,
  type OrderListRow,
  type RequestStatus,
} from './types';
import { getMetrics } from './utils';
import './styles.css';

function App() {
  const [currentView, setCurrentView] = useState<AdminView>('dashboard');
  const [editingRaffleId, setEditingRaffleId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<AdminCredentials>(getStoredCredentials);
  const [draftCredentials, setDraftCredentials] = useState<AdminCredentials>(getStoredCredentials);
  const [orders, setOrders] = useState<readonly OrderListRow[]>([]);
  const [raffles, setRaffles] = useState<readonly AdminRaffle[]>([]);
  const [customers, setCustomers] = useState<readonly AdminCustomer[]>([]);
  const [auditLogs, setAuditLogs] = useState<readonly AdminAuditLog[]>([]);
  const [notifications, setNotifications] = useState<readonly AdminNotificationLog[]>([]);
  const [ordersStatus, setOrdersStatus] = useState<RequestStatus>(REQUEST_STATUS.loading);
  const [rafflesStatus, setRafflesStatus] = useState<RequestStatus>(REQUEST_STATUS.loading);
  const [message, setMessage] = useState<string>('');

  const loadData = useCallback(async (): Promise<void> => {
    setOrdersStatus(REQUEST_STATUS.loading);
    setRafflesStatus(REQUEST_STATUS.loading);
    setMessage('');

    try {
      const [nextOrders, nextRaffles, nextCustomers, nextAuditLogs, nextNotifications] =
        await Promise.all([
          fetchOrders(credentials),
          fetchRaffles(credentials),
          fetchCustomers(credentials),
          fetchAuditLogs(credentials),
          fetchNotifications(credentials),
        ]);

      setOrders(nextOrders);
      setRaffles(nextRaffles);
      setCustomers(nextCustomers);
      setAuditLogs(nextAuditLogs);
      setNotifications(nextNotifications);
      setOrdersStatus(REQUEST_STATUS.success);
      setRafflesStatus(REQUEST_STATUS.success);
    } catch (error: unknown) {
      setOrdersStatus(REQUEST_STATUS.error);
      setRafflesStatus(REQUEST_STATUS.error);
      setMessage(error instanceof Error ? error.message : 'No se pudieron cargar los datos.');
    }
  }, [credentials]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCredentialsSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    persistCredentials(draftCredentials);
    setCredentials(draftCredentials);
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
      case 'audit':
        return <AuditPage auditLogs={auditLogs} notifications={notifications} />;
      case 'settings':
        return (
          <SettingsPage
            draftCredentials={draftCredentials}
            onChange={setDraftCredentials}
            onSubmit={handleCredentialsSubmit}
          />
        );
      default:
        return null;
    }
  };

  return (
    <AdminShell
      currentView={currentView}
      pendingCount={pendingCount}
      activeRaffleSlug={activeRaffleSlug}
      onNavigate={(view) => {
        if (view !== 'campaign-form') {
          setEditingRaffleId(null);
        }
        setCurrentView(view);
      }}
      onRefresh={() => void loadData()}
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
