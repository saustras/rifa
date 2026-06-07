import { ORDER_STATUS, type OrderListRow, type OrderStatus, type OrdersMetrics } from './types';

export const formatMoney = (value: string | number, currency = 'COP'): string =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));

export const formatDate = (value: string | null): string => {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

export const toStatusLabel = (status: Exclude<OrderStatus, 'all'>): string => {
  const labels: Record<Exclude<OrderStatus, 'all'>, string> = {
    pending_review: 'Pendiente',
    paid: 'Pagado',
    rejected: 'Rechazada',
    cancelled: 'Cancelada',
    expired: 'Expirada',
  };

  return labels[status];
};

export const getMetrics = (orders: readonly OrderListRow[]): OrdersMetrics => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const paidOrders = orders.filter((order) => order.status === ORDER_STATUS.paid);
  const todayPaid = paidOrders.filter((order) => new Date(order.createdAt) >= today);

  return {
    total: orders.length,
    pending: orders.filter((order) => order.status === ORDER_STATUS.pendingReview).length,
    paid: paidOrders.length,
    revenue: paidOrders.reduce((total, order) => total + Number(order.amount), 0),
    participationsSold: paidOrders.reduce((total, order) => total + order.numbersRequested, 0),
    todayRevenue: todayPaid.reduce((total, order) => total + Number(order.amount), 0),
  };
};

export const getRaffleProgress = (
  orders: readonly OrderListRow[],
  raffleId: string,
  numberMax: number,
  numberMin: number,
): { sold: number; total: number; percentage: number } => {
  const total = numberMax - numberMin + 1;
  const sold = orders
    .filter((order) => order.raffleId === raffleId && order.status === ORDER_STATUS.paid)
    .reduce((sum, order) => sum + order.numbersRequested, 0);

  return {
    sold,
    total,
    percentage: total > 0 ? Math.round((sold / total) * 100) : 0,
  };
};
