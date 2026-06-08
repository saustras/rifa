export type { RaffleLandingConfig, SellerSettings } from './landing-config';
export { DEFAULT_LANDING_CONFIG, DEFAULT_SELLER_SETTINGS } from './landing-config';

export const RAFFLE_STATUSES = {
  draft: 'draft',
  scheduled: 'scheduled',
  active: 'active',
  paused: 'paused',
  closed: 'closed',
  drawn: 'drawn',
  cancelled: 'cancelled',
} as const;

export const ORDER_STATUSES = {
  pendingReview: 'pending_review',
  paid: 'paid',
  rejected: 'rejected',
  cancelled: 'cancelled',
  expired: 'expired',
} as const;

export const RAFFLE_NUMBER_STATUSES = {
  available: 'available',
  reserved: 'reserved',
  assigned: 'assigned',
  blocked: 'blocked',
  winner: 'winner',
  cancelled: 'cancelled',
} as const;

export const ASSIGNMENT_MODES = {
  random: 'random',
  customerChoice: 'customer_choice',
} as const;

export const ROLES = {
  publicBuyer: 'public_buyer',
  seller: 'seller',
  platformAdmin: 'platform_admin',
  auditor: 'auditor',
} as const;

export const NOTIFICATION_CHANNELS = {
  email: 'email',
  telegram: 'telegram',
} as const;

export const NOTIFICATION_TYPES = {
  orderPendingReview: 'order_pending_review',
  orderApproved: 'order_approved',
  orderRejected: 'order_rejected',
  drawResultRegistered: 'draw_result_registered',
} as const;

export const NOTIFICATION_JOB_STATUSES = {
  queued: 'queued',
  processing: 'processing',
  delivered: 'delivered',
  failed: 'failed',
  retrying: 'retrying',
} as const;

export const AUDIT_ACTIONS = {
  raffleCreated: 'raffle_created',
  raffleUpdated: 'raffle_updated',
  orderCreated: 'order_created',
  proofUploaded: 'proof_uploaded',
  orderApproved: 'order_approved',
  orderRejected: 'order_rejected',
  numberReserved: 'number_reserved',
  numberAssigned: 'number_assigned',
  numberBlocked: 'number_blocked',
  numberReleased: 'number_released',
  drawResultRegistered: 'draw_result_registered',
} as const;

export const PAYMENT_PROOF_ACCESS = {
  privateObject: 'private_object',
  authenticatedStream: 'authenticated_stream',
  shortLivedSignedUrl: 'short_lived_signed_url',
} as const;

export const IDEMPOTENCY_SCOPES = {
  orderApproval: 'order_approval',
  orderRejection: 'order_rejection',
  proofUpload: 'proof_upload',
  notificationDispatch: 'notification_dispatch',
} as const;

export type ValueOf<T extends Record<string, unknown>> = T[keyof T];

export type RaffleStatus = ValueOf<typeof RAFFLE_STATUSES>;
export type OrderStatus = ValueOf<typeof ORDER_STATUSES>;
export type RaffleNumberStatus = ValueOf<typeof RAFFLE_NUMBER_STATUSES>;
export type AssignmentMode = ValueOf<typeof ASSIGNMENT_MODES>;
export type Role = ValueOf<typeof ROLES>;
export type NotificationChannel = ValueOf<typeof NOTIFICATION_CHANNELS>;
export type NotificationType = ValueOf<typeof NOTIFICATION_TYPES>;
export type NotificationJobStatus = ValueOf<typeof NOTIFICATION_JOB_STATUSES>;
export type AuditAction = ValueOf<typeof AUDIT_ACTIONS>;
export type PaymentProofAccess = ValueOf<typeof PAYMENT_PROOF_ACCESS>;
export type IdempotencyScope = ValueOf<typeof IDEMPOTENCY_SCOPES>;

export interface SellerOwnedContract {
  readonly sellerId: string;
}

export interface IdempotencyContract {
  readonly idempotencyKey: string;
  readonly idempotencyScope: IdempotencyScope;
}

export interface PaymentProofMetadataContract extends SellerOwnedContract {
  readonly proofId: string;
  readonly orderId: string;
  readonly storageKey: string;
  readonly access: PaymentProofAccess;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly uploadedAt: string;
}

export interface NotificationLogContract extends SellerOwnedContract {
  readonly channel: NotificationChannel;
  readonly type: NotificationType;
  readonly status: NotificationJobStatus;
  readonly recipient: string;
  readonly providerMessageId?: string;
  readonly error?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
