import { randomUUID } from 'node:crypto';

import { ORDER_STATUSES, RAFFLE_NUMBER_STATUSES, RAFFLE_STATUSES } from '@rifa/shared';
import type {
  AssignmentMode,
  ParticipationPackage,
  RaffleLandingConfig,
  RaffleStatus,
} from '@rifa/shared';
import { and, asc, desc, eq, inArray, isNull, lt } from 'drizzle-orm';

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
  readonly orderId?: string;
  readonly proof?: PublicOrderProofInput;
}

export interface PublicOrderProofInput {
  readonly proofUrl: string;
  readonly storageKey: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
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

const normalizeParticipationPackages = (
  packages: readonly ParticipationPackage[] | undefined,
): readonly ParticipationPackage[] => {
  const seenQuantities = new Set<number>();

  return (packages ?? [])
    .map((item) => ({
      label: item.label?.trim(),
      quantity: Math.trunc(Number(item.quantity)),
      price: item.price === undefined ? undefined : Number(item.price),
    }))
    .filter((item) => Number.isFinite(item.quantity) && item.quantity >= 1 && item.quantity <= 100)
    .filter((item) => {
      if (seenQuantities.has(item.quantity)) {
        return false;
      }

      seenQuantities.add(item.quantity);
      return true;
    })
    .map((item) => ({
      quantity: item.quantity,
      ...(item.label ? { label: item.label } : {}),
      ...(Number.isFinite(item.price) && Number(item.price) > 0 ? { price: Number(item.price) } : {}),
    }));
};

const getOrderAmount = (raffle: RaffleRow, numbersRequested: number): number => {
  const packages = normalizeParticipationPackages(raffle.landingConfig?.participationPackages);
  const packageMatch = packages.find((item) => item.quantity === numbersRequested);

  if (packages.length > 0 && !packageMatch) {
    throw new Error('Selected package is not available');
  }

  if (packageMatch?.price !== undefined) {
    return packageMatch.price;
  }

  return Number(raffle.pricePerNumber) * numbersRequested;
};

export interface AllocatedNumber {
  readonly id: string;
  readonly number: number;
  readonly displayNumber: string;
}

export const formatRaffleDisplayNumber = (value: number, padding: number): string =>
  displayNumber(value, padding);

// Picks `quantity` distinct numbers at random across the whole [min, max]
// range, skipping any number already taken. Uses rejection sampling (fast when
// the raffle is far from full) with a deterministic scan fallback for raffles
// that are nearly sold out. `takenNumbers` must contain every number that is
// currently reserved/assigned/blocked.
export const pickRandomAvailableNumbers = (
  min: number,
  max: number,
  padding: number,
  quantity: number,
  takenNumbers: ReadonlySet<number>,
): readonly AllocatedNumber[] => {
  const total = max - min + 1;
  const available = total - takenNumbers.size;

  if (available < quantity) {
    throw new Error('Not enough available numbers');
  }

  const chosen = new Set<number>();
  const maxAttempts = quantity * 40 + 2_000;
  let attempts = 0;

  while (chosen.size < quantity && attempts < maxAttempts) {
    const candidate = min + Math.floor(Math.random() * total);
    if (!takenNumbers.has(candidate) && !chosen.has(candidate)) {
      chosen.add(candidate);
    }
    attempts += 1;
  }

  if (chosen.size < quantity) {
    // Fallback for nearly-full raffles: scan the range for free numbers.
    for (let number = min; number <= max && chosen.size < quantity; number += 1) {
      if (!takenNumbers.has(number) && !chosen.has(number)) {
        chosen.add(number);
      }
    }
  }

  return [...chosen].map((number) => ({
    id: randomUUID(),
    number,
    displayNumber: displayNumber(number, padding),
  }));
};

/**
 * Releases number reservations that have expired. A reservation expires when an
 * order is still pending review, has NO payment proof uploaded, and was created
 * longer ago than the raffle's reservationTtlMinutes. The reserved numbers are
 * freed (their rows are deleted, returning to "available") and the order is
 * marked as expired. Orders that already uploaded a proof are NEVER expired —
 * they keep their numbers until the admin approves or rejects them.
 */
export const releaseExpiredReservations = async (raffleId: string): Promise<number> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const [raffle] = await db
      .select({ id: raffles.id, ttl: raffles.reservationTtlMinutes })
      .from(raffles)
      .where(eq(raffles.id, raffleId))
      .limit(1);

    if (!raffle) {
      return 0;
    }

    const cutoff = new Date(Date.now() - raffle.ttl * 60_000);

    return await db.transaction(async (transaction) => {
      const expiredOrders = await transaction
        .select({ id: orders.id })
        .from(orders)
        .where(
          and(
            eq(orders.raffleId, raffleId),
            eq(orders.status, ORDER_STATUSES.pendingReview),
            isNull(orders.paymentProofStorageKey),
            lt(orders.createdAt, cutoff),
          ),
        );

      if (expiredOrders.length === 0) {
        return 0;
      }

      const expiredIds = expiredOrders.map((order) => order.id);

      await transaction.delete(orderNumbers).where(inArray(orderNumbers.orderId, expiredIds));
      await transaction
        .delete(raffleNumbers)
        .where(
          and(
            eq(raffleNumbers.raffleId, raffleId),
            inArray(raffleNumbers.reservedByOrderId, expiredIds),
          ),
        );
      await transaction
        .update(orders)
        .set({ status: ORDER_STATUSES.expired, updatedAt: new Date() })
        .where(inArray(orders.id, expiredIds));

      return expiredIds.length;
    });
  } finally {
    await client.close();
  }
};

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

// Padding is derived from the highest number's digit count so the displayed
// numbers always have a consistent width (e.g. a raffle of 0..9999 renders
// "0099" for number 99). The manual padding acts only as a minimum floor.
const derivePadding = (numberMax: number, requestedPadding: number): number =>
  Math.max(requestedPadding || 1, String(Math.max(Math.trunc(numberMax), 0)).length);

export const createSellerRaffle = async ({
  sellerId,
  payload,
}: CreateSellerRaffleInput): Promise<RaffleRow> => {
  const { client, db } = createLocalPgliteDatabase();
  const raffleId = randomUUID();
  const numberPadding = derivePadding(payload.numberMax, payload.numberPadding);

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
          numberPadding,
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

      // Lazy allocation: we do NOT pre-create a row per number. Numbers only
      // become rows in raffle_numbers when they are actually taken (reserved,
      // assigned or blocked). Availability is computed as (range - taken).
      // This makes raffles of up to 1,000,000 numbers cheap to create.

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
  const raffle = await getPublicActiveRaffleBySlug(slug);

  if (!raffle) {
    return null;
  }

  // Free any expired reservations so availability is up to date. With lazy
  // allocation only taken numbers exist as rows, so this returns just the
  // reserved/assigned/blocked numbers.
  await releaseExpiredReservations(raffle.id);

  const { client, db } = createLocalPgliteDatabase();

  try {
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

export interface PublicRaffleStats {
  readonly total: number;
  readonly assigned: number;
  readonly reserved: number;
  readonly blocked: number;
  readonly available: number;
}

export const getPublicRaffleStatsBySlug = async (
  slug: string,
): Promise<PublicRaffleStats | null> => {
  const raffle = await getPublicActiveRaffleBySlug(slug);

  if (!raffle) {
    return null;
  }

  await releaseExpiredReservations(raffle.id);

  const { client, db } = createLocalPgliteDatabase();

  try {
    const rows = await db
      .select({ status: raffleNumbers.status })
      .from(raffleNumbers)
      .where(eq(raffleNumbers.raffleId, raffle.id));

    const total = raffle.numberMax - raffle.numberMin + 1;
    const assigned = rows.filter((row) => row.status === RAFFLE_NUMBER_STATUSES.assigned).length;
    const reserved = rows.filter((row) => row.status === RAFFLE_NUMBER_STATUSES.reserved).length;
    const blocked = rows.filter((row) => row.status === RAFFLE_NUMBER_STATUSES.blocked).length;
    const available = Math.max(0, total - rows.length);

    return { total, assigned, reserved, blocked, available };
  } finally {
    await client.close();
  }
};

export const createPublicOrderForRaffle = async ({
  slug,
  payload,
  orderId: providedOrderId,
  proof,
}: CreatePublicOrderInput): Promise<PublicOrderResult | null> => {
  // Get the raffle id first so we can release expired reservations before
  // computing availability.
  const preRaffle = await getPublicActiveRaffleBySlug(slug);

  if (!preRaffle) {
    return null;
  }

  await releaseExpiredReservations(preRaffle.id);

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
        selectedNumbers.length > 0 ? selectedNumbers.length : (payload.numbersRequested ?? 0);

      if (numbersRequested <= 0) {
        throw new Error('At least one number is required');
      }

      // Load currently taken numbers (reserved/assigned/blocked) for this raffle.
      const takenRows = await transaction
        .select({ number: raffleNumbers.number })
        .from(raffleNumbers)
        .where(eq(raffleNumbers.raffleId, raffle.id));
      const taken = new Set<number>(takenRows.map((row) => row.number));

      // Decide which numbers to reserve: explicit selection or random.
      let allocated: readonly AllocatedNumber[];

      if (selectedNumbers.length > 0) {
        for (const number of selectedNumbers) {
          if (number < raffle.numberMin || number > raffle.numberMax) {
            throw new Error('A selected number is out of range');
          }
          if (taken.has(number)) {
            throw new Error('One or more selected numbers are no longer available');
          }
        }
        allocated = selectedNumbers.map((number) => ({
          id: randomUUID(),
          number,
          displayNumber: displayNumber(number, raffle.numberPadding),
        }));
      } else {
        allocated = pickRandomAvailableNumbers(
          raffle.numberMin,
          raffle.numberMax,
          raffle.numberPadding,
          numbersRequested,
          taken,
        );
      }

      const customerId = randomUUID();
      const orderId = providedOrderId ?? randomUUID();
      const amount = getOrderAmount(raffle, numbersRequested);

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
          ...(proof
            ? {
                paymentProofUrl: proof.proofUrl,
                paymentProofStorageKey: proof.storageKey,
                paymentProofMimeType: proof.mimeType,
                paymentProofSizeBytes: proof.sizeBytes,
                paymentProofUploadedAt: new Date(),
              }
            : {}),
        })
        .returning();

      if (!order) {
        throw new Error('Order was not created');
      }

      // Materialize the reserved numbers (lazy allocation).
      await transaction.insert(raffleNumbers).values(
        allocated.map((item) => ({
          id: item.id,
          raffleId: raffle.id,
          number: item.number,
          displayNumber: item.displayNumber,
          status: RAFFLE_NUMBER_STATUSES.reserved,
          reservedByOrderId: orderId,
          reservedAt: new Date(),
        })),
      );

      await transaction.insert(orderNumbers).values(
        allocated.map((item) => ({
          id: randomUUID(),
          orderId,
          raffleNumberId: item.id,
          number: item.number,
          displayNumber: item.displayNumber,
          status: RAFFLE_NUMBER_STATUSES.reserved,
        })),
      );

      const reservedNumbers: readonly PublicRaffleNumberRow[] = allocated.map((item) => ({
        id: item.id,
        number: item.number,
        displayNumber: item.displayNumber,
        status: RAFFLE_NUMBER_STATUSES.reserved,
      }));

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
          numbers: allocated.map((item) => item.number),
        },
      });

      if (proof) {
        await transaction.insert(auditLogs).values({
          id: randomUUID(),
          sellerId: raffle.sellerId,
          entityType: 'order',
          entityId: orderId,
          action: 'proof_uploaded',
          afterData: {
            storageKey: proof.storageKey,
            mimeType: proof.mimeType,
            sizeBytes: proof.sizeBytes,
          },
        });
      }

      return {
        order,
        reservedNumbers,
      };
    });
  } finally {
    await client.close();
  }
};
