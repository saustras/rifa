import { and, count, desc, eq } from 'drizzle-orm';

import { createLocalPgliteDatabase } from './client';
import { auditLogs, customers, notificationLogs, orders, raffleNumbers, raffles } from './schema';

interface SellerScopeInput {
  readonly sellerId: string;
}

interface RaffleScopeInput extends SellerScopeInput {
  readonly raffleId: string;
}

export interface SellerCustomerRow {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly documentNumber: string;
  readonly city: string | null;
  readonly createdAt: Date;
  readonly ordersCount: number;
}

export interface SellerRaffleNumberRow {
  readonly id: string;
  readonly number: number;
  readonly displayNumber: string;
  readonly status: string;
  readonly reservedByOrderId: string | null;
  readonly assignedToOrderId: string | null;
}

export interface SellerAuditLogRow {
  readonly id: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly action: string;
  readonly createdAt: Date;
  readonly afterData: Record<string, unknown> | null;
}

export interface SellerNotificationLogRow {
  readonly id: string;
  readonly orderId: string | null;
  readonly channel: string;
  readonly type: string;
  readonly recipient: string;
  readonly status: string;
  readonly errorMessage: string | null;
  readonly createdAt: Date;
}

export const listSellerCustomers = async ({
  sellerId,
}: SellerScopeInput): Promise<readonly SellerCustomerRow[]> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const rows = await db
      .select({
        id: customers.id,
        fullName: customers.fullName,
        email: customers.email,
        phone: customers.phone,
        documentNumber: customers.documentNumber,
        city: customers.city,
        createdAt: customers.createdAt,
        ordersCount: count(orders.id),
      })
      .from(customers)
      .leftJoin(orders, eq(orders.customerId, customers.id))
      .where(eq(customers.sellerId, sellerId))
      .groupBy(
        customers.id,
        customers.fullName,
        customers.email,
        customers.phone,
        customers.documentNumber,
        customers.city,
        customers.createdAt,
      )
      .orderBy(desc(customers.createdAt));

    return rows.map((row) => ({
      ...row,
      ordersCount: Number(row.ordersCount),
    }));
  } finally {
    await client.close();
  }
};

export const listSellerRaffleNumbers = async ({
  sellerId,
  raffleId,
}: RaffleScopeInput): Promise<readonly SellerRaffleNumberRow[] | null> => {
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

    return await db
      .select({
        id: raffleNumbers.id,
        number: raffleNumbers.number,
        displayNumber: raffleNumbers.displayNumber,
        status: raffleNumbers.status,
        reservedByOrderId: raffleNumbers.reservedByOrderId,
        assignedToOrderId: raffleNumbers.assignedToOrderId,
      })
      .from(raffleNumbers)
      .where(eq(raffleNumbers.raffleId, raffleId))
      .orderBy(raffleNumbers.number);
  } finally {
    await client.close();
  }
};

export const listSellerAuditLogs = async ({
  sellerId,
}: SellerScopeInput): Promise<readonly SellerAuditLogRow[]> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    return await db
      .select({
        id: auditLogs.id,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        action: auditLogs.action,
        createdAt: auditLogs.createdAt,
        afterData: auditLogs.afterData,
      })
      .from(auditLogs)
      .where(eq(auditLogs.sellerId, sellerId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(200);
  } finally {
    await client.close();
  }
};

export const listSellerNotificationLogs = async ({
  sellerId,
}: SellerScopeInput): Promise<readonly SellerNotificationLogRow[]> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    return await db
      .select({
        id: notificationLogs.id,
        orderId: notificationLogs.orderId,
        channel: notificationLogs.channel,
        type: notificationLogs.type,
        recipient: notificationLogs.recipient,
        status: notificationLogs.status,
        errorMessage: notificationLogs.errorMessage,
        createdAt: notificationLogs.createdAt,
      })
      .from(notificationLogs)
      .where(eq(notificationLogs.sellerId, sellerId))
      .orderBy(desc(notificationLogs.createdAt))
      .limit(200);
  } finally {
    await client.close();
  }
};
