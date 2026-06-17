export {
  createRifaDatabase,
  createLocalPgliteDatabase,
  createPgliteDatabase,
  createPostgresDatabase,
  DEFAULT_LOCAL_PGLITE_DATA_DIR,
  getLocalDatabaseHealth,
} from './client';
export {
  activateSellerRaffle,
  createPublicOrderForRaffle,
  createSellerRaffle,
  getPublicCurrentActiveRaffle,
  getPublicActiveRaffleBySlug,
  getPublicRaffleStatsBySlug,
  getSellerActiveRaffle,
  getSellerRaffleById,
  listPublicRaffleNumbersBySlug,
  listSellerRaffles,
  releaseExpiredReservations,
  updateSellerRaffle,
} from './raffles';
export type { PublicRaffleStats } from './raffles';
export {
  persistCampaignAssetImage,
  persistCampaignCoverImage,
  persistCampaignPaymentQrImage,
  updateSellerRaffleCoverImage,
  updateSellerRafflePaymentQrImage,
} from './campaign-assets';
export { ensureLocalSchema } from './client';
export type { RifaDatabaseDriver } from './client';
export {
  approveSellerOrder,
  attachPaymentProofToOrder,
  createManualSellerOrder,
  getSellerOrderDetail,
  listSellerOrders,
  rejectSellerOrder,
} from './orders';
export { upsertNotificationLog } from './notifications';
export {
  getCustomerDetail,
  listSellerAuditLogs,
  listSellerCustomers,
  listSellerNotificationLogs,
  listSellerRaffleNumbers,
} from './admin-insights';
export { getPublicOrderStatus } from './public-orders';
export type { PublicOrderStatus } from './public-orders';
export {
  getPublicDrawResultBySlug,
  getSellerDrawResult,
  registerSellerDrawResult,
} from './draw-results';
export type { DrawResultView } from './draw-results';
export {
  createSellerDeliveryGalleryImage,
  deleteSellerDeliveryGalleryImage,
  getPublicWinnersContentBySlug,
  listSellerDeliveryGallery,
  listSellerWinners,
  updateSellerDeliveryGalleryImage,
  updateSellerWinner,
} from './winners';
export type { DeliveryGalleryImageRow, PublicWinnersContent, WinnerContentRow } from './winners';
export {
  createSellerRafflePrize,
  deleteSellerRafflePrize,
  listSellerRafflePrizes,
  updateSellerRafflePrize,
} from './prizes';
export { blockSellerRaffleNumberByValue, releaseSellerRaffleNumber } from './numbers-admin';
export { listSellerRaffleOrdersForExport } from './exports';
export type { RaffleOrderExportRow } from './exports';
export {
  getSellerSettings,
  updateSellerDefaultPaymentQrImage,
  updateSellerSettings,
} from './seller-settings';
export type {
  CustomerDetailOrder,
  CustomerDetailRow,
  SellerAuditLogRow,
  SellerCustomerRow,
  SellerNotificationLogRow,
  SellerRaffleNumberRow,
} from './admin-insights';
export * from './schema';

import { CONFIG_KEYS } from '@rifa/config';
import { IDEMPOTENCY_SCOPES } from '@rifa/shared';

export const DB_FOUNDATION_CONTRACT = {
  owner: 'apps/api',
  schemaStatus: 'placeholder-only',
  migrationStatus: 'placeholder-only',
  requiredConfigKey: CONFIG_KEYS.databaseUrl,
  approvalIdempotencyScope: IDEMPOTENCY_SCOPES.orderApproval,
  futureConstraints: {
    raffleNumberUniquePerRaffle: 'unique(raffle_id, number)',
    orderNumberUniquePerOrderAndNumber: 'unique(order_id, raffle_number_id)',
  },
  localDriver: 'pglite',
  productionDriver: 'postgresql',
} as const;
