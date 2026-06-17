import { randomUUID } from 'node:crypto';

import { ORDER_STATUSES, RAFFLE_NUMBER_STATUSES } from '@rifa/shared';
import type { ParticipationPackage } from '@rifa/shared';
import { and, desc, eq, inArray } from 'drizzle-orm';

import { createLocalPgliteDatabase } from './client';
import { pickRandomAvailableNumbers, formatRaffleDisplayNumber } from './raffles';
import { auditLogs, customers, orderNumbers, orders, raffleNumbers, raffles } from './schema';

interface AttachPaymentProofInput {
  readonly orderId: string;
  readonly proofUrl: string;
  readonly storageKey: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

type OrderRow = typeof orders.$inferSelect;

interface SellerOrderInput {
  readonly sellerId: string;
  readonly orderId: string;
}

interface RejectSellerOrderInput extends SellerOrderInput {
  readonly reason: string;
}

interface OrderDetail {
  readonly order: OrderRow;
  readonly customer: typeof customers.$inferSelect;
  readonly raffle: Pick<typeof raffles.$inferSelect, 'id' | 'title' | 'slug' | 'assignmentMode'>;
  readonly numbers: readonly (typeof orderNumbers.$inferSelect)[];
}

type OrderListRow = Pick<
  OrderRow,
  | 'id'
  | 'raffleId'
  | 'customerId'
  | 'status'
  | 'amount'
  | 'currency'
  | 'numbersRequested'
  | 'paymentProofUrl'
  | 'paymentProofStorageKey'
  | 'paymentProofMimeType'
  | 'paymentProofSizeBytes'
  | 'paymentProofUploadedAt'
  | 'createdAt'
> & {
  readonly customerName: string;
  readonly customerEmail: string;
  readonly customerPhone: string;
  readonly raffleTitle: string;
  readonly raffleSlug: string;
};

export const listSellerOrders = async (sellerId: string): Promise<readonly OrderListRow[]> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    return await db
      .select({
        id: orders.id,
        raffleId: orders.raffleId,
        customerId: orders.customerId,
        status: orders.status,
        amount: orders.amount,
        currency: orders.currency,
        numbersRequested: orders.numbersRequested,
        paymentProofUrl: orders.paymentProofUrl,
        paymentProofStorageKey: orders.paymentProofStorageKey,
        paymentProofMimeType: orders.paymentProofMimeType,
        paymentProofSizeBytes: orders.paymentProofSizeBytes,
        paymentProofUploadedAt: orders.paymentProofUploadedAt,
        createdAt: orders.createdAt,
        customerName: customers.fullName,
        customerEmail: customers.email,
        customerPhone: customers.phone,
        raffleTitle: raffles.title,
        raffleSlug: raffles.slug,
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .innerJoin(raffles, eq(orders.raffleId, raffles.id))
      .where(eq(orders.sellerId, sellerId))
      .orderBy(desc(orders.createdAt));
  } finally {
    await client.close();
  }
};

export const getSellerOrderDetail = async ({
  sellerId,
  orderId,
}: SellerOrderInput): Promise<OrderDetail | null> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const [row] = await db
      .select({
        order: orders,
        customer: customers,
        raffle: {
          id: raffles.id,
          title: raffles.title,
          slug: raffles.slug,
          assignmentMode: raffles.assignmentMode,
        },
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .innerJoin(raffles, eq(orders.raffleId, raffles.id))
      .where(and(eq(orders.sellerId, sellerId), eq(orders.id, orderId)))
      .limit(1);

    if (!row) {
      return null;
    }

    const numbers = await db.select().from(orderNumbers).where(eq(orderNumbers.orderId, orderId));

    return {
      order: row.order,
      customer: row.customer,
      raffle: row.raffle,
      numbers,
    };
  } finally {
    await client.close();
  }
};

export const attachPaymentProofToOrder = async ({
  orderId,
  proofUrl,
  storageKey,
  mimeType,
  sizeBytes,
}: AttachPaymentProofInput): Promise<OrderRow | null> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const [updated] = await db
      .update(orders)
      .set({
        paymentProofUrl: proofUrl,
        paymentProofStorageKey: storageKey,
        paymentProofMimeType: mimeType,
        paymentProofSizeBytes: sizeBytes,
        paymentProofUploadedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    if (!updated) {
      return null;
    }

    await db.insert(auditLogs).values({
      id: randomUUID(),
      sellerId: updated.sellerId,
      entityType: 'order',
      entityId: orderId,
      action: 'proof_uploaded',
      afterData: {
        storageKey,
        mimeType,
        sizeBytes,
      },
    });

    return updated;
  } finally {
    await client.close();
  }
};

export const approveSellerOrder = async ({
  sellerId,
  orderId,
}: SellerOrderInput): Promise<OrderDetail | null> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    await db.transaction(async (transaction) => {
      const [row] = await transaction
        .select({ order: orders, raffle: raffles })
        .from(orders)
        .innerJoin(raffles, eq(orders.raffleId, raffles.id))
        .where(and(eq(orders.sellerId, sellerId), eq(orders.id, orderId)))
        .limit(1);

      if (!row) {
        return;
      }

      if (row.order.status !== ORDER_STATUSES.pendingReview) {
        throw new Error('Order is not pending review');
      }

      if (!row.order.paymentProofStorageKey) {
        throw new Error('Order cannot be approved without payment proof');
      }

      // With lazy allocation the numbers are already reserved at order time, so
      // approving simply promotes the reserved numbers to "assigned".
      const reservedNumbers = await transaction
        .select()
        .from(orderNumbers)
        .where(eq(orderNumbers.orderId, orderId));

      if (reservedNumbers.length !== row.order.numbersRequested) {
        throw new Error('Reserved number count does not match order request');
      }

      await transaction
        .update(raffleNumbers)
        .set({
          status: RAFFLE_NUMBER_STATUSES.assigned,
          assignedToOrderId: orderId,
          assignedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          inArray(
            raffleNumbers.id,
            reservedNumbers.map((number) => number.raffleNumberId),
          ),
        );

      await transaction
        .update(orderNumbers)
        .set({ status: RAFFLE_NUMBER_STATUSES.assigned, updatedAt: new Date() })
        .where(eq(orderNumbers.orderId, orderId));

      await transaction
        .update(orders)
        .set({ status: ORDER_STATUSES.paid, reviewedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(orders.sellerId, sellerId), eq(orders.id, orderId)));

      await transaction.insert(auditLogs).values({
        id: randomUUID(),
        sellerId,
        entityType: 'order',
        entityId: orderId,
        action: 'order_approved',
        afterData: {
          status: ORDER_STATUSES.paid,
          assignmentMode: row.raffle.assignmentMode,
        },
      });
    });

    return getSellerOrderDetail({ sellerId, orderId });
  } finally {
    await client.close();
  }
};

export const rejectSellerOrder = async ({
  sellerId,
  orderId,
  reason,
}: RejectSellerOrderInput): Promise<OrderDetail | null> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    await db.transaction(async (transaction) => {
      const [order] = await transaction
        .select()
        .from(orders)
        .where(and(eq(orders.sellerId, sellerId), eq(orders.id, orderId)))
        .limit(1);

      if (!order) {
        return;
      }

      if (order.status !== ORDER_STATUSES.pendingReview) {
        throw new Error('Order is not pending review');
      }

      const reservedNumbers = await transaction
        .select()
        .from(orderNumbers)
        .where(eq(orderNumbers.orderId, orderId));

      if (reservedNumbers.length > 0) {
        // Lazy allocation: freeing a number means deleting its row, so it goes
        // back to "available" (no row = available). order_numbers references
        // raffle_numbers with ON DELETE RESTRICT, so we MUST delete the
        // order_numbers rows first, then the raffle_numbers rows.
        await transaction.delete(orderNumbers).where(eq(orderNumbers.orderId, orderId));

        await transaction.delete(raffleNumbers).where(
          inArray(
            raffleNumbers.id,
            reservedNumbers.map((number) => number.raffleNumberId),
          ),
        );
      }

      await transaction
        .update(orders)
        .set({
          status: ORDER_STATUSES.rejected,
          rejectionReason: reason,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(orders.sellerId, sellerId), eq(orders.id, orderId)));

      await transaction.insert(auditLogs).values({
        id: randomUUID(),
        sellerId,
        entityType: 'order',
        entityId: orderId,
        action: 'order_rejected',
        afterData: {
          status: ORDER_STATUSES.rejected,
          reason,
          releasedNumbers: reservedNumbers.length,
        },
      });
    });

    return getSellerOrderDetail({ sellerId, orderId });
  } finally {
    await client.close();
  }
};

interface ManualOrderProofInput {
  readonly proofUrl: string;
  readonly storageKey: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

interface CreateManualOrderInput {
  readonly sellerId: string;
  readonly raffleId?: string | undefined;
  readonly fullName: string;
  readonly documentType?: string | undefined;
  readonly documentNumber: string;
  readonly email: string;
  readonly phone: string;
  readonly city?: string | undefined;
  readonly numbersRequested?: number | undefined;
  readonly selectedNumbers?: readonly number[] | undefined;
  readonly proof?: ManualOrderProofInput | undefined;
}

const toMoneyString2 = (value: number): string => value.toFixed(2);

const resolveManualAmount = (
  pricePerNumber: string,
  packages: readonly ParticipationPackage[] | undefined,
  quantity: number,
): number => {
  const match = (packages ?? []).find(
    (item) => Math.trunc(Number(item.quantity)) === quantity && Number(item.price) > 0,
  );

  if (match?.price !== undefined) {
    return Number(match.price);
  }

  return Number(pricePerNumber) * quantity;
};

/**
 * Creates an order entered manually by an admin who already verified the
 * payment. The order is created as PAID with its numbers assigned immediately,
 * and the uploaded proof (if any) is attached. Used for the "compra manual"
 * admin flow. Returns the full order detail so the API can notify + broadcast.
 */
export const createManualSellerOrder = async (
  input: CreateManualOrderInput,
): Promise<OrderDetail | null> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const orderId = await db.transaction(async (transaction) => {
      const raffleConditions = input.raffleId
        ? and(eq(raffles.sellerId, input.sellerId), eq(raffles.id, input.raffleId))
        : and(eq(raffles.sellerId, input.sellerId), eq(raffles.status, 'active'));

      const [raffle] = await transaction
        .select()
        .from(raffles)
        .where(raffleConditions)
        .orderBy(desc(raffles.updatedAt))
        .limit(1);

      if (!raffle) {
        return null;
      }

      const selectedNumbers = input.selectedNumbers ?? [];
      const quantity = selectedNumbers.length > 0 ? selectedNumbers.length : (input.numbersRequested ?? 0);

      if (quantity <= 0) {
        throw new Error('At least one number is required');
      }

      // Lazy allocation: load taken numbers, then either validate the explicit
      // selection or pick random numbers across the whole range.
      const takenRows = await transaction
        .select({ number: raffleNumbers.number })
        .from(raffleNumbers)
        .where(eq(raffleNumbers.raffleId, raffle.id));
      const taken = new Set<number>(takenRows.map((row) => row.number));

      let targetNumbers: readonly { id: string; number: number; displayNumber: string }[];

      if (selectedNumbers.length > 0) {
        for (const number of selectedNumbers) {
          if (number < raffle.numberMin || number > raffle.numberMax) {
            throw new Error('A selected number is out of range');
          }
          if (taken.has(number)) {
            throw new Error('One or more selected numbers are no longer available');
          }
        }
        targetNumbers = selectedNumbers.map((number) => ({
          id: randomUUID(),
          number,
          displayNumber: formatRaffleDisplayNumber(number, raffle.numberPadding),
        }));
      } else {
        targetNumbers = pickRandomAvailableNumbers(
          raffle.numberMin,
          raffle.numberMax,
          raffle.numberPadding,
          quantity,
          taken,
        );
      }

      const customerId = randomUUID();
      const newOrderId = randomUUID();
      const amount = resolveManualAmount(
        raffle.pricePerNumber,
        raffle.landingConfig?.participationPackages,
        quantity,
      );

      await transaction.insert(customers).values({
        id: customerId,
        sellerId: input.sellerId,
        fullName: input.fullName,
        documentType: input.documentType,
        documentNumber: input.documentNumber,
        email: input.email,
        phone: input.phone,
        city: input.city,
        acceptedTermsAt: new Date(),
        isAdultConfirmed: true,
      });

      await transaction.insert(orders).values({
        id: newOrderId,
        sellerId: input.sellerId,
        raffleId: raffle.id,
        customerId,
        status: ORDER_STATUSES.paid,
        amount: toMoneyString2(amount),
        currency: raffle.currency,
        numbersRequested: quantity,
        reviewedAt: new Date(),
        adminNotes: 'Compra registrada manualmente por el administrador.',
        ...(input.proof
          ? {
              paymentProofUrl: input.proof.proofUrl,
              paymentProofStorageKey: input.proof.storageKey,
              paymentProofMimeType: input.proof.mimeType,
              paymentProofSizeBytes: input.proof.sizeBytes,
              paymentProofUploadedAt: new Date(),
            }
          : {}),
      });

      // Lazy allocation: materialize the numbers directly as assigned.
      await transaction.insert(raffleNumbers).values(
        targetNumbers.map((number) => ({
          id: number.id,
          raffleId: raffle.id,
          number: number.number,
          displayNumber: number.displayNumber,
          status: RAFFLE_NUMBER_STATUSES.assigned,
          assignedToOrderId: newOrderId,
          assignedAt: new Date(),
        })),
      );

      await transaction.insert(orderNumbers).values(
        targetNumbers.map((number) => ({
          id: randomUUID(),
          orderId: newOrderId,
          raffleNumberId: number.id,
          number: number.number,
          displayNumber: number.displayNumber,
          status: RAFFLE_NUMBER_STATUSES.assigned,
        })),
      );

      await transaction.insert(auditLogs).values({
        id: randomUUID(),
        sellerId: input.sellerId,
        entityType: 'order',
        entityId: newOrderId,
        action: 'order_approved',
        afterData: {
          status: ORDER_STATUSES.paid,
          manual: true,
          numbersAssigned: targetNumbers.length,
        },
      });

      return newOrderId;
    });

    if (!orderId) {
      return null;
    }

    return getSellerOrderDetail({ sellerId: input.sellerId, orderId });
  } finally {
    await client.close();
  }
};
