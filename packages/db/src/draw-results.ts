import { randomUUID } from 'node:crypto';

import { AUDIT_ACTIONS, RAFFLE_NUMBER_STATUSES, RAFFLE_STATUSES } from '@rifa/shared';
import { and, eq } from 'drizzle-orm';

import { createLocalPgliteDatabase } from './client';
import { auditLogs, customers, drawResults, orders, raffleNumbers, raffles } from './schema';

interface SellerRaffleInput {
  readonly sellerId: string;
  readonly raffleId: string;
}

interface RegisterDrawResultInput extends SellerRaffleInput {
  readonly winningNumber: number;
  readonly externalSource: string;
  readonly notes?: string | undefined;
}

export interface DrawResultView {
  readonly id: string;
  readonly raffleId: string;
  readonly winningNumber: number;
  readonly externalSource: string;
  readonly externalDrawDate: Date | null;
  readonly notes: string | null;
  readonly registeredAt: Date;
  readonly winnerDisplayName: string | null;
  readonly winnerOrderId: string | null;
}

export const getSellerDrawResult = async ({
  sellerId,
  raffleId,
}: SellerRaffleInput): Promise<DrawResultView | null> => {
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

    const [result] = await db
      .select()
      .from(drawResults)
      .where(eq(drawResults.raffleId, raffleId))
      .limit(1);

    if (!result) {
      return null;
    }

    let winnerDisplayName: string | null = null;

    if (result.winnerCustomerId) {
      const [winner] = await db
        .select({ fullName: customers.fullName })
        .from(customers)
        .where(eq(customers.id, result.winnerCustomerId))
        .limit(1);

      winnerDisplayName = winner?.fullName ?? null;
    }

    return {
      id: result.id,
      raffleId: result.raffleId,
      winningNumber: result.winningNumber,
      externalSource: result.externalSource,
      externalDrawDate: result.externalDrawDate,
      notes: result.notes,
      registeredAt: result.registeredAt,
      winnerDisplayName,
      winnerOrderId: result.winnerOrderId,
    };
  } finally {
    await client.close();
  }
};

export const getPublicDrawResultBySlug = async (slug: string): Promise<DrawResultView | null> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const [raffle] = await db
      .select({ id: raffles.id })
      .from(raffles)
      .where(eq(raffles.slug, slug))
      .limit(1);

    if (!raffle) {
      return null;
    }

    const [result] = await db
      .select()
      .from(drawResults)
      .where(eq(drawResults.raffleId, raffle.id))
      .limit(1);

    if (!result) {
      return null;
    }

    let winnerDisplayName: string | null = null;

    if (result.winnerCustomerId) {
      const [winner] = await db
        .select({ fullName: customers.fullName })
        .from(customers)
        .where(eq(customers.id, result.winnerCustomerId))
        .limit(1);

      // Public page shows only first name + initial for privacy
      const fullName = winner?.fullName ?? '';
      const parts = fullName.trim().split(/\s+/);
      winnerDisplayName =
        parts.length > 1 ? `${parts[0]} ${parts[1]?.charAt(0) ?? ''}.`.trim() : fullName;
    }

    return {
      id: result.id,
      raffleId: result.raffleId,
      winningNumber: result.winningNumber,
      externalSource: result.externalSource,
      externalDrawDate: result.externalDrawDate,
      notes: result.notes,
      registeredAt: result.registeredAt,
      winnerDisplayName,
      winnerOrderId: null,
    };
  } finally {
    await client.close();
  }
};

export const registerSellerDrawResult = async ({
  sellerId,
  raffleId,
  winningNumber,
  externalSource,
  notes,
}: RegisterDrawResultInput): Promise<DrawResultView> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    return await db.transaction(async (transaction) => {
      const [raffle] = await transaction
        .select()
        .from(raffles)
        .where(and(eq(raffles.sellerId, sellerId), eq(raffles.id, raffleId)))
        .limit(1);

      if (!raffle) {
        throw new Error('Raffle not found');
      }

      const [existing] = await transaction
        .select({ id: drawResults.id })
        .from(drawResults)
        .where(eq(drawResults.raffleId, raffleId))
        .limit(1);

      if (existing) {
        throw new Error('Draw result already registered for this raffle');
      }

      const [winningRaffleNumber] = await transaction
        .select()
        .from(raffleNumbers)
        .where(and(eq(raffleNumbers.raffleId, raffleId), eq(raffleNumbers.number, winningNumber)))
        .limit(1);

      if (!winningRaffleNumber) {
        throw new Error('Winning number does not exist in this raffle');
      }

      let winnerOrderId: string | null = winningRaffleNumber.assignedToOrderId;
      let winnerCustomerId: string | null = null;

      if (winnerOrderId) {
        const [winnerOrder] = await transaction
          .select({ customerId: orders.customerId, status: orders.status })
          .from(orders)
          .where(eq(orders.id, winnerOrderId))
          .limit(1);

        if (winnerOrder?.status === 'paid') {
          winnerCustomerId = winnerOrder.customerId;
        } else {
          winnerOrderId = null;
        }
      }

      const drawResultId = randomUUID();

      const [created] = await transaction
        .insert(drawResults)
        .values({
          id: drawResultId,
          raffleId,
          externalSource,
          winningNumber,
          winnerOrderId,
          winnerCustomerId,
          notes: notes ?? null,
          registeredAt: new Date(),
        })
        .returning();

      if (!created) {
        throw new Error('Draw result was not created');
      }

      await transaction
        .update(raffleNumbers)
        .set({
          status: RAFFLE_NUMBER_STATUSES.winner,
          updatedAt: new Date(),
        })
        .where(eq(raffleNumbers.id, winningRaffleNumber.id));

      await transaction
        .update(raffles)
        .set({
          status: RAFFLE_STATUSES.drawn,
          updatedAt: new Date(),
        })
        .where(eq(raffles.id, raffleId));

      await transaction.insert(auditLogs).values({
        id: randomUUID(),
        sellerId,
        entityType: 'raffle',
        entityId: raffleId,
        action: AUDIT_ACTIONS.drawResultRegistered,
        afterData: {
          winningNumber,
          externalSource,
          winnerOrderId,
          winnerCustomerId,
        },
      });

      let winnerDisplayName: string | null = null;

      if (winnerCustomerId) {
        const [winner] = await transaction
          .select({ fullName: customers.fullName })
          .from(customers)
          .where(eq(customers.id, winnerCustomerId))
          .limit(1);

        winnerDisplayName = winner?.fullName ?? null;
      }

      return {
        id: created.id,
        raffleId: created.raffleId,
        winningNumber: created.winningNumber,
        externalSource: created.externalSource,
        externalDrawDate: created.externalDrawDate,
        notes: created.notes,
        registeredAt: created.registeredAt,
        winnerDisplayName,
        winnerOrderId: created.winnerOrderId,
      };
    });
  } finally {
    await client.close();
  }
};
