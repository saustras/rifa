import { randomUUID } from 'node:crypto';

import { NOTIFICATION_JOB_STATUSES } from '@rifa/shared';
import type { NotificationChannel, NotificationJobStatus, NotificationType } from '@rifa/shared';

import { createLocalPgliteDatabase } from './client';
import { notificationLogs } from './schema';

type NotificationLogRow = typeof notificationLogs.$inferSelect;

interface UpsertNotificationLogInput {
  readonly sellerId: string;
  readonly orderId?: string | undefined;
  readonly raffleId?: string | undefined;
  readonly channel: NotificationChannel;
  readonly type: NotificationType;
  readonly recipient: string;
  readonly status?: NotificationJobStatus | undefined;
  readonly payload: Record<string, unknown>;
  readonly idempotencyKey: string;
  readonly providerMessageId?: string | undefined;
  readonly errorMessage?: string | undefined;
  readonly sentAt?: Date | undefined;
}

const serializePayload = (payload: Record<string, unknown>): string => JSON.stringify(payload);

export const upsertNotificationLog = async ({
  sellerId,
  orderId,
  raffleId,
  channel,
  type,
  recipient,
  status = NOTIFICATION_JOB_STATUSES.queued,
  payload,
  idempotencyKey,
  providerMessageId,
  errorMessage,
  sentAt,
}: UpsertNotificationLogInput): Promise<NotificationLogRow> => {
  const { client, db } = createLocalPgliteDatabase();
  const now = new Date();
  const payloadRef = serializePayload(payload);

  try {
    const [log] = await db
      .insert(notificationLogs)
      .values({
        id: randomUUID(),
        sellerId,
        orderId: orderId ?? null,
        raffleId: raffleId ?? null,
        channel,
        type,
        recipient,
        status,
        payloadRef,
        idempotencyKey,
        providerMessageId: providerMessageId ?? null,
        errorMessage: errorMessage ?? null,
        sentAt: sentAt ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: notificationLogs.idempotencyKey,
        set: {
          recipient,
          status,
          payloadRef,
          providerMessageId: providerMessageId ?? null,
          errorMessage: errorMessage ?? null,
          sentAt: sentAt ?? null,
          updatedAt: now,
        },
      })
      .returning();

    if (!log) {
      throw new Error('Notification log was not persisted');
    }

    return log;
  } finally {
    await client.close();
  }
};
