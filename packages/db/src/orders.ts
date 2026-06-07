import { randomUUID } from 'node:crypto';

import { ASSIGNMENT_MODES, ORDER_STATUSES, RAFFLE_NUMBER_STATUSES } from '@rifa/shared';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import { createLocalPgliteDatabase } from './client';
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

      if (row.raffle.assignmentMode === ASSIGNMENT_MODES.customerChoice) {
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
      }

      if (row.raffle.assignmentMode === ASSIGNMENT_MODES.random) {
        const availableNumbers = await transaction
          .select({
            id: raffleNumbers.id,
            number: raffleNumbers.number,
            displayNumber: raffleNumbers.displayNumber,
          })
          .from(raffleNumbers)
          .where(
            and(
              eq(raffleNumbers.raffleId, row.raffle.id),
              eq(raffleNumbers.status, RAFFLE_NUMBER_STATUSES.available),
            ),
          )
          .orderBy(asc(raffleNumbers.number))
          .limit(row.order.numbersRequested);

        if (availableNumbers.length !== row.order.numbersRequested) {
          throw new Error('Not enough available numbers to approve order');
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
            status: RAFFLE_NUMBER_STATUSES.assigned,
          })),
        );
      }

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
        await transaction
          .update(raffleNumbers)
          .set({
            status: RAFFLE_NUMBER_STATUSES.available,
            reservedByOrderId: null,
            reservedAt: null,
            updatedAt: new Date(),
          })
          .where(
            inArray(
              raffleNumbers.id,
              reservedNumbers.map((number) => number.raffleNumberId),
            ),
          );

        await transaction.delete(orderNumbers).where(eq(orderNumbers.orderId, orderId));
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
