import { DEFAULT_SELLER_SETTINGS, type SellerSettings } from '@rifa/shared';
import { eq } from 'drizzle-orm';

import { createLocalPgliteDatabase } from './client';
import { sellers } from './schema';

interface SellerScopeInput {
  readonly sellerId: string;
}

interface UpdateSellerSettingsInput extends SellerScopeInput {
  readonly settings: SellerSettings;
}

const cleanSettings = (settings: SellerSettings | null | undefined): SellerSettings => ({
  ...DEFAULT_SELLER_SETTINGS,
  ...(settings ?? {}),
});

export const getSellerSettings = async ({
  sellerId,
}: SellerScopeInput): Promise<SellerSettings> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const [seller] = await db
      .select({
        email: sellers.email,
        name: sellers.name,
        phone: sellers.phone,
        settings: sellers.settings,
      })
      .from(sellers)
      .where(eq(sellers.id, sellerId))
      .limit(1);

    if (!seller) {
      return cleanSettings(null);
    }

    return cleanSettings({
      brandName: seller.name,
      supportEmail: seller.email,
      supportPhone: seller.phone ?? undefined,
      ...(seller.settings ?? {}),
    });
  } finally {
    await client.close();
  }
};

export const updateSellerSettings = async ({
  sellerId,
  settings,
}: UpdateSellerSettingsInput): Promise<SellerSettings | null> => {
  const { client, db } = createLocalPgliteDatabase();
  const nextSettings = cleanSettings(settings);

  try {
    const [updated] = await db
      .update(sellers)
      .set({
        name: nextSettings.brandName?.trim() || DEFAULT_SELLER_SETTINGS.brandName,
        email: nextSettings.supportEmail?.trim() || DEFAULT_SELLER_SETTINGS.supportEmail,
        phone: nextSettings.supportPhone?.trim() || null,
        settings: nextSettings,
        updatedAt: new Date(),
      })
      .where(eq(sellers.id, sellerId))
      .returning({ settings: sellers.settings });

    return updated ? cleanSettings(updated.settings) : null;
  } finally {
    await client.close();
  }
};

export const updateSellerDefaultPaymentQrImage = async ({
  sellerId,
  paymentQrImageUrl,
}: SellerScopeInput & { readonly paymentQrImageUrl: string }): Promise<SellerSettings | null> => {
  const current = await getSellerSettings({ sellerId });

  return updateSellerSettings({
    sellerId,
    settings: { ...current, defaultPaymentQrImageUrl: paymentQrImageUrl },
  });
};
