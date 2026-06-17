import { z } from 'zod';
import {
  ASSIGNMENT_MODES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPES,
  ORDER_STATUSES,
  PAYMENT_PROOF_ACCESS,
  RAFFLE_STATUSES,
  ROLES,
} from '@rifa/shared';

const valuesOf = <T extends Record<string, string>>(values: T) =>
  Object.values(values) as [T[keyof T], ...Array<T[keyof T]>];

export const sellerIdSchema = z.string().min(1).describe('Seller scope derived by the API');
export const idempotencyKeySchema = z.string().min(16).max(128).describe('Idempotency key');

export const publicRaffleLookupSchema = z.object({
  slug: z.string().min(1).max(120).describe('Public raffle slug'),
  expectedStatus: z.enum(valuesOf(RAFFLE_STATUSES)).default(RAFFLE_STATUSES.active),
});

export const raffleScaffoldSchema = z.object({
  sellerId: sellerIdSchema,
  status: z.enum(valuesOf(RAFFLE_STATUSES)),
  assignmentMode: z.enum(valuesOf(ASSIGNMENT_MODES)),
});

const localCampaignAssetPathSchema = z
  .string()
  .refine((value) => value.startsWith('http') || value.startsWith('/local-campaign-assets/'), {
    message: 'must be a URL or local asset path',
  });

const optionalLocalAssetUrlSchema = localCampaignAssetPathSchema.optional().or(z.literal(''));

export const paymentMethodSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(80),
  accountHolder: z.string().max(160).optional().or(z.literal('')),
  accountType: z.string().max(80).optional().or(z.literal('')),
  accountNumber: z.string().max(120).optional().or(z.literal('')),
  documentNumber: z.string().max(120).optional().or(z.literal('')),
  instructions: z.string().max(1000).optional().or(z.literal('')),
  qrImageUrl: optionalLocalAssetUrlSchema,
});

export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>;

// Accepted upload formats. Phones (iPhone) frequently produce HEIC/HEIF; the
// frontend compresses to JPEG/WebP before upload, but we accept the originals
// as a safety net so large phone photos no longer fail silently.
const uploadImageMimeTypeSchema = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const uploadImageDataSchema = z.string().min(100).max(14_000_000);

const adminRaffleFieldsSchema = z.object({
  title: z.string().min(3).max(160),
  slug: z
    .string()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().max(2000).optional(),
  status: z.enum(valuesOf(RAFFLE_STATUSES)).default(RAFFLE_STATUSES.draft),
  coverImageUrl: localCampaignAssetPathSchema.optional(),
  paymentQrImageUrl: localCampaignAssetPathSchema.optional(),
  landingConfig: z
    .object({
      heroBadge: z.string().max(80).optional(),
      heroTitle: z.string().max(120).optional(),
      heroAccent: z.string().max(80).optional(),
      heroSubtitle: z.string().max(300).optional(),
      prizeLabel: z.string().max(120).optional(),
      brandName: z.string().max(80).optional(),
      brandSubtitle: z.string().max(80).optional(),
      navbarCtaLabel: z.string().max(80).optional(),
      purchaseTitle: z.string().max(120).optional(),
      priceLabel: z.string().max(80).optional(),
      submitButtonLabel: z.string().max(120).optional(),
      participationPackages: z
        .array(
          z.object({
            label: z.string().max(80).optional(),
            quantity: z.coerce.number().int().min(1).max(100),
            price: z.coerce.number().positive().optional(),
          }),
        )
        .max(12)
        .optional(),
      paymentMethodsLabel: z.string().max(80).optional(),
      paymentMethodOne: z.string().max(80).optional(),
      paymentMethodTwo: z.string().max(80).optional(),
      paymentMethodThree: z.string().max(80).optional(),
      trustCardOneTitle: z.string().max(80).optional(),
      trustCardTwoTitle: z.string().max(80).optional(),
      howTitle: z.string().max(120).optional(),
      howSubtitle: z.string().max(200).optional(),
      stepOneTitle: z.string().max(80).optional(),
      stepOneDescription: z.string().max(200).optional(),
      stepTwoTitle: z.string().max(80).optional(),
      stepTwoDescription: z.string().max(200).optional(),
      stepThreeTitle: z.string().max(80).optional(),
      stepThreeDescription: z.string().max(200).optional(),
      prizeDetailsTitle: z.string().max(120).optional(),
      prizeDetailsSubtitle: z.string().max(200).optional(),
      prizeDetailOneLabel: z.string().max(80).optional(),
      prizeDetailOneValue: z.string().max(120).optional(),
      prizeDetailOneSub: z.string().max(200).optional(),
      prizeDetailTwoLabel: z.string().max(80).optional(),
      prizeDetailTwoValue: z.string().max(120).optional(),
      prizeDetailTwoSub: z.string().max(200).optional(),
      prizeDetailThreeLabel: z.string().max(80).optional(),
      prizeDetailThreeValue: z.string().max(120).optional(),
      prizeDetailThreeSub: z.string().max(200).optional(),
      organizerTitle: z.string().max(80).optional(),
      organizerCompany: z.string().max(160).optional(),
      organizerTaxId: z.string().max(80).optional(),
      organizerAddress: z.string().max(160).optional(),
      organizerCity: z.string().max(120).optional(),
      drawMethodTitle: z.string().max(80).optional(),
      drawMethodFallbackSummary: z.string().max(300).optional(),
      faqTitle: z.string().max(120).optional(),
      faqOneQuestion: z.string().max(180).optional(),
      faqOneAnswer: z.string().max(500).optional(),
      faqTwoQuestion: z.string().max(180).optional(),
      faqTwoAnswer: z.string().max(500).optional(),
      faqThreeQuestion: z.string().max(180).optional(),
      faqThreeAnswer: z.string().max(500).optional(),
      resultsTitle: z.string().max(120).optional(),
      resultsPendingText: z.string().max(300).optional(),
      footerBrandText: z.string().max(240).optional(),
      footerContactTitle: z.string().max(80).optional(),
      footerPhone: z.string().max(80).optional(),
      footerEmail: z.string().max(160).optional(),
      footerHours: z.string().max(120).optional(),
      footerLinksTitle: z.string().max(80).optional(),
      footerSocialTitle: z.string().max(80).optional(),
      instagramUrl: z.string().max(300).optional(),
      facebookUrl: z.string().max(300).optional(),
      youtubeUrl: z.string().max(300).optional(),
      whatsappUrl: z.string().max(300).optional(),
      copyrightText: z.string().max(200).optional(),
    })
    .optional(),
  pricePerNumber: z.coerce.number().positive(),
  currency: z.string().min(3).max(3).default('COP'),
  numberMin: z.coerce.number().int().min(0).default(0),
  numberMax: z.coerce.number().int().min(0),
  numberPadding: z.coerce.number().int().min(1).max(6).default(2),
  assignmentMode: z.enum(valuesOf(ASSIGNMENT_MODES)).default(ASSIGNMENT_MODES.customerChoice),
  reservationTtlMinutes: z.coerce.number().int().min(5).max(1440).default(30),
  drawSourceName: z.string().max(160).optional(),
  drawDate: z.string().datetime().optional(),
  drawTime: z.string().max(40).optional(),
  drawRule: z.string().max(500).optional(),
  terms: z.string().max(5000).optional(),
  paymentMethodLabel: z.string().max(120).optional(),
  paymentAccountHolder: z.string().max(160).optional(),
  paymentAccountType: z.string().max(80).optional(),
  paymentAccountNumber: z.string().max(120).optional(),
  paymentDocumentNumber: z.string().max(120).optional(),
  paymentInstructions: z.string().max(1000).optional(),
});

export const sellerSettingsSchema = z.object({
  brandName: z.string().min(1).max(80).optional(),
  brandSubtitle: z.string().max(80).optional(),
  organizerCompany: z.string().max(160).optional(),
  organizerTaxId: z.string().max(80).optional(),
  organizerAddress: z.string().max(160).optional(),
  organizerCity: z.string().max(120).optional(),
  supportPhone: z.string().max(80).optional(),
  supportEmail: z.string().email().max(160).optional(),
  supportHours: z.string().max(120).optional(),
  instagramUrl: z.string().max(300).optional(),
  facebookUrl: z.string().max(300).optional(),
  youtubeUrl: z.string().max(300).optional(),
  whatsappUrl: z.string().max(300).optional(),
  footerBrandText: z.string().max(240).optional(),
  copyrightText: z.string().max(200).optional(),
  defaultPaymentMethodLabel: z.string().max(120).optional(),
  defaultPaymentAccountHolder: z.string().max(160).optional(),
  defaultPaymentAccountType: z.string().max(80).optional(),
  defaultPaymentAccountNumber: z.string().max(120).optional(),
  defaultPaymentDocumentNumber: z.string().max(120).optional(),
  defaultPaymentInstructions: z.string().max(1000).optional(),
  defaultPaymentQrImageUrl: optionalLocalAssetUrlSchema,
  paymentMethods: z.array(paymentMethodSchema).max(8).optional(),
});

export const MAX_RAFFLE_NUMBERS = 1_000_000;

export const createAdminRaffleSchema = adminRaffleFieldsSchema.superRefine((value, context) => {
  if (value.numberMax < value.numberMin) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'El número máximo debe ser mayor o igual que el número mínimo.',
      path: ['numberMax'],
    });
  }

  if (value.numberMax - value.numberMin + 1 > MAX_RAFFLE_NUMBERS) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `La rifa puede tener como máximo ${MAX_RAFFLE_NUMBERS.toLocaleString('es-CO')} números.`,
      path: ['numberMax'],
    });
  }
});

export const updateAdminRaffleSchema = adminRaffleFieldsSchema
  .omit({
    numberMin: true,
    numberMax: true,
    numberPadding: true,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export type CreateAdminRaffleInput = z.infer<typeof createAdminRaffleSchema>;
export type UpdateAdminRaffleInput = z.infer<typeof updateAdminRaffleSchema>;
export type SellerSettingsInput = z.infer<typeof sellerSettingsSchema>;

export const createPublicOrderSchema = z
  .object({
    fullName: z.string().min(3).max(160),
    documentType: z.string().max(40).optional(),
    documentNumber: z.string().min(4).max(80),
    email: z.string().email().max(160),
    phone: z.string().min(6).max(60),
    city: z.string().max(120).optional(),
    acceptedTerms: z.literal(true),
    isAdultConfirmed: z.literal(true),
    numbersRequested: z.coerce.number().int().min(1).max(100).optional(),
    selectedNumbers: z.array(z.coerce.number().int().min(0)).max(100).optional(),
  })
  .superRefine((value, context) => {
    if (!value.numbersRequested && !value.selectedNumbers?.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'numbersRequested or selectedNumbers is required',
        path: ['numbersRequested'],
      });
    }

    if (
      value.selectedNumbers &&
      new Set(value.selectedNumbers).size !== value.selectedNumbers.length
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'selectedNumbers cannot contain duplicates',
        path: ['selectedNumbers'],
      });
    }
  });

export type CreatePublicOrderInput = z.infer<typeof createPublicOrderSchema>;

export const uploadPaymentProofSchema = z.object({
  fileName: z.string().min(1).max(180),
  mimeType: uploadImageMimeTypeSchema,
  dataBase64: uploadImageDataSchema,
});

export type UploadPaymentProofInput = z.infer<typeof uploadPaymentProofSchema>;

export const createManualOrderSchema = z
  .object({
    raffleId: z.string().min(1).optional(),
    fullName: z.string().min(3).max(160),
    documentType: z.string().max(40).optional(),
    documentNumber: z.string().min(4).max(80),
    email: z.string().email().max(160),
    phone: z.string().min(6).max(60),
    city: z.string().max(120).optional(),
    numbersRequested: z.coerce.number().int().min(1).max(100).optional(),
    selectedNumbers: z.array(z.coerce.number().int().min(0)).max(100).optional(),
    proof: z
      .object({
        fileName: z.string().min(1).max(180),
        mimeType: uploadImageMimeTypeSchema,
        dataBase64: uploadImageDataSchema,
      })
      .optional(),
  })
  .superRefine((value, context) => {
    if (!value.numbersRequested && !value.selectedNumbers?.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'numbersRequested or selectedNumbers is required',
        path: ['numbersRequested'],
      });
    }

    if (
      value.selectedNumbers &&
      new Set(value.selectedNumbers).size !== value.selectedNumbers.length
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'selectedNumbers cannot contain duplicates',
        path: ['selectedNumbers'],
      });
    }
  });

export type CreateManualOrderInput = z.infer<typeof createManualOrderSchema>;

export const rejectAdminOrderSchema = z.object({
  reason: z.string().min(3).max(500),
});

export type RejectAdminOrderInput = z.infer<typeof rejectAdminOrderSchema>;

export const paymentProofMetadataSchema = z.object({
  sellerId: sellerIdSchema,
  proofId: z.string().min(1),
  orderId: z.string().min(1),
  storageKey: z.string().min(1),
  access: z.enum(valuesOf(PAYMENT_PROOF_ACCESS)).default(PAYMENT_PROOF_ACCESS.privateObject),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  uploadedAt: z.string().datetime(),
});

export const manualProofReviewSchema = z.object({
  sellerId: sellerIdSchema,
  orderId: z.string().min(1),
  reviewerId: z.string().min(1),
  reviewerRole: z.enum(valuesOf(ROLES)),
  outcome: z.enum([ORDER_STATUSES.paid, ORDER_STATUSES.rejected]).describe('Manual review outcome'),
  proof: paymentProofMetadataSchema,
  rejectionReason: z.string().min(1).max(500).optional(),
  reviewedAt: z.string().datetime(),
  idempotencyKey: idempotencyKeySchema,
});

export const uploadCampaignImageSchema = z.object({
  fileName: z.string().min(1).max(180),
  mimeType: uploadImageMimeTypeSchema,
  dataBase64: uploadImageDataSchema,
});

export const uploadCampaignCoverSchema = uploadCampaignImageSchema;

export type UploadCampaignImageInput = z.infer<typeof uploadCampaignImageSchema>;
export type UploadCampaignCoverInput = UploadCampaignImageInput;

export const registerDrawResultSchema = z.object({
  winningNumber: z.coerce.number().int().min(0),
  externalSource: z.string().min(2).max(160),
  notes: z.string().max(500).optional(),
});

export type RegisterDrawResultInput = z.infer<typeof registerDrawResultSchema>;

export const updateWinnerSchema = z.object({
  isPublicWinner: z.boolean().optional(),
  winnerComment: z.string().max(800).nullable().optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});

export const createGalleryImageSchema = z.object({
  title: z.string().max(120).optional(),
  caption: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  image: uploadCampaignImageSchema,
});

export const updateGalleryImageSchema = z.object({
  title: z.string().max(120).nullable().optional(),
  caption: z.string().max(500).nullable().optional(),
  isPublic: z.boolean().optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});

export type UpdateWinnerInput = z.infer<typeof updateWinnerSchema>;
export type CreateGalleryImageInput = z.infer<typeof createGalleryImageSchema>;
export type UpdateGalleryImageInput = z.infer<typeof updateGalleryImageSchema>;

export const createPrizeSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(2000).optional(),
  commercialValue: z.coerce.number().positive().optional(),
  position: z.coerce.number().int().min(1).default(1),
});

export const updatePrizeSchema = createPrizeSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export type CreatePrizeInput = z.infer<typeof createPrizeSchema>;
export type UpdatePrizeInput = z.infer<typeof updatePrizeSchema>;

export const createNotificationJobSchema = z.object({
  sellerId: sellerIdSchema,
  channel: z.enum(valuesOf(NOTIFICATION_CHANNELS)).describe('Durable notification channel'),
  type: z.enum(valuesOf(NOTIFICATION_TYPES)),
  recipient: z.string().min(1),
  payloadRef: z.string().min(1),
  enqueueAfterCommit: z.literal(true),
  idempotencyKey: idempotencyKeySchema,
});
