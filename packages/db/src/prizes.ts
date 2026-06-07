import { randomUUID } from 'node:crypto';

import { and, asc, eq } from 'drizzle-orm';

import { createLocalPgliteDatabase } from './client';
import { rafflePrizes, raffles } from './schema';

interface SellerRaffleInput {
  readonly sellerId: string;
  readonly raffleId: string;
}

interface CreatePrizeInput extends SellerRaffleInput {
  readonly title: string;
  readonly description?: string | undefined;
  readonly commercialValue?: number | undefined;
  readonly position?: number | undefined;
}

interface UpdatePrizeInput {
  readonly sellerId: string;
  readonly prizeId: string;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly commercialValue?: number | undefined;
  readonly position?: number | undefined;
}

type PrizeRow = typeof rafflePrizes.$inferSelect;

const assertRaffleOwnership = async (
  db: ReturnType<typeof createLocalPgliteDatabase>['db'],
  sellerId: string,
  raffleId: string,
): Promise<boolean> => {
  const [raffle] = await db
    .select({ id: raffles.id })
    .from(raffles)
    .where(and(eq(raffles.sellerId, sellerId), eq(raffles.id, raffleId)))
    .limit(1);

  return Boolean(raffle);
};

export const listSellerRafflePrizes = async ({
  sellerId,
  raffleId,
}: SellerRaffleInput): Promise<readonly PrizeRow[] | null> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const ownsRaffle = await assertRaffleOwnership(db, sellerId, raffleId);

    if (!ownsRaffle) {
      return null;
    }

    return await db
      .select()
      .from(rafflePrizes)
      .where(eq(rafflePrizes.raffleId, raffleId))
      .orderBy(asc(rafflePrizes.position));
  } finally {
    await client.close();
  }
};

export const createSellerRafflePrize = async ({
  sellerId,
  raffleId,
  title,
  description,
  commercialValue,
  position = 1,
}: CreatePrizeInput): Promise<PrizeRow | null> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const ownsRaffle = await assertRaffleOwnership(db, sellerId, raffleId);

    if (!ownsRaffle) {
      return null;
    }

    const [created] = await db
      .insert(rafflePrizes)
      .values({
        id: randomUUID(),
        raffleId,
        title,
        description,
        commercialValue: commercialValue === undefined ? null : commercialValue.toFixed(2),
        position,
      })
      .returning();

    return created ?? null;
  } finally {
    await client.close();
  }
};

export const updateSellerRafflePrize = async ({
  sellerId,
  prizeId,
  title,
  description,
  commercialValue,
  position,
}: UpdatePrizeInput): Promise<PrizeRow | null> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const [existing] = await db
      .select({ raffleId: rafflePrizes.raffleId })
      .from(rafflePrizes)
      .where(eq(rafflePrizes.id, prizeId))
      .limit(1);

    if (!existing) {
      return null;
    }

    const ownsRaffle = await assertRaffleOwnership(db, sellerId, existing.raffleId);

    if (!ownsRaffle) {
      return null;
    }

    const [updated] = await db
      .update(rafflePrizes)
      .set({
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(commercialValue !== undefined ? { commercialValue: commercialValue.toFixed(2) } : {}),
        ...(position !== undefined ? { position } : {}),
        updatedAt: new Date(),
      })
      .where(eq(rafflePrizes.id, prizeId))
      .returning();

    return updated ?? null;
  } finally {
    await client.close();
  }
};

export const deleteSellerRafflePrize = async ({
  sellerId,
  prizeId,
}: {
  readonly sellerId: string;
  readonly prizeId: string;
}): Promise<boolean> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const [existing] = await db
      .select({ raffleId: rafflePrizes.raffleId })
      .from(rafflePrizes)
      .where(eq(rafflePrizes.id, prizeId))
      .limit(1);

    if (!existing) {
      return false;
    }

    const ownsRaffle = await assertRaffleOwnership(db, sellerId, existing.raffleId);

    if (!ownsRaffle) {
      return false;
    }

    await db.delete(rafflePrizes).where(eq(rafflePrizes.id, prizeId));

    return true;
  } finally {
    await client.close();
  }
};
