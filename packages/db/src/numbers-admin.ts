import { randomUUID } from 'node:crypto';

import { AUDIT_ACTIONS, ORDER_STATUSES, RAFFLE_NUMBER_STATUSES } from '@rifa/shared';
import { and, eq } from 'drizzle-orm';

import { createLocalPgliteDatabase } from './client';
import { auditLogs, orderNumbers, orders, raffleNumbers, raffles } from './schema';

interface NumberActionInput {
  readonly sellerId: string;
  readonly raffleNumberId: string;
}

export const blockSellerRaffleNumber = async ({
  sellerId,
  raffleNumberId,
}: NumberActionInput): Promise<boolean> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const [row] = await db
      .select({
        number: raffleNumbers,
        raffle: raffles,
      })
      .from(raffleNumbers)
      .innerJoin(raffles, eq(raffleNumbers.raffleId, raffles.id))
      .where(and(eq(raffleNumbers.id, raffleNumberId), eq(raffles.sellerId, sellerId)))
      .limit(1);

    if (!row || row.number.status !== RAFFLE_NUMBER_STATUSES.available) {
      return false;
    }

    await db
      .update(raffleNumbers)
      .set({
        status: RAFFLE_NUMBER_STATUSES.blocked,
        updatedAt: new Date(),
      })
      .where(eq(raffleNumbers.id, raffleNumberId));

    await db.insert(auditLogs).values({
      id: randomUUID(),
      sellerId,
      entityType: 'raffle_number',
      entityId: raffleNumberId,
      action: AUDIT_ACTIONS.numberBlocked,
      afterData: { number: row.number.number },
    });

    return true;
  } finally {
    await client.close();
  }
};

export const releaseSellerRaffleNumber = async ({
  sellerId,
  raffleNumberId,
}: NumberActionInput): Promise<boolean> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    return await db.transaction(async (transaction) => {
      const [row] = await transaction
        .select({
          number: raffleNumbers,
        })
        .from(raffleNumbers)
        .innerJoin(raffles, eq(raffleNumbers.raffleId, raffles.id))
        .where(and(eq(raffleNumbers.id, raffleNumberId), eq(raffles.sellerId, sellerId)))
        .limit(1);

      if (!row) {
        return false;
      }

      if (row.number.status === RAFFLE_NUMBER_STATUSES.blocked) {
        await transaction
          .update(raffleNumbers)
          .set({
            status: RAFFLE_NUMBER_STATUSES.available,
            updatedAt: new Date(),
          })
          .where(eq(raffleNumbers.id, raffleNumberId));

        return true;
      }

      if (row.number.status === RAFFLE_NUMBER_STATUSES.reserved && row.number.reservedByOrderId) {
        const [order] = await transaction
          .select({ id: orders.id, status: orders.status })
          .from(orders)
          .where(eq(orders.id, row.number.reservedByOrderId))
          .limit(1);

        if (!order || order.status !== ORDER_STATUSES.pendingReview) {
          return false;
        }

        await transaction
          .update(raffleNumbers)
          .set({
            status: RAFFLE_NUMBER_STATUSES.available,
            reservedByOrderId: null,
            reservedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(raffleNumbers.id, raffleNumberId));

        await transaction.delete(orderNumbers).where(eq(orderNumbers.orderId, order.id));

        return true;
      }

      return false;
    });
  } finally {
    await client.close();
  }
};
