import {
  ASSIGNMENT_MODES,
  AUDIT_ACTIONS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_JOB_STATUSES,
  NOTIFICATION_TYPES,
  ORDER_STATUSES,
  RAFFLE_NUMBER_STATUSES,
  RAFFLE_STATUSES,
  ROLES,
} from '@rifa/shared';
import type { RaffleLandingConfig } from '@rifa/shared';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

const valuesOf = <T extends Record<string, string>>(values: T) =>
  Object.values(values) as [T[keyof T], ...Array<T[keyof T]>];

export const raffleStatusEnum = pgEnum('raffle_status', valuesOf(RAFFLE_STATUSES));
export const orderStatusEnum = pgEnum('order_status', valuesOf(ORDER_STATUSES));
export const raffleNumberStatusEnum = pgEnum(
  'raffle_number_status',
  valuesOf(RAFFLE_NUMBER_STATUSES),
);
export const assignmentModeEnum = pgEnum('assignment_mode', valuesOf(ASSIGNMENT_MODES));
export const roleEnum = pgEnum('role', valuesOf(ROLES));
export const notificationChannelEnum = pgEnum(
  'notification_channel',
  valuesOf(NOTIFICATION_CHANNELS),
);
export const notificationTypeEnum = pgEnum('notification_type', valuesOf(NOTIFICATION_TYPES));
export const notificationJobStatusEnum = pgEnum(
  'notification_job_status',
  valuesOf(NOTIFICATION_JOB_STATUSES),
);
export const auditActionEnum = pgEnum('audit_action', valuesOf(AUDIT_ACTIONS));

export const sellers = pgTable(
  'sellers',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    status: text('status').notNull().default('active'),
    telegramChatId: text('telegram_chat_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('sellers_email_unique').on(table.email)],
);

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    sellerId: text('seller_id')
      .notNull()
      .references(() => sellers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: roleEnum('role').notNull().default(ROLES.seller),
    status: text('status').notNull().default('active'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('users_seller_idx').on(table.sellerId),
    uniqueIndex('users_seller_email_unique').on(table.sellerId, table.email),
  ],
);

export const raffles = pgTable(
  'raffles',
  {
    id: text('id').primaryKey(),
    sellerId: text('seller_id')
      .notNull()
      .references(() => sellers.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    status: raffleStatusEnum('status').notNull().default(RAFFLE_STATUSES.draft),
    coverImageUrl: text('cover_image_url'),
    paymentQrImageUrl: text('payment_qr_image_url'),
    landingConfig: jsonb('landing_config').$type<RaffleLandingConfig | null>(),
    pricePerNumber: numeric('price_per_number', { precision: 12, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('COP'),
    numberMin: integer('number_min').notNull().default(0),
    numberMax: integer('number_max').notNull(),
    numberPadding: integer('number_padding').notNull().default(2),
    assignmentMode: assignmentModeEnum('assignment_mode').notNull(),
    reservationTtlMinutes: integer('reservation_ttl_minutes').notNull().default(30),
    drawSourceName: text('draw_source_name'),
    drawDate: timestamp('draw_date', { withTimezone: true }),
    drawTime: text('draw_time'),
    drawRule: text('draw_rule'),
    terms: text('terms'),
    paymentMethodLabel: text('payment_method_label'),
    paymentAccountHolder: text('payment_account_holder'),
    paymentAccountType: text('payment_account_type'),
    paymentAccountNumber: text('payment_account_number'),
    paymentDocumentNumber: text('payment_document_number'),
    paymentInstructions: text('payment_instructions'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('raffles_seller_idx').on(table.sellerId),
    index('raffles_status_idx').on(table.status),
    uniqueIndex('raffles_seller_slug_unique').on(table.sellerId, table.slug),
  ],
);

export const rafflePrizes = pgTable(
  'raffle_prizes',
  {
    id: text('id').primaryKey(),
    raffleId: text('raffle_id')
      .notNull()
      .references(() => raffles.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    commercialValue: numeric('commercial_value', { precision: 12, scale: 2 }),
    position: integer('position').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('raffle_prizes_raffle_idx').on(table.raffleId)],
);

export const raffleNumbers = pgTable(
  'raffle_numbers',
  {
    id: text('id').primaryKey(),
    raffleId: text('raffle_id')
      .notNull()
      .references(() => raffles.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    displayNumber: text('display_number').notNull(),
    status: raffleNumberStatusEnum('status').notNull().default(RAFFLE_NUMBER_STATUSES.available),
    reservedByOrderId: text('reserved_by_order_id'),
    assignedToOrderId: text('assigned_to_order_id'),
    reservedAt: timestamp('reserved_at', { withTimezone: true }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('raffle_numbers_raffle_status_idx').on(table.raffleId, table.status),
    uniqueIndex('raffle_numbers_raffle_number_unique').on(table.raffleId, table.number),
  ],
);

export const customers = pgTable(
  'customers',
  {
    id: text('id').primaryKey(),
    sellerId: text('seller_id')
      .notNull()
      .references(() => sellers.id, { onDelete: 'cascade' }),
    fullName: text('full_name').notNull(),
    documentType: text('document_type'),
    documentNumber: text('document_number').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    city: text('city'),
    acceptedTermsAt: timestamp('accepted_terms_at', { withTimezone: true }),
    isAdultConfirmed: boolean('is_adult_confirmed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('customers_seller_email_idx').on(table.sellerId, table.email),
    index('customers_seller_document_idx').on(table.sellerId, table.documentNumber),
  ],
);

export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(),
    sellerId: text('seller_id')
      .notNull()
      .references(() => sellers.id, { onDelete: 'cascade' }),
    raffleId: text('raffle_id')
      .notNull()
      .references(() => raffles.id, { onDelete: 'restrict' }),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    status: orderStatusEnum('status').notNull().default(ORDER_STATUSES.pendingReview),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('COP'),
    numbersRequested: integer('numbers_requested').notNull().default(1),
    paymentProofUrl: text('payment_proof_url'),
    paymentProofStorageKey: text('payment_proof_storage_key'),
    paymentProofMimeType: text('payment_proof_mime_type'),
    paymentProofSizeBytes: integer('payment_proof_size_bytes'),
    paymentProofUploadedAt: timestamp('payment_proof_uploaded_at', { withTimezone: true }),
    reviewedByUserId: text('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewIdempotencyKey: text('review_idempotency_key'),
    rejectionReason: text('rejection_reason'),
    adminNotes: text('admin_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('orders_seller_status_idx').on(table.sellerId, table.status),
    index('orders_raffle_status_idx').on(table.raffleId, table.status),
    uniqueIndex('orders_review_idempotency_unique').on(table.reviewIdempotencyKey),
  ],
);

export const orderNumbers = pgTable(
  'order_numbers',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    raffleNumberId: text('raffle_number_id')
      .notNull()
      .references(() => raffleNumbers.id, { onDelete: 'restrict' }),
    number: integer('number').notNull(),
    displayNumber: text('display_number').notNull(),
    status: raffleNumberStatusEnum('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('order_numbers_order_idx').on(table.orderId),
    uniqueIndex('order_numbers_order_number_unique').on(table.orderId, table.raffleNumberId),
    uniqueIndex('order_numbers_raffle_number_unique').on(table.raffleNumberId),
  ],
);

export const drawResults = pgTable(
  'draw_results',
  {
    id: text('id').primaryKey(),
    raffleId: text('raffle_id')
      .notNull()
      .references(() => raffles.id, { onDelete: 'cascade' }),
    externalSource: text('external_source').notNull(),
    externalDrawDate: timestamp('external_draw_date', { withTimezone: true }),
    winningNumber: integer('winning_number').notNull(),
    winnerOrderId: text('winner_order_id').references(() => orders.id, { onDelete: 'set null' }),
    winnerCustomerId: text('winner_customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    evidenceUrl: text('evidence_url'),
    notes: text('notes'),
    registeredByUserId: text('registered_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('draw_results_raffle_unique').on(table.raffleId)],
);

export const notificationLogs = pgTable(
  'notification_logs',
  {
    id: text('id').primaryKey(),
    sellerId: text('seller_id')
      .notNull()
      .references(() => sellers.id, { onDelete: 'cascade' }),
    orderId: text('order_id').references(() => orders.id, { onDelete: 'set null' }),
    raffleId: text('raffle_id').references(() => raffles.id, { onDelete: 'set null' }),
    channel: notificationChannelEnum('channel').notNull(),
    type: notificationTypeEnum('type').notNull(),
    recipient: text('recipient').notNull(),
    status: notificationJobStatusEnum('status').notNull().default(NOTIFICATION_JOB_STATUSES.queued),
    payloadRef: text('payload_ref'),
    idempotencyKey: text('idempotency_key').notNull(),
    providerMessageId: text('provider_message_id'),
    errorMessage: text('error_message'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('notification_logs_seller_status_idx').on(table.sellerId, table.status),
    uniqueIndex('notification_logs_idempotency_unique').on(table.idempotencyKey),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    sellerId: text('seller_id').references(() => sellers.id, { onDelete: 'set null' }),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorRole: roleEnum('actor_role'),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    action: auditActionEnum('action').notNull(),
    beforeData: jsonb('before_data').$type<Record<string, unknown>>(),
    afterData: jsonb('after_data').$type<Record<string, unknown>>(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_logs_seller_created_idx').on(table.sellerId, table.createdAt),
    index('audit_logs_entity_idx').on(table.entityType, table.entityId),
  ],
);
