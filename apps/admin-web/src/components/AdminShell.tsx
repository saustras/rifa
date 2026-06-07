import type { ReactNode } from 'react';

import { PUBLIC_WEB_URL } from '../config';
import type { AdminView } from '../types';

const NAV_ITEMS: ReadonlyArray<{ id: AdminView; label: string; icon: string }> = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦' },
  { id: 'campaigns', label: 'Campañas', icon: '◫' },
  { id: 'orders', label: 'Órdenes', icon: '◈' },
  { id: 'participants', label: 'Participantes', icon: '◎' },
  { id: 'numbers', label: 'Números', icon: '#' },
  { id: 'audit', label: 'Auditoría', icon: '◇' },
  { id: 'settings', label: 'Configuración', icon: '⚙' },
];

interface AdminShellProps {
  readonly currentView: AdminView;
  readonly pendingCount: number;
  readonly activeRaffleSlug?: string | undefined;
  readonly onNavigate: (view: AdminView) => void;
  readonly onRefresh: () => void;
  readonly children: ReactNode;
}

export const AdminShell = ({
  currentView,
  pendingCount,
  activeRaffleSlug,
  onNavigate,
  onRefresh,
  children,
}: AdminShellProps) => {
  const shellView = currentView === 'campaign-form' ? 'campaigns' : currentView;

  const pageTitle: Record<Exclude<AdminView, 'campaign-form'>, string> = {
    dashboard: 'Panel del vendedor',
    campaigns: 'Campañas',
    orders: 'Órdenes y pagos',
    participants: 'Participantes',
    numbers: 'Números',
    audit: 'Auditoría y notificaciones',
    settings: 'Configuración',
  };

  const pageSubtitle: Record<Exclude<AdminView, 'campaign-form'>, string> = {
    dashboard: 'Controla tus campañas, ventas y participantes en tiempo real.',
    campaigns: 'Gestiona tus rifas activas y borradores.',
    orders: 'Revisa comprobantes, aprueba o rechaza compras.',
    participants: 'Clientes que compraron participaciones en tus campañas.',
    numbers: 'Estado del inventario de números por campaña.',
    audit: 'Historial de acciones y envíos de correo o Telegram.',
    settings: 'Credenciales de acceso y estado del sistema.',
  };

  const landingHref = activeRaffleSlug
    ? `${PUBLIC_WEB_URL}/?slug=${activeRaffleSlug}`
    : PUBLIC_WEB_URL;

  return (
    <div className="admin-app">
      <aside className="admin-sidebar" aria-label="Navegación principal">
        <a className="sidebar-brand" href="#">
          <span className="sidebar-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="18" stroke="#F4B21B" strokeWidth="3" />
              <circle cx="20" cy="20" r="6" fill="#F4B21B" />
            </svg>
          </span>
          <span>
            <strong>ORYUM</strong>
            <small>Campaigns</small>
          </span>
        </a>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-link${shellView === item.id ? ' is-active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="sidebar-link-icon" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
              {item.id === 'orders' && pendingCount > 0 ? (
                <span className="sidebar-badge">{pendingCount}</span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-help">
          <strong>¿Necesitas ayuda?</strong>
          <p>Contacta soporte si tienes dudas sobre pagos o campañas.</p>
          <a className="btn btn-sidebar" href="mailto:hola@oryumcampaigns.com">
            Contactar soporte
          </a>
        </div>

        <div className="sidebar-user">
          <span className="sidebar-user-avatar" aria-hidden="true">
            O
          </span>
          <div>
            <strong>ORYUM S.A.S.</strong>
            <small>Vendedor verificado</small>
          </div>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1>
              {currentView === 'campaign-form'
                ? 'Formulario de campaña'
                : pageTitle[shellView as Exclude<AdminView, 'campaign-form'>]}
            </h1>
            <p>
              {currentView === 'campaign-form'
                ? 'Completa los datos y guarda para publicar tu rifa.'
                : pageSubtitle[shellView as Exclude<AdminView, 'campaign-form'>]}
            </p>
          </div>
          <div className="topbar-actions">
            <a className="btn btn-ghost" href={landingHref} target="_blank" rel="noreferrer">
              Ver landing
            </a>
            <button type="button" className="btn btn-ghost" onClick={onRefresh}>
              Actualizar
            </button>
          </div>
        </header>

        <main className="admin-content" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
};
