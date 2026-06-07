import type { RaffleLandingConfig } from '@rifa/shared';

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

  readonly order: CreatedOrder;

  readonly reservedNumbers: readonly PublicRaffleNumber[];

  readonly buyer: BuyerFormState;

  readonly quantity: number;
}

export type PaymentFlowStep = 'pay' | 'proof' | 'done';

export interface CampaignStats {
  readonly totalTickets: number;

  readonly soldTickets: number;

  readonly availableTickets: number;

  readonly soldPercentage: number;
}
