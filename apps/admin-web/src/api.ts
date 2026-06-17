import type {
  AdminCredentials,
  AdminCustomer,
  AdminCustomerDetail,
  AdminLoginCredentials,
  AdminPrize,
  AdminRaffle,
  AdminRaffleNumber,
  AdminSession,
  AdminWinner,
  CreateManualOrderInput,
  CreateRaffleInput,
  DeliveryGalleryImage,
  DrawResult,
  OrderDetail,
  OrderListRow,
  SellerSettings,
  UpdateRaffleInput,
} from './types';
import { prepareImageForUpload } from './image';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const ADMIN_SESSION_KEY = 'rifa-admin-session';

export interface AdminValidationDetails {
  readonly formErrors?: readonly string[];
  readonly fieldErrors?: Record<string, readonly string[]>;
}

export class AdminApiError extends Error {
  readonly code?: string;
  readonly details?: AdminValidationDetails;

  constructor(message: string, options?: { readonly code?: string; readonly details?: AdminValidationDetails }) {
    super(message);
    this.name = 'AdminApiError';
    if (options?.code !== undefined) {
      this.code = options.code;
    }
    if (options?.details !== undefined) {
      this.details = options.details;
    }
  }
}

const isAdminSession = (value: unknown): value is AdminSession => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    'token' in value &&
    typeof value.token === 'string' &&
    'expiresAt' in value &&
    typeof value.expiresAt === 'number' &&
    'user' in value &&
    typeof value.user === 'object' &&
    value.user !== null &&
    'username' in value.user &&
    typeof value.user.username === 'string' &&
    'sellerId' in value.user &&
    typeof value.user.sellerId === 'string'
  );
};

export const getStoredSession = (): AdminSession | null => {
  const rawSession = window.localStorage.getItem(ADMIN_SESSION_KEY);

  if (!rawSession) {
    return null;
  }

  let parsedSession: unknown;

  try {
    parsedSession = JSON.parse(rawSession) as unknown;
  } catch {
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
    return null;
  }

  if (!isAdminSession(parsedSession)) {
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
    return null;
  }

  if (parsedSession.expiresAt <= Math.floor(Date.now() / 1000)) {
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
    return null;
  }

  return parsedSession;
};

export const persistSession = (session: AdminSession): void => {
  window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
};

export const clearStoredSession = (): void => {
  window.localStorage.removeItem(ADMIN_SESSION_KEY);
};

export const toAdminCredentials = (session: AdminSession): AdminCredentials => ({
  token: session.token,
  sellerId: session.user.sellerId,
});

const getResponseMessage = (body: unknown): string => {
  if (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof body.message === 'string'
  ) {
    return body.message;
  }

  return 'No se pudo completar la solicitud.';
};

const readValidationDetails = (body: unknown): AdminValidationDetails | undefined => {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('details' in body) ||
    typeof body.details !== 'object' ||
    body.details === null
  ) {
    return undefined;
  }

  const details = body.details as Record<string, unknown>;
  const fieldErrors: Record<string, readonly string[]> = {};

  if (typeof details.fieldErrors === 'object' && details.fieldErrors !== null) {
    for (const [fieldName, messages] of Object.entries(
      details.fieldErrors as Record<string, unknown>,
    )) {
      if (Array.isArray(messages) && messages.every((message) => typeof message === 'string')) {
        fieldErrors[fieldName] = messages;
      }
    }
  }

  const formErrors =
    Array.isArray(details.formErrors) &&
    details.formErrors.every((message) => typeof message === 'string')
      ? details.formErrors
      : undefined;

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  if (!hasFieldErrors && !formErrors) {
    return undefined;
  }

  return {
    ...(hasFieldErrors ? { fieldErrors } : {}),
    ...(formErrors ? { formErrors } : {}),
  };
};

const readErrorCode = (body: unknown): string | undefined => {
  if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
    return body.error;
  }

  return undefined;
};

export const loginAdmin = async (credentials: AdminLoginCredentials): Promise<AdminSession> => {
  const response = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const body = (await response.json().catch(() => ({}))) as unknown;

  if (!response.ok) {
    const code = readErrorCode(body);
    const details = readValidationDetails(body);
    throw new AdminApiError(getResponseMessage(body), {
      ...(code ? { code } : {}),
      ...(details ? { details } : {}),
    });
  }

  if (!isAdminSession(body)) {
    throw new Error('Respuesta de login inválida.');
  }

  persistSession(body);
  return body;
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
      authorization: `Bearer ${credentials.token}`,
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as unknown;

  if (!response.ok) {
    // Surface validation field errors so the UI can tell the user exactly
    // which field failed, instead of a generic message.
    const code = readErrorCode(body);
    const details = readValidationDetails(body);
    throw new AdminApiError(getResponseMessage(body), {
      ...(code ? { code } : {}),
      ...(details ? { details } : {}),
    });
  }

  return body as T;
};

export const requestAdminBlob = async (
  path: string,
  credentials: AdminCredentials,
): Promise<Blob> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      authorization: `Bearer ${credentials.token}`,
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

export const fetchSellerSettings = async (
  credentials: AdminCredentials,
): Promise<SellerSettings> => {
  const response = await requestAdminJson<{ readonly data: SellerSettings }>(
    '/api/admin/settings',
    credentials,
  );
  return response.data;
};

export const updateSellerSettings = async (
  credentials: AdminCredentials,
  payload: SellerSettings,
): Promise<SellerSettings> => {
  const response = await requestAdminJson<{ readonly data: SellerSettings }>(
    '/api/admin/settings',
    credentials,
    { method: 'PATCH', body: JSON.stringify(payload) },
  );
  return response.data;
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
  const prepared = await prepareImageForUpload(file);

  const response = await requestAdminJson<{ readonly data: { readonly coverImageUrl: string } }>(
    `/api/admin/raffles/${raffleId}/cover`,
    credentials,
    {
      method: 'POST',
      body: JSON.stringify(prepared),
    },
  );

  return response.data.coverImageUrl;
};

export const uploadRafflePaymentQr = async (
  credentials: AdminCredentials,
  raffleId: string,
  file: File,
): Promise<string> => {
  const prepared = await prepareImageForUpload(file);

  const response = await requestAdminJson<{
    readonly data: { readonly paymentQrImageUrl: string };
  }>(`/api/admin/raffles/${raffleId}/payment-qr`, credentials, {
    method: 'POST',
    body: JSON.stringify(prepared),
  });

  return response.data.paymentQrImageUrl;
};

export const uploadDefaultPaymentQr = async (
  credentials: AdminCredentials,
  file: File,
): Promise<string> => {
  const prepared = await prepareImageForUpload(file);

  const response = await requestAdminJson<{
    readonly data: { readonly paymentQrImageUrl: string; readonly settings: SellerSettings };
  }>('/api/admin/settings/payment-qr', credentials, {
    method: 'POST',
    body: JSON.stringify(prepared),
  });

  return response.data.paymentQrImageUrl;
};

export const uploadPaymentMethodQr = async (
  credentials: AdminCredentials,
  file: File,
): Promise<string> => {
  const prepared = await prepareImageForUpload(file);

  const response = await requestAdminJson<{ readonly data: { readonly qrImageUrl: string } }>(
    '/api/admin/settings/payment-method-qr',
    credentials,
    {
      method: 'POST',
      body: JSON.stringify(prepared),
    },
  );

  return response.data.qrImageUrl;
};

export const createManualOrder = async (
  credentials: AdminCredentials,
  payload: CreateManualOrderInput,
): Promise<OrderDetail> => {
  const response = await requestAdminJson<{ readonly data: OrderDetail }>(
    '/api/admin/orders/manual',
    credentials,
    { method: 'POST', body: JSON.stringify(payload) },
  );
  return response.data;
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

export const fetchCustomerDetail = async (
  credentials: AdminCredentials,
  customerId: string,
): Promise<AdminCustomerDetail> => {
  const response = await requestAdminJson<{ readonly data: AdminCustomerDetail }>(
    `/api/admin/customers/${customerId}/detail`,
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

export const downloadRaffleExportCsv = async (
  credentials: AdminCredentials,
  raffleId: string,
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/admin/raffles/${raffleId}/export`, {
    headers: {
      authorization: `Bearer ${credentials.token}`,
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
      authorization: `Bearer ${credentials.token}`,
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

export const fetchWinners = async (
  credentials: AdminCredentials,
): Promise<readonly AdminWinner[]> => {
  const response = await requestAdminJson<{ readonly data: readonly AdminWinner[] }>(
    '/api/admin/winners',
    credentials,
  );
  return response.data;
};

export const updateWinner = async (
  credentials: AdminCredentials,
  winnerId: string,
  payload: {
    readonly isPublicWinner?: boolean;
    readonly winnerComment?: string | null;
    readonly displayOrder?: number;
  },
): Promise<AdminWinner> => {
  const response = await requestAdminJson<{ readonly data: AdminWinner }>(
    `/api/admin/winners/${winnerId}`,
    credentials,
    { method: 'PATCH', body: JSON.stringify(payload) },
  );
  return response.data;
};

export const uploadWinnerPhoto = async (
  credentials: AdminCredentials,
  winnerId: string,
  file: File,
): Promise<AdminWinner> => {
  const prepared = await prepareImageForUpload(file);
  const response = await requestAdminJson<{ readonly data: AdminWinner }>(
    `/api/admin/winners/${winnerId}/photo`,
    credentials,
    { method: 'POST', body: JSON.stringify(prepared) },
  );
  return response.data;
};

export const fetchDeliveryGallery = async (
  credentials: AdminCredentials,
): Promise<readonly DeliveryGalleryImage[]> => {
  const response = await requestAdminJson<{ readonly data: readonly DeliveryGalleryImage[] }>(
    '/api/admin/delivery-gallery',
    credentials,
  );
  return response.data;
};

export const createDeliveryGalleryImage = async (
  credentials: AdminCredentials,
  payload: {
    readonly file: File;
    readonly title?: string;
    readonly caption?: string;
    readonly isPublic?: boolean;
    readonly displayOrder?: number;
  },
): Promise<DeliveryGalleryImage> => {
  const prepared = await prepareImageForUpload(payload.file);
  const response = await requestAdminJson<{ readonly data: DeliveryGalleryImage }>(
    '/api/admin/delivery-gallery',
    credentials,
    {
      method: 'POST',
      body: JSON.stringify({
        title: payload.title,
        caption: payload.caption,
        isPublic: payload.isPublic,
        displayOrder: payload.displayOrder,
        image: prepared,
      }),
    },
  );
  return response.data;
};

export const updateDeliveryGalleryImage = async (
  credentials: AdminCredentials,
  imageId: string,
  payload: {
    readonly title?: string | null;
    readonly caption?: string | null;
    readonly isPublic?: boolean;
    readonly displayOrder?: number;
  },
): Promise<DeliveryGalleryImage> => {
  const response = await requestAdminJson<{ readonly data: DeliveryGalleryImage }>(
    `/api/admin/delivery-gallery/${imageId}`,
    credentials,
    { method: 'PATCH', body: JSON.stringify(payload) },
  );
  return response.data;
};

export const deleteDeliveryGalleryImage = async (
  credentials: AdminCredentials,
  imageId: string,
): Promise<void> => {
  await requestAdminJson(`/api/admin/delivery-gallery/${imageId}`, credentials, { method: 'DELETE' });
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

export const blockNumberByValue = async (
  credentials: AdminCredentials,
  raffleId: string,
  number: number,
): Promise<boolean> => {
  const response = await requestAdminJson<{ readonly data: { readonly ok: boolean } }>(
    '/api/admin/numbers/block',
    credentials,
    { method: 'POST', body: JSON.stringify({ raffleId, number }) },
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
