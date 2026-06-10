import type { RaffleLandingConfig } from '@rifa/shared';

export type { ParticipationPackage, RaffleLandingConfig, SellerSettings } from '@rifa/shared';

export const ORDER_STATUS = {
  all: 'all',
  pendingReview: 'pending_review',
  paid: 'paid',
  rejected: 'rejected',
  cancelled: 'cancelled',
  expired: 'expired',
} as const;

export const REQUEST_STATUS = {
  idle: 'idle',
  loading: 'loading',
  success: 'success',
  error: 'error',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
export type RequestStatus = (typeof REQUEST_STATUS)[keyof typeof REQUEST_STATUS];
export type AdminView =
  | 'dashboard'
  | 'campaigns'
  | 'campaign-form'
  | 'orders'
  | 'participants'
  | 'numbers'
  | 'settings';

export interface AdminCredentials {
  readonly token: string;
  readonly sellerId: string;
}

export interface AdminUser {
  readonly username: string;
  readonly sellerId: string;
}

export interface AdminSession {
  readonly token: string;
  readonly expiresAt: number;
  readonly user: AdminUser;
}

export interface AdminLoginCredentials {
  readonly username: string;
  readonly password: string;
}

export interface OrderListRow {
  readonly id: string;
  readonly raffleId: string;
  readonly customerId: string;
  readonly status: Exclude<OrderStatus, 'all'>;
  readonly amount: string;
  readonly currency: string;
  readonly numbersRequested: number;
  readonly paymentProofUrl: string | null;
  readonly paymentProofStorageKey: string | null;
  readonly paymentProofMimeType: string | null;
  readonly paymentProofSizeBytes: number | null;
  readonly paymentProofUploadedAt: string | null;
  readonly createdAt: string;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly customerPhone: string;
  readonly raffleTitle: string;
  readonly raffleSlug: string;
}

export interface OrderDetailOrder {
  readonly id: string;
  readonly sellerId: string;
  readonly raffleId: string;
  readonly customerId: string;
  readonly status: Exclude<OrderStatus, 'all'>;
  readonly amount: string;
  readonly currency: string;
  readonly numbersRequested: number;
  readonly paymentProofStorageKey: string | null;
  readonly paymentProofMimeType: string | null;
  readonly paymentProofSizeBytes: number | null;
  readonly paymentProofUploadedAt: string | null;
  readonly rejectionReason: string | null;
  readonly reviewedAt: string | null;
  readonly createdAt: string;
}

export interface OrderDetailCustomer {
  readonly id: string;
  readonly fullName: string;
  readonly documentType: string | null;
  readonly documentNumber: string;
  readonly email: string;
  readonly phone: string;
  readonly city: string | null;
}

export interface OrderDetailRaffle {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly assignmentMode: string;
}

export interface OrderNumber {
  readonly id: string;
  readonly orderId: string;
  readonly raffleNumberId: string;
  readonly number: number;
  readonly displayNumber: string;
  readonly status: string;
}

export interface OrderDetail {
  readonly order: OrderDetailOrder;
  readonly customer: OrderDetailCustomer;
  readonly raffle: OrderDetailRaffle;
  readonly numbers: readonly OrderNumber[];
}

export interface AdminRaffle {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly status: string;
  readonly description: string | null;
  readonly coverImageUrl?: string | null;
  readonly paymentQrImageUrl?: string | null;
  readonly landingConfig?: RaffleLandingConfig | null;
  readonly pricePerNumber: string;
  readonly currency: string;
  readonly numberMin: number;
  readonly numberMax: number;
  readonly numberPadding?: number;
  readonly assignmentMode?: string;
  readonly drawDate: string | null;
  readonly drawSourceName: string | null;
  readonly drawRule: string | null;
  readonly paymentMethodLabel: string | null;
  readonly paymentAccountHolder: string | null;
  readonly paymentAccountType: string | null;
  readonly paymentAccountNumber: string | null;
  readonly paymentDocumentNumber: string | null;
  readonly paymentInstructions: string | null;
}

export interface CreateRaffleInput {
  readonly title: string;
  readonly slug: string;
  readonly description?: string;
  readonly status?: string;
  readonly coverImageUrl?: string;
  readonly landingConfig?: RaffleLandingConfig;
  readonly pricePerNumber: number;
  readonly currency?: string;
  readonly numberMin?: number;
  readonly numberMax: number;
  readonly numberPadding?: number;
  readonly assignmentMode?: string;
  readonly paymentMethodLabel?: string;
  readonly paymentAccountHolder?: string;
  readonly paymentAccountType?: string;
  readonly paymentAccountNumber?: string;
  readonly paymentDocumentNumber?: string;
  readonly paymentInstructions?: string;
  readonly drawSourceName?: string;
  readonly drawRule?: string;
}

export interface UpdateRaffleInput {
  readonly title?: string;
  readonly slug?: string;
  readonly description?: string;
  readonly status?: string;
  readonly coverImageUrl?: string;
  readonly landingConfig?: RaffleLandingConfig;
  readonly pricePerNumber?: number;
  readonly paymentMethodLabel?: string;
  readonly paymentAccountHolder?: string;
  readonly paymentAccountType?: string;
  readonly paymentAccountNumber?: string;
  readonly paymentDocumentNumber?: string;
  readonly paymentInstructions?: string;
  readonly drawSourceName?: string;
  readonly drawRule?: string;
}

export interface AdminCustomer {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly documentNumber: string;
  readonly city: string | null;
  readonly createdAt: string;
  readonly ordersCount: number;
}

export interface AdminRaffleNumber {
  readonly id: string;
  readonly number: number;
  readonly displayNumber: string;
  readonly status: string;
  readonly reservedByOrderId: string | null;
  readonly assignedToOrderId: string | null;
}

export interface OrdersMetrics {
  readonly total: number;
  readonly pending: number;
  readonly paid: number;
  readonly revenue: number;
  readonly participationsSold: number;
  readonly todayRevenue: number;
}

export interface DrawResult {
  readonly id: string;
  readonly raffleId: string;
  readonly winningNumber: number;
  readonly externalSource: string;
  readonly externalDrawDate: string | null;
  readonly notes: string | null;
  readonly registeredAt: string;
  readonly winnerDisplayName: string | null;
  readonly winnerOrderId: string | null;
}

export interface AdminPrize {
  readonly id: string;
  readonly raffleId: string;
  readonly title: string;
  readonly description: string | null;
  readonly commercialValue: string | null;
  readonly position: number;
}
