import { randomUUID } from 'node:crypto';

import { and, asc, eq } from 'drizzle-orm';

import { createLocalPgliteDatabase } from './client';
import { customers, deliveryGalleryImages, drawResults, raffles } from './schema';

export interface WinnerContentRow {
  readonly id: string;
  readonly raffleId: string;
  readonly raffleTitle: string;
  readonly winningNumber: number;
  readonly externalSource: string;
  readonly registeredAt: Date;
  readonly winnerDisplayName: string | null;
  readonly isPublicWinner: boolean;
  readonly winnerPhotoUrl: string | null;
  readonly winnerComment: string | null;
  readonly displayOrder: number;
}

export interface DeliveryGalleryImageRow {
  readonly id: string;
  readonly imageUrl: string;
  readonly title: string | null;
  readonly caption: string | null;
  readonly isPublic: boolean;
  readonly displayOrder: number;
  readonly createdAt: Date;
}

export interface PublicWinnersContent {
  readonly winners: readonly WinnerContentRow[];
  readonly gallery: readonly DeliveryGalleryImageRow[];
}

const toPublicName = (fullName: string | null): string | null => {
  if (!fullName) {
    return null;
  }

  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1]?.charAt(0) ?? ''}.`.trim() : fullName;
};

export const listSellerWinners = async (sellerId: string): Promise<readonly WinnerContentRow[]> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const rows = await db
      .select({
        id: drawResults.id,
        raffleId: drawResults.raffleId,
        raffleTitle: raffles.title,
        winningNumber: drawResults.winningNumber,
        externalSource: drawResults.externalSource,
        registeredAt: drawResults.registeredAt,
        winnerDisplayName: customers.fullName,
        isPublicWinner: drawResults.isPublicWinner,
        winnerPhotoUrl: drawResults.winnerPhotoUrl,
        winnerComment: drawResults.winnerComment,
        displayOrder: drawResults.displayOrder,
      })
      .from(drawResults)
      .innerJoin(raffles, eq(raffles.id, drawResults.raffleId))
      .leftJoin(customers, eq(customers.id, drawResults.winnerCustomerId))
      .where(eq(raffles.sellerId, sellerId))
      .orderBy(asc(drawResults.displayOrder), asc(drawResults.registeredAt));

    return rows;
  } finally {
    await client.close();
  }
};

export const updateSellerWinner = async ({
  sellerId,
  winnerId,
  isPublicWinner,
  winnerComment,
  displayOrder,
  winnerPhotoUrl,
}: {
  readonly sellerId: string;
  readonly winnerId: string;
  readonly isPublicWinner?: boolean | undefined;
  readonly winnerComment?: string | null | undefined;
  readonly displayOrder?: number | undefined;
  readonly winnerPhotoUrl?: string | undefined;
}): Promise<WinnerContentRow | null> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const [owner] = await db
      .select({ id: drawResults.id })
      .from(drawResults)
      .innerJoin(raffles, eq(raffles.id, drawResults.raffleId))
      .where(and(eq(raffles.sellerId, sellerId), eq(drawResults.id, winnerId)))
      .limit(1);

    if (!owner) {
      return null;
    }

    const patch: Partial<typeof drawResults.$inferInsert> = {};
    if (isPublicWinner !== undefined) patch.isPublicWinner = isPublicWinner;
    if (winnerComment !== undefined) patch.winnerComment = winnerComment;
    if (displayOrder !== undefined) patch.displayOrder = displayOrder;
    if (winnerPhotoUrl !== undefined) patch.winnerPhotoUrl = winnerPhotoUrl;

    if (Object.keys(patch).length > 0) {
      await db.update(drawResults).set(patch).where(eq(drawResults.id, winnerId));
    }

    const winners = await listSellerWinners(sellerId);
    return winners.find((winner) => winner.id === winnerId) ?? null;
  } finally {
    await client.close();
  }
};

export const listSellerDeliveryGallery = async (
  sellerId: string,
): Promise<readonly DeliveryGalleryImageRow[]> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    return await db
      .select({
        id: deliveryGalleryImages.id,
        imageUrl: deliveryGalleryImages.imageUrl,
        title: deliveryGalleryImages.title,
        caption: deliveryGalleryImages.caption,
        isPublic: deliveryGalleryImages.isPublic,
        displayOrder: deliveryGalleryImages.displayOrder,
        createdAt: deliveryGalleryImages.createdAt,
      })
      .from(deliveryGalleryImages)
      .where(eq(deliveryGalleryImages.sellerId, sellerId))
      .orderBy(asc(deliveryGalleryImages.displayOrder), asc(deliveryGalleryImages.createdAt));
  } finally {
    await client.close();
  }
};

export const createSellerDeliveryGalleryImage = async ({
  sellerId,
  imageUrl,
  title,
  caption,
  isPublic = true,
  displayOrder = 0,
}: {
  readonly sellerId: string;
  readonly imageUrl: string;
  readonly title?: string | undefined;
  readonly caption?: string | undefined;
  readonly isPublic?: boolean | undefined;
  readonly displayOrder?: number | undefined;
}): Promise<DeliveryGalleryImageRow> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const [created] = await db
      .insert(deliveryGalleryImages)
      .values({
        id: randomUUID(),
        sellerId,
        imageUrl,
        title: title?.trim() || null,
        caption: caption?.trim() || null,
        isPublic,
        displayOrder,
      })
      .returning();

    if (!created) {
      throw new Error('Gallery image was not created');
    }

    return {
      id: created.id,
      imageUrl: created.imageUrl,
      title: created.title,
      caption: created.caption,
      isPublic: created.isPublic,
      displayOrder: created.displayOrder,
      createdAt: created.createdAt,
    };
  } finally {
    await client.close();
  }
};

export const updateSellerDeliveryGalleryImage = async ({
  sellerId,
  imageId,
  title,
  caption,
  isPublic,
  displayOrder,
}: {
  readonly sellerId: string;
  readonly imageId: string;
  readonly title?: string | null | undefined;
  readonly caption?: string | null | undefined;
  readonly isPublic?: boolean | undefined;
  readonly displayOrder?: number | undefined;
}): Promise<DeliveryGalleryImageRow | null> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const patch: Partial<typeof deliveryGalleryImages.$inferInsert> = { updatedAt: new Date() };
    if (title !== undefined) patch.title = title?.trim() || null;
    if (caption !== undefined) patch.caption = caption?.trim() || null;
    if (isPublic !== undefined) patch.isPublic = isPublic;
    if (displayOrder !== undefined) patch.displayOrder = displayOrder;

    const [updated] = await db
      .update(deliveryGalleryImages)
      .set(patch)
      .where(and(eq(deliveryGalleryImages.sellerId, sellerId), eq(deliveryGalleryImages.id, imageId)))
      .returning();

    if (!updated) {
      return null;
    }

    return {
      id: updated.id,
      imageUrl: updated.imageUrl,
      title: updated.title,
      caption: updated.caption,
      isPublic: updated.isPublic,
      displayOrder: updated.displayOrder,
      createdAt: updated.createdAt,
    };
  } finally {
    await client.close();
  }
};

export const deleteSellerDeliveryGalleryImage = async ({
  sellerId,
  imageId,
}: {
  readonly sellerId: string;
  readonly imageId: string;
}): Promise<boolean> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const deleted = await db
      .delete(deliveryGalleryImages)
      .where(and(eq(deliveryGalleryImages.sellerId, sellerId), eq(deliveryGalleryImages.id, imageId)))
      .returning({ id: deliveryGalleryImages.id });

    return deleted.length > 0;
  } finally {
    await client.close();
  }
};

export const getPublicWinnersContentBySlug = async (
  slug: string,
): Promise<PublicWinnersContent | null> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const [raffle] = await db
      .select({ sellerId: raffles.sellerId })
      .from(raffles)
      .where(eq(raffles.slug, slug))
      .limit(1);

    if (!raffle) {
      return null;
    }

    const winners = await db
      .select({
        id: drawResults.id,
        raffleId: drawResults.raffleId,
        raffleTitle: raffles.title,
        winningNumber: drawResults.winningNumber,
        externalSource: drawResults.externalSource,
        registeredAt: drawResults.registeredAt,
        winnerDisplayName: customers.fullName,
        isPublicWinner: drawResults.isPublicWinner,
        winnerPhotoUrl: drawResults.winnerPhotoUrl,
        winnerComment: drawResults.winnerComment,
        displayOrder: drawResults.displayOrder,
      })
      .from(drawResults)
      .innerJoin(raffles, eq(raffles.id, drawResults.raffleId))
      .leftJoin(customers, eq(customers.id, drawResults.winnerCustomerId))
      .where(and(eq(raffles.sellerId, raffle.sellerId), eq(drawResults.isPublicWinner, true)))
      .orderBy(asc(drawResults.displayOrder), asc(drawResults.registeredAt));

    const gallery = await db
      .select({
        id: deliveryGalleryImages.id,
        imageUrl: deliveryGalleryImages.imageUrl,
        title: deliveryGalleryImages.title,
        caption: deliveryGalleryImages.caption,
        isPublic: deliveryGalleryImages.isPublic,
        displayOrder: deliveryGalleryImages.displayOrder,
        createdAt: deliveryGalleryImages.createdAt,
      })
      .from(deliveryGalleryImages)
      .where(and(eq(deliveryGalleryImages.sellerId, raffle.sellerId), eq(deliveryGalleryImages.isPublic, true)))
      .orderBy(asc(deliveryGalleryImages.displayOrder), asc(deliveryGalleryImages.createdAt));

    return {
      winners: winners.map((winner) => ({
        ...winner,
        winnerDisplayName: toPublicName(winner.winnerDisplayName),
      })),
      gallery,
    };
  } finally {
    await client.close();
  }
};
