import type { BuyerFormState, CreatedOrder, PublicRaffle, PublicRaffleNumber, PublicWinnersContent } from './types';
import type { SellerSettings } from '@rifa/shared';
import { prepareImageForUpload } from './image';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
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

export const fetchPublicRaffle = async (slug: string): Promise<PublicRaffle> => {
  const response = await requestJson<{ readonly data: PublicRaffle }>(
    `/api/public/raffles/${slug}`,
  );
  return response.data;
};

export const fetchPublicSellerSettings = async (): Promise<SellerSettings> => {
  const response = await requestJson<{ readonly data: SellerSettings }>(
    '/api/public/seller-settings',
  );
  return response.data;
};

export const fetchCurrentPublicRaffle = async (): Promise<PublicRaffle> => {
  const response = await requestJson<{ readonly data: PublicRaffle }>(
    '/api/public/raffles/current',
  );
  return response.data;
};

export const fetchPublicRaffleNumbers = async (
  slug: string,
): Promise<readonly PublicRaffleNumber[]> => {
  const response = await requestJson<{ readonly data: readonly PublicRaffleNumber[] }>(
    `/api/public/raffles/${slug}/numbers`,
  );
  return response.data;
};

export interface CreateOrderInput {
  readonly slug: string;
  readonly raffle: PublicRaffle;
  readonly buyer: BuyerFormState;
  readonly quantity: number;
}

export const submitPublicOrderWithProof = async ({
  slug,
  buyer,
  quantity,
  proofFile,
}: {
  readonly slug: string;
  readonly buyer: BuyerFormState;
  readonly quantity: number;
  readonly proofFile: File;
}): Promise<{
  readonly order: CreatedOrder;
  readonly reservedNumbers: readonly PublicRaffleNumber[];
}> => {
  const prepared = await prepareImageForUpload(proofFile);

  const response = await requestJson<{
    readonly data: {
      readonly order: CreatedOrder;
      readonly reservedNumbers: readonly PublicRaffleNumber[];
    };
  }>(`/api/public/raffles/${slug}/orders`, {
    method: 'POST',
    body: JSON.stringify({
      fullName: buyer.fullName,
      documentNumber: buyer.documentNumber,
      email: buyer.email,
      phone: buyer.phone,
      acceptedTerms: true,
      isAdultConfirmed: true,
      numbersRequested: quantity,
      proof: {
        fileName: prepared.fileName,
        mimeType: prepared.mimeType,
        dataBase64: prepared.dataBase64,
      },
    }),
  });

  return response.data;
};

export const createPublicOrder = async ({
  slug,
  raffle,
  buyer,
  quantity,
}: CreateOrderInput): Promise<{
  readonly order: CreatedOrder;
  readonly reservedNumbers: readonly PublicRaffleNumber[];
}> => {
  // Lazy allocation: the buyer always requests a quantity and the server picks
  // the numbers at random across the whole range. (`raffle` is kept in the
  // signature for compatibility but no longer drives client-side selection.)
  void raffle;

  const payload: Record<string, unknown> = {
    fullName: buyer.fullName,
    documentNumber: buyer.documentNumber,
    email: buyer.email,
    phone: buyer.phone,
    acceptedTerms: true,
    isAdultConfirmed: true,
    numbersRequested: quantity,
  };

  const response = await requestJson<{
    readonly data: {
      readonly order: CreatedOrder;
      readonly reservedNumbers: readonly PublicRaffleNumber[];
    };
  }>(`/api/public/raffles/${slug}/orders`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return response.data;
};

export const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('No se pudo leer el comprobante.'));
    });
    reader.addEventListener('error', () => reject(new Error('No se pudo leer el comprobante.')));
    reader.readAsDataURL(file);
  });

export interface PublicOrderStatus {
  readonly id: string;
  readonly status: string;
  readonly amount: string;
  readonly currency: string;
  readonly numbersRequested: number;
  readonly createdAt: string;
  readonly raffleTitle: string;
  readonly raffleSlug: string;
  readonly numbers: readonly { readonly displayNumber: string; readonly status: string }[];
}

export interface PublicDrawResult {
  readonly winningNumber: number;
  readonly externalSource: string;
  readonly registeredAt: string;
  readonly winnerDisplayName: string | null;
}

export const fetchPublicOrderStatus = async (orderId: string): Promise<PublicOrderStatus> => {
  const response = await requestJson<{ readonly data: PublicOrderStatus }>(
    `/api/public/orders/${orderId}/status`,
  );
  return response.data;
};

export const fetchPublicDrawResult = async (slug: string): Promise<PublicDrawResult | null> => {
  const response = await fetch(`${API_BASE_URL}/api/public/raffles/${slug}/result`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('No se pudo cargar el resultado.');
  }

  const body = (await response.json()) as { data: PublicDrawResult };
  return body.data;
};

export const fetchPublicWinnersContent = async (
  slug: string,
): Promise<PublicWinnersContent> => {
  const response = await requestJson<{ readonly data: PublicWinnersContent }>(
    `/api/public/raffles/${slug}/winners-content`,
  );
  return response.data;
};

export const uploadPaymentProof = async (orderId: string, file: File): Promise<void> => {
  const prepared = await prepareImageForUpload(file);
  await requestJson(`/api/public/orders/${orderId}/proof`, {
    method: 'POST',
    body: JSON.stringify({
      fileName: prepared.fileName,
      mimeType: prepared.mimeType,
      dataBase64: prepared.dataBase64,
    }),
  });
};
