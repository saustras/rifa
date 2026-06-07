import type {
  AdminAuditLog,
  AdminCredentials,
  AdminCustomer,
  AdminNotificationLog,
  AdminPrize,
  AdminRaffle,
  AdminRaffleNumber,
  CreateRaffleInput,
  DrawResult,
  OrderDetail,
  OrderListRow,
  UpdateRaffleInput,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export const DEFAULT_CREDENTIALS: AdminCredentials = {
  apiKey: 'dev-local-token',
  sellerId: 'seller_demo',
};

export const getStoredCredentials = (): AdminCredentials => {
  const apiKey = window.localStorage.getItem('rifa-admin-api-key') ?? DEFAULT_CREDENTIALS.apiKey;
  const sellerId =
    window.localStorage.getItem('rifa-admin-seller-id') ?? DEFAULT_CREDENTIALS.sellerId;

  return { apiKey, sellerId };
};

export const persistCredentials = ({ apiKey, sellerId }: AdminCredentials): void => {
  window.localStorage.setItem('rifa-admin-api-key', apiKey);
  window.localStorage.setItem('rifa-admin-seller-id', sellerId);
};

const requestAdminJson = async <T>(
  path: string,
  credentials: AdminCredentials,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-api-key': credentials.apiKey,
      'x-seller-id': credentials.sellerId,
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as unknown;

  if (!response.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : 'No se pudo completar la solicitud.';
    throw new Error(message);
  }

  return body as T;
};

export const requestAdminBlob = async (
  path: string,
  credentials: AdminCredentials,
): Promise<Blob> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'x-api-key': credentials.apiKey,
      'x-seller-id': credentials.sellerId,
    },
  });

  if (!response.ok) {
    throw new Error('No se pudo cargar el comprobante protegido.');
  }

  return response.blob();
};

export const fetchDbHealth = async (): Promise<{
  readonly ok: boolean;
  readonly sellersCount?: number;
  readonly error?: string;
}> => {
  const response = await fetch(`${API_BASE_URL}/api/health/db`);
  return (await response.json()) as {
    ok: boolean;
    sellersCount?: number;
    error?: string;
  };
};

export const fetchOrders = async (
  credentials: AdminCredentials,
): Promise<readonly OrderListRow[]> => {
  const response = await requestAdminJson<{ readonly data: readonly OrderListRow[] }>(
    '/api/admin/orders',
    credentials,
  );
  return response.data;
};

export const fetchOrderDetail = async (
  credentials: AdminCredentials,
  orderId: string,
): Promise<OrderDetail> => {
  const response = await requestAdminJson<{ readonly data: OrderDetail }>(
    `/api/admin/orders/${orderId}`,
    credentials,
  );
  return response.data;
};

export const approveOrder = async (
  credentials: AdminCredentials,
  orderId: string,
): Promise<OrderDetail> => {
  const response = await requestAdminJson<{ readonly data: OrderDetail }>(
    `/api/admin/orders/${orderId}/approve`,
    credentials,
    { method: 'POST', body: JSON.stringify({}) },
  );
  return response.data;
};

export const rejectOrder = async (
  credentials: AdminCredentials,
  orderId: string,
  reason: string,
): Promise<OrderDetail> => {
  const response = await requestAdminJson<{ readonly data: OrderDetail }>(
    `/api/admin/orders/${orderId}/reject`,
    credentials,
    { method: 'POST', body: JSON.stringify({ reason }) },
  );
  return response.data;
};

export const fetchRaffles = async (
  credentials: AdminCredentials,
): Promise<readonly AdminRaffle[]> => {
  const response = await requestAdminJson<{ readonly data: readonly AdminRaffle[] }>(
    '/api/admin/raffles',
    credentials,
  );
  return response.data;
};

export const fetchRaffleById = async (
  credentials: AdminCredentials,
  raffleId: string,
): Promise<AdminRaffle> => {
  const response = await requestAdminJson<{ readonly data: AdminRaffle }>(
    `/api/admin/raffles/${raffleId}`,
    credentials,
  );
  return response.data;
};

export const createRaffle = async (
  credentials: AdminCredentials,
  payload: CreateRaffleInput,
): Promise<AdminRaffle> => {
  const response = await requestAdminJson<{ readonly data: AdminRaffle }>(
    '/api/admin/raffles',
    credentials,
    { method: 'POST', body: JSON.stringify(payload) },
  );
  return response.data;
};

export const updateRaffle = async (
  credentials: AdminCredentials,
  raffleId: string,
  payload: UpdateRaffleInput,
): Promise<AdminRaffle> => {
  const response = await requestAdminJson<{ readonly data: AdminRaffle }>(
    `/api/admin/raffles/${raffleId}`,
    credentials,
    { method: 'PATCH', body: JSON.stringify(payload) },
  );
  return response.data;
};

export const fetchActiveRaffle = async (
  credentials: AdminCredentials,
): Promise<AdminRaffle | null> => {
  const response = await requestAdminJson<{ readonly data: AdminRaffle | null }>(
    '/api/admin/raffles/active',
    credentials,
  );
  return response.data;
};

export const activateRaffle = async (
  credentials: AdminCredentials,
  raffleId: string,
): Promise<AdminRaffle> => {
  const response = await requestAdminJson<{ readonly data: AdminRaffle }>(
    `/api/admin/raffles/${raffleId}/activate`,
    credentials,
    { method: 'POST', body: JSON.stringify({}) },
  );
  return response.data;
};

export const uploadRaffleCover = async (
  credentials: AdminCredentials,
  raffleId: string,
  file: File,
): Promise<string> => {
  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });

  const mimeType = file.type;
  if (mimeType !== 'image/jpeg' && mimeType !== 'image/png' && mimeType !== 'image/webp') {
    throw new Error('Formato no soportado. Usa JPG, PNG o WebP.');
  }

  const response = await requestAdminJson<{ readonly data: { readonly coverImageUrl: string } }>(
    `/api/admin/raffles/${raffleId}/cover`,
    credentials,
    {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        mimeType,
        dataBase64,
      }),
    },
  );

  return response.data.coverImageUrl;
};

export const uploadRafflePaymentQr = async (
  credentials: AdminCredentials,
  raffleId: string,
  file: File,
): Promise<string> => {
  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });

  const mimeType = file.type;
  if (mimeType !== 'image/jpeg' && mimeType !== 'image/png' && mimeType !== 'image/webp') {
    throw new Error('Formato no soportado. Usa JPG, PNG o WebP.');
  }

  const response = await requestAdminJson<{
    readonly data: { readonly paymentQrImageUrl: string };
  }>(`/api/admin/raffles/${raffleId}/payment-qr`, credentials, {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      mimeType,
      dataBase64,
    }),
  });

  return response.data.paymentQrImageUrl;
};

export const fetchCustomers = async (
  credentials: AdminCredentials,
): Promise<readonly AdminCustomer[]> => {
  const response = await requestAdminJson<{ readonly data: readonly AdminCustomer[] }>(
    '/api/admin/customers',
    credentials,
  );
  return response.data;
};

export const fetchRaffleNumbers = async (
  credentials: AdminCredentials,
  raffleId: string,
): Promise<readonly AdminRaffleNumber[]> => {
  const response = await requestAdminJson<{ readonly data: readonly AdminRaffleNumber[] }>(
    `/api/admin/raffles/${raffleId}/numbers`,
    credentials,
  );
  return response.data;
};

export const fetchAuditLogs = async (
  credentials: AdminCredentials,
): Promise<readonly AdminAuditLog[]> => {
  const response = await requestAdminJson<{ readonly data: readonly AdminAuditLog[] }>(
    '/api/admin/audit-logs',
    credentials,
  );
  return response.data;
};

export const fetchNotifications = async (
  credentials: AdminCredentials,
): Promise<readonly AdminNotificationLog[]> => {
  const response = await requestAdminJson<{ readonly data: readonly AdminNotificationLog[] }>(
    '/api/admin/notifications',
    credentials,
  );
  return response.data;
};

export const downloadRaffleExportCsv = async (
  credentials: AdminCredentials,
  raffleId: string,
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/admin/raffles/${raffleId}/export`, {
    headers: {
      'x-api-key': credentials.apiKey,
      'x-seller-id': credentials.sellerId,
    },
  });

  if (!response.ok) {
    throw new Error('No se pudo exportar las órdenes.');
  }

  const csv = await response.text();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ordenes-${raffleId}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

export const fetchDrawResult = async (
  credentials: AdminCredentials,
  raffleId: string,
): Promise<DrawResult | null> => {
  const response = await fetch(`${API_BASE_URL}/api/admin/raffles/${raffleId}/draw-result`, {
    headers: {
      'x-api-key': credentials.apiKey,
      'x-seller-id': credentials.sellerId,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('No se pudo cargar el resultado del sorteo.');
  }

  const body = (await response.json()) as { data: DrawResult };
  return body.data;
};

export const registerDrawResult = async (
  credentials: AdminCredentials,
  raffleId: string,
  payload: { winningNumber: number; externalSource: string; notes?: string },
): Promise<DrawResult> => {
  const response = await requestAdminJson<{ readonly data: DrawResult }>(
    `/api/admin/raffles/${raffleId}/draw-result`,
    credentials,
    { method: 'POST', body: JSON.stringify(payload) },
  );
  return response.data;
};

export const fetchPrizes = async (
  credentials: AdminCredentials,
  raffleId: string,
): Promise<readonly AdminPrize[]> => {
  const response = await requestAdminJson<{ readonly data: readonly AdminPrize[] }>(
    `/api/admin/raffles/${raffleId}/prizes`,
    credentials,
  );
  return response.data;
};

export const createPrize = async (
  credentials: AdminCredentials,
  raffleId: string,
  payload: { title: string; description?: string; commercialValue?: number },
): Promise<AdminPrize> => {
  const response = await requestAdminJson<{ readonly data: AdminPrize }>(
    `/api/admin/raffles/${raffleId}/prizes`,
    credentials,
    { method: 'POST', body: JSON.stringify(payload) },
  );
  return response.data;
};

export const deletePrize = async (
  credentials: AdminCredentials,
  prizeId: string,
): Promise<void> => {
  await requestAdminJson(`/api/admin/prizes/${prizeId}`, credentials, { method: 'DELETE' });
};

export const blockNumber = async (
  credentials: AdminCredentials,
  raffleNumberId: string,
): Promise<boolean> => {
  const response = await requestAdminJson<{ readonly data: { readonly ok: boolean } }>(
    `/api/admin/numbers/${raffleNumberId}/block`,
    credentials,
    { method: 'POST', body: JSON.stringify({}) },
  );
  return response.data.ok;
};

export const releaseNumber = async (
  credentials: AdminCredentials,
  raffleNumberId: string,
): Promise<boolean> => {
  const response = await requestAdminJson<{ readonly data: { readonly ok: boolean } }>(
    `/api/admin/numbers/${raffleNumberId}/release`,
    credentials,
    { method: 'POST', body: JSON.stringify({}) },
  );
  return response.data.ok;
};
