import { randomUUID } from 'node:crypto';

import { AUDIT_ACTIONS, RAFFLE_NUMBER_STATUSES } from '@rifa/shared';
import { and, eq } from 'drizzle-orm';

import { createLocalPgliteDatabase } from './client';
import { auditLogs, orderNumbers, raffleNumbers, raffles } from './schema';
import { formatRaffleDisplayNumber } from './raffles';

interface NumberActionInput {
  readonly sellerId: string;
  readonly raffleNumberId: string;
}

interface BlockByValueInput {
  readonly sellerId: string;
  readonly raffleId: string;
  readonly number: number;
}

/**
 * Blocks a specific number by value. With lazy allocation, an available number
 * has no row, so blocking it means inserting a new row with status "blocked".
 * Returns false if the number is out of range or already taken.
 */
export const blockSellerRaffleNumberByValue = async ({
  sellerId,
  raffleId,
  number,
}: BlockByValueInput): Promise<boolean> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    return await db.transaction(async (transaction) => {
      const [raffle] = await transaction
        .select({
          id: raffles.id,
          numberMin: raffles.numberMin,
          numberMax: raffles.numberMax,
          numberPadding: raffles.numberPadding,
        })
        .from(raffles)
        .where(and(eq(raffles.id, raffleId), eq(raffles.sellerId, sellerId)))
        .limit(1);

      if (!raffle) {
        return false;
      }

      if (!Number.isInteger(number) || number < raffle.numberMin || number > raffle.numberMax) {
        return false;
      }

      const [existing] = await transaction
        .select({ id: raffleNumbers.id })
        .from(raffleNumbers)
        .where(and(eq(raffleNumbers.raffleId, raffleId), eq(raffleNumbers.number, number)))
        .limit(1);

      if (existing) {
        return false;
      }

      const newId = randomUUID();

      await transaction.insert(raffleNumbers).values({
        id: newId,
        raffleId,
        number,
        displayNumber: formatRaffleDisplayNumber(number, raffle.numberPadding),
        status: RAFFLE_NUMBER_STATUSES.blocked,
      });

      await transaction.insert(auditLogs).values({
        id: randomUUID(),
        sellerId,
        entityType: 'raffle_number',
        entityId: newId,
        action: AUDIT_ACTIONS.numberBlocked,
        afterData: { number },
      });

      return true;
    });
  } finally {
    await client.close();
  }
};

/**
 * Releases a number by deleting its row (lazy model: no row = available).
 * Works for blocked and reserved numbers. Assigned (paid) numbers are NOT
 * released here — handle those by rejecting the order instead.
 */
export const releaseSellerRaffleNumber = async ({
  sellerId,
  raffleNumberId,
}: NumberActionInput): Promise<boolean> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    return await db.transaction(async (transaction) => {
      const [row] = await transaction
        .select({
          id: raffleNumbers.id,
          status: raffleNumbers.status,
        })
        .from(raffleNumbers)
        .innerJoin(raffles, eq(raffleNumbers.raffleId, raffles.id))
        .where(and(eq(raffleNumbers.id, raffleNumberId), eq(raffles.sellerId, sellerId)))
        .limit(1);

      if (!row) {
        return false;
      }

      if (
        row.status !== RAFFLE_NUMBER_STATUSES.blocked &&
        row.status !== RAFFLE_NUMBER_STATUSES.reserved
      ) {
        return false;
      }

      await transaction.delete(orderNumbers).where(eq(orderNumbers.raffleNumberId, raffleNumberId));
      await transaction.delete(raffleNumbers).where(eq(raffleNumbers.id, raffleNumberId));

      await transaction.insert(auditLogs).values({
        id: randomUUID(),
        sellerId,
        entityType: 'raffle_number',
        entityId: raffleNumberId,
        action: AUDIT_ACTIONS.numberReleased,
        afterData: { released: true },
      });

      return true;
    });
  } finally {
    await client.close();
  }
};
