import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { and, eq } from 'drizzle-orm';

import { createLocalPgliteDatabase } from './client';
import { auditLogs, raffles } from './schema';

const CAMPAIGN_ASSETS_DIR = process.env.CAMPAIGN_ASSETS_DIR ?? './packages/db/campaign-assets';

export type CampaignAssetKind = 'cover' | 'qr' | 'winner' | 'gallery';

const toExtension = (mimeType: string): string => {
  if (mimeType === 'image/png') {
    return 'png';
  }

  if (mimeType === 'image/webp') {
    return 'webp';
  }

  return 'jpg';
};

export const persistCampaignAssetImage = async (
  raffleId: string,
  image: Buffer,
  mimeType: string,
  kind: CampaignAssetKind,
): Promise<string> => {
  await mkdir(CAMPAIGN_ASSETS_DIR, { recursive: true });

  const extension = toExtension(mimeType);
  const storageKey = `${kind}-${raffleId}-${Date.now()}.${extension}`;
  const filePath = path.join(CAMPAIGN_ASSETS_DIR, storageKey);
  await writeFile(filePath, image);

  return `/local-campaign-assets/${storageKey}`;
};

export const persistCampaignCoverImage = async (
  raffleId: string,
  image: Buffer,
  mimeType: string,
): Promise<string> => persistCampaignAssetImage(raffleId, image, mimeType, 'cover');

export const persistCampaignPaymentQrImage = async (
  raffleId: string,
  image: Buffer,
  mimeType: string,
): Promise<string> => persistCampaignAssetImage(raffleId, image, mimeType, 'qr');

export const updateSellerRaffleCoverImage = async ({
  sellerId,
  raffleId,
  coverImageUrl,
}: {
  readonly sellerId: string;
  readonly raffleId: string;
  readonly coverImageUrl: string;
}): Promise<boolean> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const [updated] = await db
      .update(raffles)
      .set({ coverImageUrl, updatedAt: new Date() })
      .where(and(eq(raffles.sellerId, sellerId), eq(raffles.id, raffleId)))
      .returning({ id: raffles.id });

    if (!updated) {
      return false;
    }

    await db.insert(auditLogs).values({
      id: randomUUID(),
      sellerId,
      entityType: 'raffle',
      entityId: raffleId,
      action: 'raffle_updated',
      afterData: { coverImageUrl },
    });

    return true;
  } finally {
    await client.close();
  }
};

export const updateSellerRafflePaymentQrImage = async ({
  sellerId,
  raffleId,
  paymentQrImageUrl,
}: {
  readonly sellerId: string;
  readonly raffleId: string;
  readonly paymentQrImageUrl: string;
}): Promise<boolean> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const [updated] = await db
      .update(raffles)
      .set({ paymentQrImageUrl, updatedAt: new Date() })
      .where(and(eq(raffles.sellerId, sellerId), eq(raffles.id, raffleId)))
      .returning({ id: raffles.id });

    if (!updated) {
      return false;
    }

    await db.insert(auditLogs).values({
      id: randomUUID(),
      sellerId,
      entityType: 'raffle',
      entityId: raffleId,
      action: 'raffle_updated',
      afterData: { paymentQrImageUrl },
    });

    return true;
  } finally {
    await client.close();
  }
};
