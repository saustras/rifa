import { randomUUID } from 'node:crypto';

import {
  ASSIGNMENT_MODES,
  ORDER_STATUSES,
  RAFFLE_NUMBER_STATUSES,
  RAFFLE_STATUSES,
} from '@rifa/shared';
import type { AssignmentMode, RaffleLandingConfig, RaffleStatus } from '@rifa/shared';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import { createLocalPgliteDatabase } from './client';
import { auditLogs, customers, orderNumbers, orders, raffleNumbers, raffles } from './schema';
import { getSellerSettings } from './seller-settings';

interface SellerScopeInput {
  readonly sellerId: string;
}

interface RaffleIdInput extends SellerScopeInput {
  readonly raffleId: string;
}

interface CreateRafflePayload {
  readonly title: string;
  readonly slug: string;
  readonly description?: string | undefined;
  readonly status: RaffleStatus;
  readonly coverImageUrl?: string | undefined;
  readonly landingConfig?: RaffleLandingConfig | undefined;
  readonly pricePerNumber: number;
  readonly currency: string;
  readonly numberMin: number;
  readonly numberMax: number;
  readonly numberPadding: number;
  readonly assignmentMode: AssignmentMode;
  readonly reservationTtlMinutes: number;
  readonly drawSourceName?: string | undefined;
  readonly drawDate?: string | undefined;
  readonly drawTime?: string | undefined;
  readonly drawRule?: string | undefined;
  readonly terms?: string | undefined;
  readonly paymentMethodLabel?: string | undefined;
  readonly paymentAccountHolder?: string | undefined;
  readonly paymentAccountType?: string | undefined;
  readonly paymentAccountNumber?: string | undefined;
  readonly paymentDocumentNumber?: string | undefined;
  readonly paymentInstructions?: string | undefined;
}

interface UpdateRafflePayload {
  readonly title?: string | undefined;
  readonly slug?: string | undefined;
  readonly description?: string | undefined;
  readonly status?: RaffleStatus | undefined;
  readonly coverImageUrl?: string | undefined;
  readonly landingConfig?: RaffleLandingConfig | undefined;
  readonly pricePerNumber?: number | undefined;
  readonly currency?: string | undefined;
  readonly assignmentMode?: AssignmentMode | undefined;
  readonly reservationTtlMinutes?: number | undefined;
  readonly drawSourceName?: string | undefined;
  readonly drawDate?: string | undefined;
  readonly drawTime?: string | undefined;
  readonly drawRule?: string | undefined;
  readonly terms?: string | undefined;
  readonly paymentMethodLabel?: string | undefined;
  readonly paymentAccountHolder?: string | undefined;
  readonly paymentAccountType?: string | undefined;
  readonly paymentAccountNumber?: string | undefined;
  readonly paymentDocumentNumber?: string | undefined;
  readonly paymentInstructions?: string | undefined;
}

interface CreateSellerRaffleInput extends SellerScopeInput {
  readonly payload: CreateRafflePayload;
}

interface UpdateSellerRaffleInput extends RaffleIdInput {
  readonly payload: UpdateRafflePayload;
}

interface CreatePublicOrderPayload {
  readonly fullName: string;
  readonly documentType?: string | undefined;
  readonly documentNumber: string;
  readonly email: string;
  readonly phone: string;
  readonly city?: string | undefined;
  readonly acceptedTerms: true;
  readonly isAdultConfirmed: true;
  readonly numbersRequested?: number | undefined;
  readonly selectedNumbers?: readonly number[] | undefined;
}

interface CreatePublicOrderInput {
  readonly slug: string;
  readonly payload: CreatePublicOrderPayload;
}

type RaffleRow = typeof raffles.$inferSelect;
type PublicRaffleNumberRow = Pick<
  typeof raffleNumbers.$inferSelect,
  'id' | 'number' | 'displayNumber' | 'status'
>;
type OrderRow = typeof orders.$inferSelect;

interface PublicOrderResult {
  readonly order: OrderRow;
  readonly reservedNumbers: readonly PublicRaffleNumberRow[];
}

const toMoneyString = (value: number): string => value.toFixed(2);

const emptyToUndefined = (value: string | null | undefined): string | undefined =>
  value?.trim() ? value : undefined;

const applySellerDefaultsToRaffle = async (raffle: RaffleRow): Promise<RaffleRow> => {
  const settings = await getSellerSettings({ sellerId: raffle.sellerId });
  const landingConfig = raffle.landingConfig ?? {};

  return {
    ...raffle,
    paymentQrImageUrl:
      raffle.paymentQrImageUrl ?? emptyToUndefined(settings.defaultPaymentQrImageUrl) ?? null,
    paymentMethodLabel:
      raffle.paymentMethodLabel ?? emptyToUndefined(settings.defaultPaymentMethodLabel) ?? null,
    paymentAccountHolder:
      raffle.paymentAccountHolder ?? emptyToUndefined(settings.defaultPaymentAccountHolder) ?? null,
    paymentAccountType:
      raffle.paymentAccountType ?? emptyToUndefined(settings.defaultPaymentAccountType) ?? null,
    paymentAccountNumber:
      raffle.paymentAccountNumber ?? emptyToUndefined(settings.defaultPaymentAccountNumber) ?? null,
    paymentDocumentNumber:
      raffle.paymentDocumentNumber ??
      emptyToUndefined(settings.defaultPaymentDocumentNumber) ??
      null,
    paymentInstructions:
      raffle.paymentInstructions ?? emptyToUndefined(settings.defaultPaymentInstructions) ?? null,
    landingConfig: {
      ...landingConfig,
      brandName: emptyToUndefined(settings.brandName) ?? landingConfig.brandName,
      brandSubtitle: emptyToUndefined(settings.brandSubtitle) ?? landingConfig.brandSubtitle,
      organizerCompany:
        emptyToUndefined(settings.organizerCompany) ?? landingConfig.organizerCompany,
      organizerTaxId: emptyToUndefined(settings.organizerTaxId) ?? landingConfig.organizerTaxId,
      organizerAddress:
        emptyToUndefined(settings.organizerAddress) ?? landingConfig.organizerAddress,
      organizerCity: emptyToUndefined(settings.organizerCity) ?? landingConfig.organizerCity,
      footerPhone: emptyToUndefined(settings.supportPhone) ?? landingConfig.footerPhone,
      footerEmail: emptyToUndefined(settings.supportEmail) ?? landingConfig.footerEmail,
      footerHours: emptyToUndefined(settings.supportHours) ?? landingConfig.footerHours,
      instagramUrl: emptyToUndefined(settings.instagramUrl) ?? landingConfig.instagramUrl,
      facebookUrl: emptyToUndefined(settings.facebookUrl) ?? landingConfig.facebookUrl,
      youtubeUrl: emptyToUndefined(settings.youtubeUrl) ?? landingConfig.youtubeUrl,
      footerBrandText: emptyToUndefined(settings.footerBrandText) ?? landingConfig.footerBrandText,
      copyrightText: emptyToUndefined(settings.copyrightText) ?? landingConfig.copyrightText,
    },
  };
};

const toNullableDate = (value: string | undefined): Date | null => {
  if (!value) {
    return null;
  }

  return new Date(value);
};

const displayNumber = (value: number, padding: number): string =>
  value.toString().padStart(padding, '0');

const createNumberRows = (raffleId: string, min: number, max: number, padding: number) =>
  Array.from({ length: max - min + 1 }, (_, index) => {
    const number = min + index;

    return {
      id: randomUUID(),
      raffleId,
      number,
      displayNumber: displayNumber(number, padding),
    };
  });

export const listSellerRaffles = async ({
  sellerId,
}: SellerScopeInput): Promise<readonly RaffleRow[]> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    return await db
      .select()
      .from(raffles)
      .where(eq(raffles.sellerId, sellerId))
      .orderBy(desc(raffles.createdAt));
  } finally {
    await client.close();
  }
};

export const getSellerRaffleById = async ({
  sellerId,
  raffleId,
}: RaffleIdInput): Promise<RaffleRow | null> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const [raffle] = await db
      .select()
      .from(raffles)
      .where(and(eq(raffles.sellerId, sellerId), eq(raffles.id, raffleId)))
      .limit(1);

    return raffle ? applySellerDefaultsToRaffle(raffle) : null;
  } finally {
    await client.close();
  }
};

export const createSellerRaffle = async ({
  sellerId,
  payload,
}: CreateSellerRaffleInput): Promise<RaffleRow> => {
  const { client, db } = createLocalPgliteDatabase();
  const raffleId = randomUUID();

  try {
    const [created] = await db.transaction(async (transaction) => {
      const [insertedRaffle] = await transaction
        .insert(raffles)
        .values({
          id: raffleId,
          sellerId,
          title: payload.title,
          slug: payload.slug,
          description: payload.description,
          status: payload.status,
          coverImageUrl: payload.coverImageUrl,
          landingConfig: payload.landingConfig ?? null,
          pricePerNumber: toMoneyString(payload.pricePerNumber),
          currency: payload.currency,
          numberMin: payload.numberMin,
          numberMax: payload.numberMax,
          numberPadding: payload.numberPadding,
          assignmentMode: payload.assignmentMode,
          reservationTtlMinutes: payload.reservationTtlMinutes,
          drawSourceName: payload.drawSourceName,
          drawDate: toNullableDate(payload.drawDate),
          drawTime: payload.drawTime,
          drawRule: payload.drawRule,
          terms: payload.terms,
          paymentMethodLabel: payload.paymentMethodLabel,
          paymentAccountHolder: payload.paymentAccountHolder,
          paymentAccountType: payload.paymentAccountType,
          paymentAccountNumber: payload.paymentAccountNumber,
          paymentDocumentNumber: payload.paymentDocumentNumber,
          paymentInstructions: payload.paymentInstructions,
        })
        .returning();

      await transaction
        .insert(raffleNumbers)
        .values(
          createNumberRows(raffleId, payload.numberMin, payload.numberMax, payload.numberPadding),
        );

      await transaction.insert(auditLogs).values({
        id: randomUUID(),
        sellerId,
        entityType: 'raffle',
        entityId: raffleId,
        action: 'raffle_created',
        afterData: {
          title: payload.title,
          slug: payload.slug,
          numberMin: payload.numberMin,
          numberMax: payload.numberMax,
        },
      });

      return [insertedRaffle];
    });

    if (!created) {
      throw new Error('Raffle was not created');
    }

    return created;
  } finally {
    await client.close();
  }
};

export const updateSellerRaffle = async ({
  sellerId,
  raffleId,
  payload,
}: UpdateSellerRaffleInput): Promise<RaffleRow | null> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const [updated] = await db
      .update(raffles)
      .set({
        ...payload,
        pricePerNumber:
          payload.pricePerNumber === undefined ? undefined : toMoneyString(payload.pricePerNumber),
        drawDate: payload.drawDate === undefined ? undefined : toNullableDate(payload.drawDate),
        updatedAt: new Date(),
      })
      .where(and(eq(raffles.sellerId, sellerId), eq(raffles.id, raffleId)))
      .returning();

    if (!updated) {
      return null;
    }

    await db.insert(auditLogs).values({
      id: randomUUID(),
      sellerId,
      entityType: 'raffle',
      entityId: raffleId,
      action: 'raffle_updated',
      afterData: { ...payload },
    });

    return updated;
  } finally {
    await client.close();
  }
};

export const activateSellerRaffle = async ({
  sellerId,
  raffleId,
}: RaffleIdInput): Promise<RaffleRow | null> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    return await db.transaction(async (transaction) => {
      const [target] = await transaction
        .select()
        .from(raffles)
        .where(and(eq(raffles.sellerId, sellerId), eq(raffles.id, raffleId)))
        .limit(1);

      if (!target) {
        return null;
      }

      await transaction
        .update(raffles)
        .set({ status: RAFFLE_STATUSES.paused, updatedAt: new Date() })
        .where(and(eq(raffles.sellerId, sellerId), eq(raffles.status, RAFFLE_STATUSES.active)));

      const [activated] = await transaction
        .update(raffles)
        .set({ status: RAFFLE_STATUSES.active, updatedAt: new Date() })
        .where(and(eq(raffles.sellerId, sellerId), eq(raffles.id, raffleId)))
        .returning();

      if (activated) {
        await transaction.insert(auditLogs).values({
          id: randomUUID(),
          sellerId,
          entityType: 'raffle',
          entityId: raffleId,
          action: 'raffle_updated',
          afterData: { status: RAFFLE_STATUSES.active, isLiveCampaign: true },
        });
      }

      return activated ?? null;
    });
  } finally {
    await client.close();
  }
};

export const getSellerActiveRaffle = async ({
  sellerId,
}: SellerScopeInput): Promise<RaffleRow | null> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const [raffle] = await db
      .select()
      .from(raffles)
      .where(and(eq(raffles.sellerId, sellerId), eq(raffles.status, RAFFLE_STATUSES.active)))
      .orderBy(desc(raffles.updatedAt))
      .limit(1);

    return raffle ? applySellerDefaultsToRaffle(raffle) : null;
  } finally {
    await client.close();
  }
};

export const getPublicActiveRaffleBySlug = async (slug: string): Promise<RaffleRow | null> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const [raffle] = await db
      .select()
      .from(raffles)
      .where(and(eq(raffles.slug, slug), eq(raffles.status, 'active')))
      .limit(1);

    return raffle ? applySellerDefaultsToRaffle(raffle) : null;
  } finally {
    await client.close();
  }
};

export const getPublicCurrentActiveRaffle = async (): Promise<RaffleRow | null> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const [raffle] = await db
      .select()
      .from(raffles)
      .where(eq(raffles.status, 'active'))
      .orderBy(desc(raffles.updatedAt))
      .limit(1);

    return raffle ? applySellerDefaultsToRaffle(raffle) : null;
  } finally {
    await client.close();
  }
};

export const listPublicRaffleNumbersBySlug = async (
  slug: string,
): Promise<readonly PublicRaffleNumberRow[] | null> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const raffle = await getPublicActiveRaffleBySlug(slug);

    if (!raffle) {
      return null;
    }

    return await db
      .select({
        id: raffleNumbers.id,
        number: raffleNumbers.number,
        displayNumber: raffleNumbers.displayNumber,
        status: raffleNumbers.status,
      })
      .from(raffleNumbers)
      .where(eq(raffleNumbers.raffleId, raffle.id))
      .orderBy(asc(raffleNumbers.number));
  } finally {
    await client.close();
  }
};

export const createPublicOrderForRaffle = async ({
  slug,
  payload,
}: CreatePublicOrderInput): Promise<PublicOrderResult | null> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    return await db.transaction(async (transaction) => {
      const [raffle] = await transaction
        .select()
        .from(raffles)
        .where(and(eq(raffles.slug, slug), eq(raffles.status, 'active')))
        .limit(1);

      if (!raffle) {
        return null;
      }

      const selectedNumbers = payload.selectedNumbers ?? [];
      const numbersRequested =
        raffle.assignmentMode === ASSIGNMENT_MODES.customerChoice
          ? selectedNumbers.length
          : (payload.numbersRequested ?? 0);

      if (numbersRequested <= 0) {
        throw new Error('At least one number is required');
      }

      if (
        raffle.assignmentMode === ASSIGNMENT_MODES.customerChoice &&
        selectedNumbers.length === 0
      ) {
        throw new Error('selectedNumbers is required for this raffle');
      }

      if (raffle.assignmentMode === ASSIGNMENT_MODES.random && selectedNumbers.length > 0) {
        throw new Error('selectedNumbers is not allowed for random raffle assignment');
      }

      const customerId = randomUUID();
      const orderId = randomUUID();
      const amount = Number(raffle.pricePerNumber) * numbersRequested;

      await transaction.insert(customers).values({
        id: customerId,
        sellerId: raffle.sellerId,
        fullName: payload.fullName,
        documentType: payload.documentType,
        documentNumber: payload.documentNumber,
        email: payload.email,
        phone: payload.phone,
        city: payload.city,
        acceptedTermsAt: new Date(),
        isAdultConfirmed: payload.isAdultConfirmed,
      });

      const [order] = await transaction
        .insert(orders)
        .values({
          id: orderId,
          sellerId: raffle.sellerId,
          raffleId: raffle.id,
          customerId,
          status: ORDER_STATUSES.pendingReview,
          amount: toMoneyString(amount),
          currency: raffle.currency,
          numbersRequested,
        })
        .returning();

      if (!order) {
        throw new Error('Order was not created');
      }

      let reservedNumbers: readonly PublicRaffleNumberRow[] = [];

      if (raffle.assignmentMode === ASSIGNMENT_MODES.customerChoice) {
        const availableNumbers = await transaction
          .select({
            id: raffleNumbers.id,
            number: raffleNumbers.number,
            displayNumber: raffleNumbers.displayNumber,
            status: raffleNumbers.status,
          })
          .from(raffleNumbers)
          .where(
            and(
              eq(raffleNumbers.raffleId, raffle.id),
              eq(raffleNumbers.status, RAFFLE_NUMBER_STATUSES.available),
              inArray(raffleNumbers.number, [...selectedNumbers]),
            ),
          )
          .orderBy(asc(raffleNumbers.number));

        if (availableNumbers.length !== selectedNumbers.length) {
          throw new Error('One or more selected numbers are no longer available');
        }

        await transaction
          .update(raffleNumbers)
          .set({
            status: RAFFLE_NUMBER_STATUSES.reserved,
            reservedByOrderId: orderId,
            reservedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            inArray(
              raffleNumbers.id,
              availableNumbers.map((number) => number.id),
            ),
          );

        await transaction.insert(orderNumbers).values(
          availableNumbers.map((number) => ({
            id: randomUUID(),
            orderId,
            raffleNumberId: number.id,
            number: number.number,
            displayNumber: number.displayNumber,
            status: RAFFLE_NUMBER_STATUSES.reserved,
          })),
        );

        reservedNumbers = availableNumbers.map((number) => ({
          ...number,
          status: RAFFLE_NUMBER_STATUSES.reserved,
        }));
      }

      await transaction.insert(auditLogs).values({
        id: randomUUID(),
        sellerId: raffle.sellerId,
        entityType: 'order',
        entityId: orderId,
        action: 'order_created',
        afterData: {
          raffleId: raffle.id,
          orderId,
          numbersRequested,
          selectedNumbers,
        },
      });

      return {
        order,
        reservedNumbers,
      };
    });
  } finally {
    await client.close();
  }
};
