export interface ParticipationPackage {
  readonly label?: string | undefined;
  readonly quantity: number;
  readonly price?: number | undefined;
}

export interface PaymentMethod {
  readonly id: string;
  readonly label: string;
  readonly accountHolder?: string | undefined;
  readonly accountType?: string | undefined;
  readonly accountNumber?: string | undefined;
  readonly documentNumber?: string | undefined;
  readonly instructions?: string | undefined;
  readonly qrImageUrl?: string | undefined;
}

export interface RaffleLandingConfig {
  readonly heroBadge?: string | undefined;
  readonly heroTitle?: string | undefined;
  readonly heroAccent?: string | undefined;
  readonly heroSubtitle?: string | undefined;
  readonly prizeLabel?: string | undefined;
  readonly brandName?: string | undefined;
  readonly brandSubtitle?: string | undefined;
  readonly navbarCtaLabel?: string | undefined;
  readonly purchaseTitle?: string | undefined;
  readonly priceLabel?: string | undefined;
  readonly submitButtonLabel?: string | undefined;
  readonly participationPackages?: readonly ParticipationPackage[] | undefined;
  readonly paymentMethodsLabel?: string | undefined;
  readonly paymentMethodOne?: string | undefined;
  readonly paymentMethodTwo?: string | undefined;
  readonly paymentMethodThree?: string | undefined;
  readonly trustCardOneTitle?: string | undefined;
  readonly trustCardTwoTitle?: string | undefined;
  readonly howTitle?: string | undefined;
  readonly howSubtitle?: string | undefined;
  readonly stepOneTitle?: string | undefined;
  readonly stepOneDescription?: string | undefined;
  readonly stepTwoTitle?: string | undefined;
  readonly stepTwoDescription?: string | undefined;
  readonly stepThreeTitle?: string | undefined;
  readonly stepThreeDescription?: string | undefined;
  readonly prizeDetailsTitle?: string | undefined;
  readonly prizeDetailsSubtitle?: string | undefined;
  readonly prizeDetailOneLabel?: string | undefined;
  readonly prizeDetailOneValue?: string | undefined;
  readonly prizeDetailOneSub?: string | undefined;
  readonly prizeDetailTwoLabel?: string | undefined;
  readonly prizeDetailTwoValue?: string | undefined;
  readonly prizeDetailTwoSub?: string | undefined;
  readonly prizeDetailThreeLabel?: string | undefined;
  readonly prizeDetailThreeValue?: string | undefined;
  readonly prizeDetailThreeSub?: string | undefined;
  readonly organizerTitle?: string | undefined;
  readonly organizerCompany?: string | undefined;
  readonly organizerTaxId?: string | undefined;
  readonly organizerAddress?: string | undefined;
  readonly organizerCity?: string | undefined;
  readonly drawMethodTitle?: string | undefined;
  readonly drawMethodFallbackSummary?: string | undefined;
  readonly faqTitle?: string | undefined;
  readonly faqOneQuestion?: string | undefined;
  readonly faqOneAnswer?: string | undefined;
  readonly faqTwoQuestion?: string | undefined;
  readonly faqTwoAnswer?: string | undefined;
  readonly faqThreeQuestion?: string | undefined;
  readonly faqThreeAnswer?: string | undefined;
  readonly resultsTitle?: string | undefined;
  readonly resultsPendingText?: string | undefined;
  readonly footerBrandText?: string | undefined;
  readonly footerContactTitle?: string | undefined;
  readonly footerPhone?: string | undefined;
  readonly footerEmail?: string | undefined;
  readonly footerHours?: string | undefined;
  readonly footerLinksTitle?: string | undefined;
  readonly footerSocialTitle?: string | undefined;
  readonly instagramUrl?: string | undefined;
  readonly facebookUrl?: string | undefined;
  readonly youtubeUrl?: string | undefined;
  readonly whatsappUrl?: string | undefined;
  readonly copyrightText?: string | undefined;
}

export interface SellerSettings {
  readonly brandName?: string | undefined;
  readonly brandSubtitle?: string | undefined;
  readonly organizerCompany?: string | undefined;
  readonly organizerTaxId?: string | undefined;
  readonly organizerAddress?: string | undefined;
  readonly organizerCity?: string | undefined;
  readonly supportPhone?: string | undefined;
  readonly supportEmail?: string | undefined;
  readonly supportHours?: string | undefined;
  readonly instagramUrl?: string | undefined;
  readonly facebookUrl?: string | undefined;
  readonly youtubeUrl?: string | undefined;
  readonly whatsappUrl?: string | undefined;
  readonly footerBrandText?: string | undefined;
  readonly copyrightText?: string | undefined;
  readonly defaultPaymentMethodLabel?: string | undefined;
  readonly defaultPaymentAccountHolder?: string | undefined;
  readonly defaultPaymentAccountType?: string | undefined;
  readonly defaultPaymentAccountNumber?: string | undefined;
  readonly defaultPaymentDocumentNumber?: string | undefined;
  readonly defaultPaymentInstructions?: string | undefined;
  readonly defaultPaymentQrImageUrl?: string | undefined;
  readonly paymentMethods?: readonly PaymentMethod[] | undefined;
}

export const DEFAULT_LANDING_CONFIG: RaffleLandingConfig = {
  heroBadge: 'CAMPAÑA PROMOCIONAL',
  heroTitle: 'Gana este increíble',
  heroAccent: 'premio',
  heroSubtitle: 'Participa en la dinámica activa y conoce todos los detalles del premio.',
  prizeLabel: 'Premio principal',
  brandName: 'La Bella MJ',
  brandSubtitle: 'Dinámicas',
  navbarCtaLabel: 'Comprar ahora',
  purchaseTitle: 'Compra tus participaciones',
  priceLabel: 'Precio por participación',
  submitButtonLabel: 'Pagar y recibir mis números',
  paymentMethodsLabel: 'Medios de pago',
  paymentMethodOne: 'PSE',
  paymentMethodTwo: 'Tarjetas',
  paymentMethodThree: 'Transferencia',
  trustCardOneTitle: 'Proceso claro',
  trustCardTwoTitle: 'Participación inmediata',
  howTitle: '¿Cómo funciona?',
  howSubtitle: 'Así de fácil participas y puedes ganar.',
  stepOneTitle: 'Compra',
  stepOneDescription: 'Elige tus participaciones y paga de forma segura.',
  stepTwoTitle: 'Confirmación de pago',
  stepTwoDescription: 'Verificamos tu pago al instante.',
  stepThreeTitle: 'Recibe tus números',
  stepThreeDescription: 'Tus números llegan por correo y WhatsApp.',
  prizeDetailsTitle: 'Detalles del premio',
  prizeDetailsSubtitle: 'Información del premio de la campaña.',
  prizeDetailOneLabel: 'Premio',
  prizeDetailOneValue: 'Premio principal',
  prizeDetailOneSub: 'Configura este texto desde el administrador.',
  prizeDetailTwoLabel: 'Valor comercial',
  prizeDetailTwoValue: 'Valor por definir',
  prizeDetailTwoSub: 'COP · referencia de mercado',
  prizeDetailThreeLabel: 'Entrega del premio',
  prizeDetailThreeValue: 'Según condiciones',
  prizeDetailThreeSub: 'Define cobertura, ciudad o restricciones.',
  organizerTitle: 'Organizador',
  organizerCompany: 'Empresa organizadora',
  organizerTaxId: 'NIT por definir',
  organizerAddress: 'Dirección por definir',
  organizerCity: 'Ciudad por definir',
  drawMethodTitle: 'Método del sorteo',
  drawMethodFallbackSummary: 'Resultado con fuente externa verificable.',
  faqTitle: 'Preguntas frecuentes',
  faqOneQuestion: '¿Cómo se determina el ganador?',
  faqOneAnswer:
    'El ganador se determina según la fuente externa y la regla configuradas para esta campaña.',
  faqTwoQuestion: '¿Cuándo sabré si gané?',
  faqTwoAnswer:
    'El resultado se publica en este sitio cuando se registre el sorteo y se contacta al ganador con los datos de compra.',
  faqThreeQuestion: '¿Puedo comprar desde otra ciudad?',
  faqThreeAnswer:
    'Sí. Revisa las condiciones de entrega configuradas para esta campaña antes de participar.',
  resultsTitle: 'Resultado del sorteo',
  resultsPendingText: 'El resultado se publicará aquí cuando se realice el sorteo externo.',
  footerBrandText: 'Dinámicas promocionales claras, organizadas y fáciles de participar.',
  footerContactTitle: 'Contáctanos',
  footerPhone: 'Teléfono por definir',
  footerEmail: 'correo@dominio.com',
  footerHours: 'Horario por definir',
  footerLinksTitle: 'Enlaces',
  footerSocialTitle: 'Síguenos',
  instagramUrl: '',
  facebookUrl: '',
  youtubeUrl: '',
  whatsappUrl: '',
  copyrightText: 'Todos los derechos reservados.',
};

export const DEFAULT_SELLER_SETTINGS: SellerSettings = {
  brandName: 'ORYUM',
  brandSubtitle: 'Campaigns',
  organizerCompany: 'Empresa organizadora',
  organizerTaxId: 'NIT por definir',
  organizerAddress: 'Dirección por definir',
  organizerCity: 'Ciudad por definir',
  supportPhone: 'Teléfono por definir',
  supportEmail: 'correo@dominio.com',
  supportHours: 'Horario por definir',
  instagramUrl: '',
  facebookUrl: '',
  youtubeUrl: '',
  whatsappUrl: '',
  footerBrandText: 'Campañas promocionales transparentes, seguras y con resultados verificados.',
  copyrightText: 'Todos los derechos reservados.',
  defaultPaymentMethodLabel: 'Nequi / Transferencia',
  defaultPaymentAccountHolder: '',
  defaultPaymentAccountType: '',
  defaultPaymentAccountNumber: '',
  defaultPaymentDocumentNumber: '',
  defaultPaymentInstructions: '',
  defaultPaymentQrImageUrl: '',
  paymentMethods: [],
};
