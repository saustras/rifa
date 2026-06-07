import { and, desc, eq } from 'drizzle-orm';

import { createLocalPgliteDatabase } from './client';
import { customers, orders, raffles } from './schema';

export interface RaffleOrderExportRow {
  readonly orderId: string;
  readonly status: string;
  readonly amount: string;
  readonly currency: string;
  readonly numbersRequested: number;
  readonly createdAt: Date;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly customerPhone: string;
  readonly customerDocument: string;
}

export const listSellerRaffleOrdersForExport = async ({
  sellerId,
  raffleId,
}: {
  readonly sellerId: string;
  readonly raffleId: string;
}): Promise<readonly RaffleOrderExportRow[] | null> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const [raffle] = await db
      .select({ id: raffles.id })
      .from(raffles)
      .where(and(eq(raffles.sellerId, sellerId), eq(raffles.id, raffleId)))
      .limit(1);

    if (!raffle) {
      return null;
    }

    return await db
      .select({
        orderId: orders.id,
        status: orders.status,
        amount: orders.amount,
        currency: orders.currency,
        numbersRequested: orders.numbersRequested,
        createdAt: orders.createdAt,
        customerName: customers.fullName,
        customerEmail: customers.email,
        customerPhone: customers.phone,
        customerDocument: customers.documentNumber,
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .where(and(eq(orders.sellerId, sellerId), eq(orders.raffleId, raffleId)))
      .orderBy(desc(orders.createdAt));
  } finally {
    await client.close();
  }
};
