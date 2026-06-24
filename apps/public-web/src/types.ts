import type { PaymentMethod, RaffleLandingConfig } from '@rifa/shared';

export interface PublicRaffle {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly description: string | null;
  readonly coverImageUrl?: string | null;
  readonly paymentQrImageUrl?: string | null;
  readonly landingConfig?: RaffleLandingConfig | null;
  readonly pricePerNumber: string;

  readonly currency: string;

  readonly numberMin: number;

  readonly numberMax: number;

  readonly assignmentMode: string;

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

export interface PublicRaffleNumber {
  readonly id: string;

  readonly number: number;

  readonly displayNumber: string;

  readonly status: string;
}

export interface CreatedOrder {
  readonly id: string;

  readonly status: string;

  readonly amount: string;

  readonly currency: string;

  readonly numbersRequested: number;
}

export interface BuyerFormState {
  readonly fullName: string;

  readonly documentNumber: string;

  readonly email: string;

  readonly phone: string;
}

export interface CheckoutSession {
  readonly raffle: PublicRaffle;

  readonly buyer: BuyerFormState;

  readonly quantity: number;

  readonly paymentMethods?: readonly PaymentMethod[];

  readonly ownerWhatsappNumber?: string;

  readonly order?: CreatedOrder;

  readonly reservedNumbers?: readonly PublicRaffleNumber[];
}

export type PaymentFlowStep = 'pay' | 'done';

export interface CampaignStats {
  readonly totalTickets: number;

  readonly soldTickets: number;

  readonly availableTickets: number;

  readonly soldPercentage: number;
}

export interface PublicWinner {
  readonly id: string;
  readonly raffleId: string;
  readonly raffleTitle: string;
  readonly winningNumber: number;
  readonly externalSource: string;
  readonly registeredAt: string;
  readonly winnerDisplayName: string | null;
  readonly isPublicWinner: boolean;
  readonly winnerPhotoUrl: string | null;
  readonly winnerComment: string | null;
  readonly displayOrder: number;
}

export interface PublicGalleryImage {
  readonly id: string;
  readonly imageUrl: string;
  readonly title: string | null;
  readonly caption: string | null;
  readonly isPublic: boolean;
  readonly displayOrder: number;
  readonly createdAt: string;
}

export interface PublicWinnersContent {
  readonly winners: readonly PublicWinner[];
  readonly gallery: readonly PublicGalleryImage[];
}
