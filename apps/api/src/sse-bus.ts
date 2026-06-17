import { randomUUID } from 'node:crypto';
import type { ServerResponse } from 'node:http';

export interface SseClient {
  readonly id: string;
  readonly response: ServerResponse;
}

export interface SseEventPayload {
  readonly type: string;
  readonly data: unknown;
}

const clientsBySeller = new Map<string, Set<SseClient>>();

export const registerSseClient = (sellerId: string, response: ServerResponse): SseClient => {
  const client: SseClient = { id: randomUUID(), response };
  let existingClients = clientsBySeller.get(sellerId);

  if (!existingClients) {
    existingClients = new Set();
    clientsBySeller.set(sellerId, existingClients);
  }

  existingClients.add(client);

  response.on('close', () => {
    const sellerClients = clientsBySeller.get(sellerId);

    if (sellerClients) {
      sellerClients.delete(client);

      if (sellerClients.size === 0) {
        clientsBySeller.delete(sellerId);
      }
    }
  });

  return client;
};

export const broadcastToSeller = (sellerId: string, payload: SseEventPayload): void => {
  const sellerClients = clientsBySeller.get(sellerId);

  if (!sellerClients || sellerClients.size === 0) {
    return;
  }

  const eventLine = `event: ${payload.type}\ndata: ${JSON.stringify(payload.data)}\n\n`;

  for (const client of sellerClients) {
    try {
      client.response.write(eventLine);
    } catch {
      sellerClients.delete(client);

      if (sellerClients.size === 0) {
        clientsBySeller.delete(sellerId);
      }
    }
  }
};

export const getConnectedSellerCount = (sellerId: string): number => {
  const sellerClients = clientsBySeller.get(sellerId);

  return sellerClients?.size ?? 0;
};
