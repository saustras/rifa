import { and, count, desc, eq } from 'drizzle-orm';

import { createLocalPgliteDatabase } from './client';
import { releaseExpiredReservations } from './raffles';
import {
  auditLogs,
  customers,
  notificationLogs,
  orderNumbers,
  orders,
  raffleNumbers,
  raffles,
} from './schema';

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
  readonly orderId: string | null;
  readonly orderAmount: string | null;
  readonly orderCurrency: string | null;
  readonly orderCreatedAt: Date | null;
  readonly orderStatus: string | null;
  readonly customerName: string | null;
  readonly customerEmail: string | null;
  readonly customerPhone: string | null;
  readonly customerDocument: string | null;
  readonly customerCity: string | null;
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

export interface CustomerDetailOrder {
  readonly orderId: string;
  readonly raffleTitle: string;
  readonly raffleSlug: string;
  readonly orderStatus: string;
  readonly amount: string;
  readonly currency: string;
  readonly numbersRequested: number;
  readonly createdAt: Date;
  readonly numbers: readonly string[];
}

export interface CustomerDetailRow {
  readonly customer: SellerCustomerRow;
  readonly orders: readonly CustomerDetailOrder[];
  readonly totalAmount: string;
  readonly totalOrders: number;
}

export const getCustomerDetail = async ({
  sellerId,
  customerId,
}: {
  readonly sellerId: string;
  readonly customerId: string;
}): Promise<CustomerDetailRow | null> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const [customer] = await db
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
      .where(
        and(eq(customers.sellerId, sellerId), eq(customers.id, customerId)),
      )
      .groupBy(
        customers.id,
        customers.fullName,
        customers.email,
        customers.phone,
        customers.documentNumber,
        customers.city,
        customers.createdAt,
      )
      .limit(1);

    if (!customer) {
      return null;
    }

    const orderRows = await db
      .select({
        orderId: orders.id,
        raffleTitle: raffles.title,
        raffleSlug: raffles.slug,
        orderStatus: orders.status,
        amount: orders.amount,
        currency: orders.currency,
        numbersRequested: orders.numbersRequested,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .innerJoin(raffles, eq(orders.raffleId, raffles.id))
      .where(
        and(eq(orders.sellerId, sellerId), eq(orders.customerId, customerId)),
      )
      .orderBy(desc(orders.createdAt));

    const allOrderNumbers = await db
      .select({
        orderId: orderNumbers.orderId,
        displayNumber: orderNumbers.displayNumber,
      })
      .from(orderNumbers)
      .innerJoin(orders, eq(orderNumbers.orderId, orders.id))
      .where(
        and(eq(orders.sellerId, sellerId), eq(orders.customerId, customerId)),
      )
      .orderBy(orderNumbers.displayNumber);

    const numbersByOrder = new Map<string, string[]>();

    for (const item of allOrderNumbers) {
      if (!item.orderId) {
        continue;
      }

      const list = numbersByOrder.get(item.orderId);

      if (list) {
        list.push(item.displayNumber);
      } else {
        numbersByOrder.set(item.orderId, [item.displayNumber]);
      }
    }

    const ordersWithNumbers = orderRows.map((row) => ({
      ...row,
      numbers: numbersByOrder.get(row.orderId) ?? [],
    }));

    const totalAmount = ordersWithNumbers
      .reduce((sum, order) => sum + Number(order.amount), 0)
      .toFixed(2);

    return {
      customer: {
        ...customer,
        ordersCount: Number(customer.ordersCount),
      },
      orders: ordersWithNumbers,
      totalAmount,
      totalOrders: ordersWithNumbers.length,
    };
  } finally {
    await client.close();
  }
};

export const listSellerRaffleNumbers = async ({
  sellerId,
  raffleId,
}: RaffleScopeInput): Promise<readonly SellerRaffleNumberRow[] | null> => {
  // Run expiry cleanup first (it manages its own connection) so we never nest
  // two PGlite connections on the same data directory.
  await releaseExpiredReservations(raffleId);

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
        orderId: orders.id,
        orderAmount: orders.amount,
        orderCurrency: orders.currency,
        orderCreatedAt: orders.createdAt,
        orderStatus: orders.status,
        customerName: customers.fullName,
        customerEmail: customers.email,
        customerPhone: customers.phone,
        customerDocument: customers.documentNumber,
        customerCity: customers.city,
      })
      .from(raffleNumbers)
      .leftJoin(
        orderNumbers,
        eq(raffleNumbers.id, orderNumbers.raffleNumberId),
      )
      .leftJoin(orders, eq(orderNumbers.orderId, orders.id))
      .leftJoin(customers, eq(orders.customerId, customers.id))
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
