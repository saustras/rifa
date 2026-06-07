import { eq } from 'drizzle-orm';

import { createLocalPgliteDatabase } from './client';
import { orderNumbers, orders, raffles } from './schema';

export interface PublicOrderStatus {
  readonly id: string;
  readonly status: string;
  readonly amount: string;
  readonly currency: string;
  readonly numbersRequested: number;
  readonly createdAt: Date;
  readonly raffleTitle: string;
  readonly raffleSlug: string;
  readonly numbers: readonly {
    readonly displayNumber: string;
    readonly status: string;
  }[];
}

export const getPublicOrderStatus = async (orderId: string): Promise<PublicOrderStatus | null> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const [row] = await db
      .select({
        id: orders.id,
        status: orders.status,
        amount: orders.amount,
        currency: orders.currency,
        numbersRequested: orders.numbersRequested,
        createdAt: orders.createdAt,
        raffleTitle: raffles.title,
        raffleSlug: raffles.slug,
      })
      .from(orders)
      .innerJoin(raffles, eq(orders.raffleId, raffles.id))
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!row) {
      return null;
    }

    const numbers = await db
      .select({
        displayNumber: orderNumbers.displayNumber,
        status: orderNumbers.status,
      })
      .from(orderNumbers)
      .where(eq(orderNumbers.orderId, orderId));

    return {
      ...row,
      numbers,
    };
  } finally {
    await client.close();
  }
};
