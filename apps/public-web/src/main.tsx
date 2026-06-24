import {
  DEFAULT_LANDING_CONFIG,
  type ParticipationPackage,
  type PaymentMethod,
  type RaffleLandingConfig,
  type SellerSettings,
} from '@rifa/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';

import {
  fetchCurrentPublicRaffle,
  fetchPublicDrawResult,
  fetchPublicRaffle,
  fetchPublicSellerSettings,
  fetchPublicWinnersContent,
} from './api';
import type { PublicDrawResult } from './api';
import { Logo } from './components/Logo';
import { PaymentFlowPage } from './PaymentFlowPage';
import type { BuyerFormState, CheckoutSession, PublicRaffle, PublicWinnersContent } from './types';

import './styles.css';

const getPublicRaffleSlug = (): string | null => {
  const querySlug = new URLSearchParams(window.location.search).get('slug');
  const pathSlug = window.location.pathname.split('/').filter(Boolean)[0];
  const envSlug = import.meta.env.VITE_DEFAULT_RAFFLE_SLUG as string | undefined;

  return querySlug ?? pathSlug ?? envSlug ?? null;
};

const DEFAULT_RAFFLE_SLUG = getPublicRaffleSlug();

const initialBuyerForm: BuyerFormState = {
  fullName: '',
  documentNumber: '',
  email: '',
  phone: '',
};

const normalizeParticipationPackages = (
  packages: readonly ParticipationPackage[] | undefined,
): readonly ParticipationPackage[] => {
  const seenQuantities = new Set<number>();

  return (packages ?? [])
    .map((item) => ({
      label: item.label?.trim(),
      quantity: Math.trunc(Number(item.quantity)),
      price: item.price === undefined ? undefined : Number(item.price),
    }))
    .filter((item) => Number.isFinite(item.quantity) && item.quantity >= 1 && item.quantity <= 100)
    .filter((item) => {
      if (seenQuantities.has(item.quantity)) {
        return false;
      }

      seenQuantities.add(item.quantity);
      return true;
    })
    .sort((left, right) => left.quantity - right.quantity)
    .map((item) => ({
      quantity: item.quantity,
      ...(item.label ? { label: item.label } : {}),
      ...(Number.isFinite(item.price) && Number(item.price) > 0 ? { price: Number(item.price) } : {}),
    }));
};

const getPackagePrice = (item: ParticipationPackage, fallbackPricePerTicket: number): number => {
  const configuredPrice = Number(item.price);

  return Number.isFinite(configuredPrice) && configuredPrice > 0
    ? configuredPrice
    : fallbackPricePerTicket * item.quantity;
};

const normalizePaymentMethods = (
  methods: readonly PaymentMethod[] | undefined,
): readonly PaymentMethod[] => {
  const seen = new Set<string>();

  return (methods ?? [])
    .map((method, index) => {
      const id = method.id.trim() || `payment-method-${index + 1}`;
      const label = method.label.trim();

      return {
        id,
        label,
        ...(method.accountHolder?.trim() ? { accountHolder: method.accountHolder.trim() } : {}),
        ...(method.accountType?.trim() ? { accountType: method.accountType.trim() } : {}),
        ...(method.accountNumber?.trim() ? { accountNumber: method.accountNumber.trim() } : {}),
        ...(method.documentNumber?.trim() ? { documentNumber: method.documentNumber.trim() } : {}),
        ...(method.instructions?.trim() ? { instructions: method.instructions.trim() } : {}),
        ...(method.qrImageUrl?.trim() ? { qrImageUrl: method.qrImageUrl.trim() } : {}),
      } satisfies PaymentMethod;
    })
    .filter((method) => method.label.length > 0)
    .filter((method) => {
      // Do not dedupe by id alone. Old/migrated settings can accidentally
      // reuse ids, but two methods with the same id and different account/QR
      // data are still distinct payment options for the buyer.
      const key = [
        method.label.toLowerCase(),
        method.accountHolder ?? '',
        method.accountNumber ?? '',
        method.documentNumber ?? '',
        method.qrImageUrl ?? '',
      ].join('|');

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
};

const sellerSettingsToPaymentMethods = (
  settings: SellerSettings | null,
): readonly PaymentMethod[] => {
  if (!settings) {
    return [];
  }

  const defaultMethodDetails = {
    accountHolder: settings.defaultPaymentAccountHolder?.trim() || undefined,
    accountType: settings.defaultPaymentAccountType?.trim() || undefined,
    accountNumber: settings.defaultPaymentAccountNumber?.trim() || undefined,
    documentNumber: settings.defaultPaymentDocumentNumber?.trim() || undefined,
    instructions: settings.defaultPaymentInstructions?.trim() || undefined,
    qrImageUrl: settings.defaultPaymentQrImageUrl?.trim() || undefined,
  };
  const hasDefaultMethod = Object.values(defaultMethodDetails).some(Boolean);
  const defaultMethod: PaymentMethod | null = hasDefaultMethod
    ? {
        id: 'seller-default-payment-method',
        label: settings.defaultPaymentMethodLabel?.trim() || 'Medio de pago principal',
        ...defaultMethodDetails,
      }
    : null;

  return normalizePaymentMethods([
    ...(defaultMethod ? [defaultMethod] : []),
    ...(settings.paymentMethods ?? []),
  ]);
};

// Extracts a WhatsApp-ready phone number (digits only, international format)
// from the configured wa.me URL, falling back to the support phone.
const extractWhatsappNumber = (
  whatsappUrl: string | undefined,
  supportPhone: string | undefined,
): string => {
  const fromUrl = (whatsappUrl ?? '').replace(/\D/g, '');
  if (fromUrl.length >= 7) {
    return fromUrl;
  }

  return (supportPhone ?? '').replace(/\D/g, '');
};

const sellerSettingsToLandingDefaults = (
  settings: SellerSettings | null,
): Partial<RaffleLandingConfig> => {
  if (!settings) {
    return {};
  }

  return {
    brandName: settings.brandName,
    brandSubtitle: settings.brandSubtitle,
    organizerCompany: settings.organizerCompany,
    organizerTaxId: settings.organizerTaxId,
    organizerAddress: settings.organizerAddress,
    organizerCity: settings.organizerCity,
    footerPhone: settings.supportPhone,
    footerEmail: settings.supportEmail,
    footerHours: settings.supportHours,
    instagramUrl: settings.instagramUrl,
    facebookUrl: settings.facebookUrl,
    youtubeUrl: settings.youtubeUrl,
    whatsappUrl: settings.whatsappUrl,
    footerBrandText: settings.footerBrandText,
    copyrightText: settings.copyrightText,
  };
};

const formatPriceDisplay = (value: number): string =>
  `$ ${value.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

const textOrEmpty = (value: string | undefined): string => value ?? '';

const TRUST_CARDS = [
  {
    title: 'Pagos verificados',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M8.5 12.5l2.5 2.5 4.5-5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: 'Participación inmediata',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M13 3L4 14h6l-1 7 9-11h-6l1-7z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
] as const;

const STEPS = [
  {
    title: 'Compra',
    description: 'Elige tus participaciones y paga de forma segura.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 5h2l2 11h11l2-8H7"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="20" r="1.5" fill="currentColor" />
        <circle cx="17" cy="20" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: 'Confirmación de pago',
    description: 'Verificamos tu pago al instante.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="6" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7 15h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Recibe tus números',
    description: 'Tus números llegan por correo y WhatsApp.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 8a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 100-4V8z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M10 6v12" stroke="currentColor" strokeWidth="1.8" strokeDasharray="2 2" />
      </svg>
    ),
  },
] as const;

const PRIZE_DETAILS = [
  {
    label: 'Premio',
    value: 'Premio principal',
    sub: 'Configurable desde el administrador',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M8 21h8M12 17v4M5 4h4v3a3 3 0 003 3 3 3 0 003-3V4h4v4a7 7 0 01-14 0V4z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    label: 'Valor comercial',
    value: 'Valor por definir',
    sub: 'COP · referencia de mercado',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M20.5 12l-8.5 8.5L3.5 12 12 3.5 20.5 12z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M12 8v8M9 11h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Entrega del premio',
    value: 'Según condiciones',
    sub: 'Define cobertura o restricciones',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 7h11v9H3zM14 10h4l3 3v3h-7"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <circle cx="7.5" cy="17.5" r="1.8" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.5" cy="17.5" r="1.8" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
] as const;

const INFO_BLOCKS = [
  {
    title: 'Organizador',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 10l9-6 9 6v1H3v-1zM5 12v7h14v-7M5 19h14"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M8 12v7M12 12v7M16 12v7" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
    details: [
      { label: 'Empresa', value: 'Empresa organizadora' },
      { label: 'NIT', value: 'NIT por definir' },
      { label: 'Dirección', value: 'Dirección por definir' },
      { label: 'Ciudad', value: 'Ciudad por definir' },
    ],
  },
  {
    title: 'Método del sorteo',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M3 12h18M12 3a13 13 0 010 18M12 3a13 13 0 000 18"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    ),
    summary: 'Resultado con fuente externa verificable.',
  },
] as const;

const CartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M3 5h2l2 11h11l2-8H7"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="9" cy="20" r="1.5" fill="currentColor" />
    <circle cx="17" cy="20" r="1.5" fill="currentColor" />
  </svg>
);

interface FaqItemProps {
  readonly question: string;
  readonly answer: string;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
}

const FaqCard = ({ question, answer, isOpen, onToggle }: FaqItemProps) => (
  <article className={`faq-card${isOpen ? ' is-open' : ''}`}>
    <button type="button" className="faq-trigger" aria-expanded={isOpen} onClick={onToggle}>
      <span>{question}</span>
      <span className="faq-toggle" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
    </button>
    {isOpen ? <p className="faq-answer">{answer}</p> : null}
  </article>
);

function App() {
  const [quantity, setQuantity] = useState<number>(1);
  const [buyerForm, setBuyerForm] = useState<BuyerFormState>(initialBuyerForm);
  const [checkoutSession, setCheckoutSession] = useState<CheckoutSession | null>(null);
  const [raffle, setRaffle] = useState<PublicRaffle | null>(null);
  const [drawResult, setDrawResult] = useState<PublicDrawResult | null>(null);
  const [winnersContent, setWinnersContent] = useState<PublicWinnersContent>({
    winners: [],
    gallery: [],
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [loadError, setLoadError] = useState<string>('');
  const [sellerSettings, setSellerSettings] = useState<SellerSettings | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [navScrolled, setNavScrolled] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);

  const pricePerTicket = raffle ? Number(raffle.pricePerNumber) : 10_000;
  const landing: RaffleLandingConfig = {
    ...DEFAULT_LANDING_CONFIG,
    ...sellerSettingsToLandingDefaults(sellerSettings),
    ...(raffle?.landingConfig ?? {}),
  };
  const participationPackages = normalizeParticipationPackages(landing.participationPackages);
  const hasParticipationPackages = participationPackages.length > 0;
  const selectedParticipationPackage = participationPackages.find((item) => item.quantity === quantity);
  const displayPurchasePrice = selectedParticipationPackage
    ? getPackagePrice(selectedParticipationPackage, pricePerTicket)
    : pricePerTicket;
  const heroImageSrc = raffle?.coverImageUrl ?? '/motorcycle-prize-nobg.png';
  const heroImageAlt = landing.prizeLabel ?? raffle?.title ?? 'Premio de la campaña';
  const drawSummary =
    raffle?.drawSourceName && raffle.drawRule
      ? `${raffle.drawSourceName} — ${raffle.drawRule}`
      : (raffle?.drawSourceName ?? landing.drawMethodFallbackSummary);
  const trustCards = [
    { ...TRUST_CARDS[0], title: textOrEmpty(landing.trustCardOneTitle) },
    { ...TRUST_CARDS[1], title: textOrEmpty(landing.trustCardTwoTitle) },
  ].filter((card) => card.title.trim().length > 0);
  const steps = [
    {
      ...STEPS[0],
      title: textOrEmpty(landing.stepOneTitle),
      description: textOrEmpty(landing.stepOneDescription),
    },
    {
      ...STEPS[1],
      title: textOrEmpty(landing.stepTwoTitle),
      description: textOrEmpty(landing.stepTwoDescription),
    },
    {
      ...STEPS[2],
      title: textOrEmpty(landing.stepThreeTitle),
      description: textOrEmpty(landing.stepThreeDescription),
    },
  ].filter((step) => step.title.trim().length > 0 || step.description.trim().length > 0);
  const prizeDetails = [
    {
      ...PRIZE_DETAILS[0],
      label: textOrEmpty(landing.prizeDetailOneLabel),
      value: textOrEmpty(landing.prizeDetailOneValue),
      sub: textOrEmpty(landing.prizeDetailOneSub),
    },
    {
      ...PRIZE_DETAILS[1],
      label: textOrEmpty(landing.prizeDetailTwoLabel),
      value: textOrEmpty(landing.prizeDetailTwoValue),
      sub: textOrEmpty(landing.prizeDetailTwoSub),
    },
    {
      ...PRIZE_DETAILS[2],
      label: textOrEmpty(landing.prizeDetailThreeLabel),
      value: textOrEmpty(landing.prizeDetailThreeValue),
      sub: textOrEmpty(landing.prizeDetailThreeSub),
    },
  ].filter((detail) => detail.label.trim().length > 0 || detail.value.trim().length > 0);
  const organizerDetails = [
    { label: 'Empresa', value: textOrEmpty(landing.organizerCompany) },
    { label: 'NIT', value: textOrEmpty(landing.organizerTaxId) },
    { label: 'Dirección', value: textOrEmpty(landing.organizerAddress) },
    { label: 'Ciudad', value: textOrEmpty(landing.organizerCity) },
  ].filter((item) => item.value.trim().length > 0);
  const faqItems = [
    { question: textOrEmpty(landing.faqOneQuestion), answer: textOrEmpty(landing.faqOneAnswer) },
    { question: textOrEmpty(landing.faqTwoQuestion), answer: textOrEmpty(landing.faqTwoAnswer) },
    {
      question: textOrEmpty(landing.faqThreeQuestion),
      answer: textOrEmpty(landing.faqThreeAnswer),
    },
  ].filter((item) => item.question.trim().length > 0 && item.answer.trim().length > 0);
  const configuredPaymentMethods = sellerSettingsToPaymentMethods(sellerSettings);
  const fallbackPaymentMethodLabels = [
    landing.paymentMethodOne,
    landing.paymentMethodTwo,
    landing.paymentMethodThree,
  ].filter((item): item is string => Boolean(item?.trim()));
  const paymentMethodLabels =
    configuredPaymentMethods.length > 0
      ? configuredPaymentMethods.map((method) => method.label)
      : fallbackPaymentMethodLabels;
  const socialLinks = [
    { label: 'Instagram', href: landing.instagramUrl, icon: 'instagram' },
    { label: 'Facebook', href: landing.facebookUrl, icon: 'facebook' },
    { label: 'YouTube', href: landing.youtubeUrl, icon: 'youtube' },
    { label: 'WhatsApp', href: landing.whatsappUrl, icon: 'whatsapp' },
  ].filter((item): item is { label: string; href: string; icon: string } =>
    Boolean(item.href?.trim()),
  );

  useEffect(() => {
    let active = true;

    const loadCampaign = async () => {
      try {
        const selectedRaffle = DEFAULT_RAFFLE_SLUG
          ? await fetchPublicRaffle(DEFAULT_RAFFLE_SLUG)
          : await fetchCurrentPublicRaffle();
        const activeSlug = selectedRaffle.slug;
        const [loadedRaffle, result, loadedWinnersContent] = await Promise.all([
          Promise.resolve(selectedRaffle),
          fetchPublicDrawResult(activeSlug).catch(() => null),
          fetchPublicWinnersContent(activeSlug).catch(() => ({ winners: [], gallery: [] })),
        ]);

        if (!active) {
          return;
        }

        setRaffle(loadedRaffle);
        setDrawResult(result);
        setWinnersContent(loadedWinnersContent);
        setLoadError('');
      } catch (error: unknown) {
        if (active) {
          setLoadError(
            error instanceof Error ? error.message : 'No se pudo cargar la campaña activa.',
          );
        }
      } finally {
        if (active) {
          setIsInitialLoading(false);
        }
      }
    };

    void loadCampaign();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void fetchPublicSellerSettings()
      .then((data) => {
        setSellerSettings(data);
      })
      .catch(() => {
        setSellerSettings(null);
      });
  }, []);

  useEffect(() => {
    const firstPackage = participationPackages[0];

    if (firstPackage && !participationPackages.some((item) => item.quantity === quantity)) {
      setQuantity(firstPackage.quantity);
    }
  }, [participationPackages, quantity]);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const updateBuyerField = (field: keyof BuyerFormState, value: string) => {
    setBuyerForm((current) => ({ ...current, [field]: value }));
    setSubmitError('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');

    try {
      if (!raffle) {
        throw new Error('Por ahora no hay eventos activos.');
      }

      const activeRaffle = raffle;
      let currentSellerSettings = sellerSettings;

      if (!currentSellerSettings) {
        currentSellerSettings = await fetchPublicSellerSettings().catch(() => null);

        if (currentSellerSettings) {
          setSellerSettings(currentSellerSettings);
        }
      }

      const currentPaymentMethods = sellerSettingsToPaymentMethods(currentSellerSettings);

      setCheckoutSession({
        raffle: activeRaffle,
        buyer: buyerForm,
        quantity,
        paymentMethods: currentPaymentMethods,
        ownerWhatsappNumber: extractWhatsappNumber(
          currentSellerSettings?.whatsappUrl,
          currentSellerSettings?.supportPhone,
        ),
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : 'No se pudo crear la orden.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checkoutSession) {
    return (
      <PaymentFlowPage
        session={checkoutSession}
        onBack={() => {
          setCheckoutSession(null);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  // Show a loading screen until the real campaign data is ready, instead of
  // flashing the default/mock content.
  if (isInitialLoading) {
    return (
      <div className="oryum-page page-loading">
        <div className="page-loading-inner" role="status" aria-live="polite">
          <span className="page-loading-spinner" aria-hidden="true" />
          <p>Cargando la campaña…</p>
        </div>
      </div>
    );
  }

  if (!raffle) {
    return (
      <div className="oryum-page page-loading">
        <div className="page-loading-inner" role="status" aria-live="polite">
          <h1>No hay campañas activas</h1>
          <p>{loadError || 'Por ahora no hay eventos disponibles. Vuelve pronto.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="oryum-page">
      <header className={`navbar${navScrolled ? ' is-scrolled' : ''}`} id="inicio">
        <div className="container navbar-inner">
          <Logo
            brandName={textOrEmpty(landing.brandName)}
            brandSubtitle={textOrEmpty(landing.brandSubtitle)}
          />
          <a className="btn btn-primary navbar-cta" href="#comprar">
            <CartIcon /> {landing.navbarCtaLabel}
          </a>
        </div>
      </header>

      <main id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-bg" aria-hidden="true">
            <div className="hero-glow hero-glow-1" />
            <div className="hero-glow hero-glow-2" />
            <div className="hero-grid" />
          </div>

          <div className="container hero-stage">
            <div className="hero-promo">
              <div className="hero-visual">
                <div className="hero-curve hero-curve-1" />
                <div className="hero-curve hero-curve-2" />
                <img
                  className="hero-motorcycle"
                  src={heroImageSrc}
                  alt={heroImageAlt}
                  width={1024}
                  height={682}
                  loading="eager"
                  fetchPriority="high"
                />
                <div className="hero-visual-shadow" />
              </div>

              <div className="hero-copy">
                <div className="hero-copy-intro">
                  <span className="badge badge-gold">
                    <span className="badge-dot" /> {landing.heroBadge}
                  </span>
                  <h1 id="hero-title" className="hero-title">
                    {landing.heroTitle} <span className="accent">{landing.heroAccent}</span>
                  </h1>
                  <p className="hero-subtitle">{landing.heroSubtitle}</p>
                </div>

                {steps.length > 0 ? (
                  <ol className="hero-highlights" aria-label="Pasos para participar">
                    {steps.map((step, index) => (
                      <li key={`${step.title}-${index}`} className="hero-highlight-item">
                        <span className="hero-highlight-index" aria-hidden="true">
                          {index + 1}
                        </span>
                        <div className="hero-highlight-body">
                          <strong>{step.title}</strong>
                          {step.description ? <p>{step.description}</p> : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : null}

                {trustCards.length > 0 ? (
                  <div className="trust-grid">
                    {trustCards.map((card) => (
                      <div key={card.title} className="trust-card">
                        <span className="trust-icon">{card.icon}</span>
                        <strong>{card.title}</strong>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <aside className="purchase-card" id="comprar" aria-label="Compra tus participaciones">
              {!raffle && loadError ? (
                <div className="no-event-card" role="status">
                  <span className="no-event-icon" aria-hidden="true">
                    ✦
                  </span>
                  <h2>Por ahora no hay eventos activos</h2>
                  <p>
                    Estamos preparando la próxima campaña. Cuando haya una rifa activa, podrás
                    comprar tus participaciones desde esta página.
                  </p>
                </div>
              ) : (
                <>
                  <header>
                    <h2>{landing.purchaseTitle}</h2>
                    <p className="purchase-label">{landing.priceLabel}</p>
                    <p className="purchase-price">
                      <span className="price-amount">{formatPriceDisplay(displayPurchasePrice)}</span>
                      <span className="price-currency">COP</span>
                    </p>
                  </header>

                  <form onSubmit={handleSubmit} className="purchase-form">
                    {hasParticipationPackages ? (
                      <fieldset className="package-picker">
                        <legend className="field-label">Elige tu paquete</legend>
                        <div className="package-options">
                          {participationPackages.map((item) => {
                            const isSelected = quantity === item.quantity;
                            const label = item.label?.trim() || `${item.quantity} números`;
                            const total = getPackagePrice(item, pricePerTicket);

                            return (
                              <button
                                key={item.quantity}
                                type="button"
                                className={`package-option${isSelected ? ' is-selected' : ''}`}
                                aria-pressed={isSelected}
                                onClick={() => setQuantity(item.quantity)}
                              >
                                <strong>{label}</strong>
                                <span>{formatPriceDisplay(total)} COP</span>
                              </button>
                            );
                          })}
                        </div>
                      </fieldset>
                    ) : (
                      <label className="quantity-row">
                        <span className="field-label">Cantidad</span>
                        <div className="quantity-control">
                          <button
                            type="button"
                            aria-label="Disminuir cantidad"
                            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          >
                            −
                          </button>
                          <span aria-live="polite">{quantity}</span>
                          <button
                            type="button"
                            aria-label="Aumentar cantidad"
                            onClick={() => setQuantity((q) => Math.min(100, q + 1))}
                          >
                            +
                          </button>
                        </div>
                      </label>
                    )}

                    <label className="input-field">
                      <span aria-hidden="true" className="input-icon">
                        <svg viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.7" />
                          <path
                            d="M4 21a8 8 0 0116 0"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                      <input
                        type="text"
                        placeholder="Nombre completo"
                        autoComplete="name"
                        required
                        value={buyerForm.fullName}
                        onChange={(event) => updateBuyerField('fullName', event.target.value)}
                      />
                    </label>

                    <label className="input-field">
                      <span aria-hidden="true" className="input-icon">
                        <svg viewBox="0 0 24 24" fill="none">
                          <rect
                            x="3"
                            y="5"
                            width="18"
                            height="14"
                            rx="2.5"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                          <path
                            d="M7 10h6M7 14h10"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                      <input
                        type="text"
                        placeholder="Número de documento"
                        required
                        value={buyerForm.documentNumber}
                        onChange={(event) => updateBuyerField('documentNumber', event.target.value)}
                      />
                    </label>

                    <label className="input-field">
                      <span aria-hidden="true" className="input-icon">
                        <svg viewBox="0 0 24 24" fill="none">
                          <rect
                            x="3"
                            y="5"
                            width="18"
                            height="14"
                            rx="2.5"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                          <path
                            d="M3 7l9 6 9-6"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <input
                        type="email"
                        placeholder="Correo electrónico"
                        autoComplete="email"
                        required
                        value={buyerForm.email}
                        onChange={(event) => updateBuyerField('email', event.target.value)}
                      />
                    </label>

                    <label className="input-field">
                      <span aria-hidden="true" className="input-icon icon-whatsapp">
                        <svg viewBox="0 0 24 24" fill="none">
                          <path
                            d="M3.5 20.5l1.4-4.2a8 8 0 113.1 3.1L3.5 20.5z"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M9 10.2c.4 2 2 3.6 4 4l1-1.3a1 1 0 011.2-.3l1.4.6a1 1 0 01.6 1.2 3 3 0 01-3 2.2 7 7 0 01-6.6-6.6 3 3 0 012.2-3 1 1 0 011.2.6l.6 1.4a1 1 0 01-.3 1.2L9 10.2z"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <input
                        type="tel"
                        placeholder="WhatsApp (300 123 4567)"
                        autoComplete="tel"
                        required
                        value={buyerForm.phone}
                        onChange={(event) => updateBuyerField('phone', event.target.value)}
                      />
                    </label>

                    {loadError ? (
                      <p className="form-error" role="alert">
                        {loadError}
                      </p>
                    ) : null}
                    {submitError ? (
                      <p className="form-error" role="alert">
                        {submitError}
                      </p>
                    ) : null}

                    <button
                      type="submit"
                      className="btn btn-primary btn-block"
                      disabled={isSubmitting}
                    >
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <rect
                          x="4"
                          y="10"
                          width="16"
                          height="11"
                          rx="2.5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        />
                        <path
                          d="M8 10V7a4 4 0 018 0v3"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                      {isSubmitting ? 'Procesando…' : landing.submitButtonLabel}
                    </button>

                    {paymentMethodLabels.length > 0 ? (
                      <div className="payment-methods">
                        <span>{landing.paymentMethodsLabel}</span>
                        <div className="method-pills">
                          {paymentMethodLabels.map((method) => (
                            <span key={method} className="pill">
                              {method}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </form>
                </>
              )}
            </aside>
          </div>
        </section>

        <section className="container two-col-section">
          <div
            className="feature-column how-it-works"
            id="como-funciona"
            aria-labelledby="how-title"
          >
            <header className="section-head section-head-balanced">
              <h2 id="how-title">{landing.howTitle}</h2>
              <p>{landing.howSubtitle}</p>
            </header>
            <ol className="mini-cards-grid steps-grid">
              {steps.map((step, index) => (
                <li key={step.title} className="mini-card step-card">
                  <span className="step-index">{index + 1}</span>
                  <span className="mini-card-icon step-icon" aria-hidden="true">
                    {step.icon}
                  </span>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="feature-column prize-details" aria-labelledby="prize-title">
            <header className="section-head section-head-balanced section-head-solo">
              <h2 id="prize-title">{landing.prizeDetailsTitle}</h2>
              <p className="section-head-spacer" aria-hidden="true">
                {landing.prizeDetailsSubtitle}
              </p>
            </header>
            <div className="mini-cards-grid prize-grid">
              {prizeDetails.map((detail) => (
                <article key={detail.label} className="mini-card prize-card">
                  <span className="mini-card-icon prize-icon">{detail.icon}</span>
                  <small>{detail.label}</small>
                  <strong>{detail.value}</strong>
                  <p>{detail.sub}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="container info-strip"
          id="info-campana"
          aria-label="Información de la campaña"
        >
          <div className="info-grid">
            <article className="info-card">
              <span className="info-icon">{INFO_BLOCKS[0].icon}</span>
              <div className="info-card-body">
                <strong>{landing.organizerTitle}</strong>
                <dl className="info-details-cols">
                  {organizerDetails.map((item) => (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </article>
            <div className="info-divider" aria-hidden="true" />
            <article className="info-card">
              <span className="info-icon">{INFO_BLOCKS[1].icon}</span>
              <div className="info-card-body">
                <strong>{landing.drawMethodTitle}</strong>
                <p>{drawSummary}</p>
              </div>
            </article>
          </div>
        </section>

        <section className="container faq-section" id="faq" aria-labelledby="faq-title">
          <header className="section-head section-head-tight">
            <h2 id="faq-title">{landing.faqTitle}</h2>
          </header>
          <div className="faq-grid">
            {faqItems.map((item, index) => (
              <FaqCard
                key={item.question}
                question={item.question}
                answer={item.answer}
                isOpen={openFaqIndex === index}
                onToggle={() => setOpenFaqIndex((current) => (current === index ? null : index))}
              />
            ))}
          </div>
        </section>

        <section
          className="container results-section"
          id="resultados"
          aria-labelledby="results-title"
        >
          <header className="section-head section-head-tight">
            <h2 id="results-title">{landing.resultsTitle}</h2>
          </header>
          {drawResult ? (
            <article className="result-card">
              <p className="result-winner-label">Número ganador</p>
              <p className="result-winner-number">{drawResult.winningNumber}</p>
              <p className="muted">
                Fuente: {drawResult.externalSource}
                {drawResult.winnerDisplayName ? ` · Ganador: ${drawResult.winnerDisplayName}` : ''}
              </p>
            </article>
          ) : (
            <p className="muted">{landing.resultsPendingText}</p>
          )}

          {winnersContent.gallery.length > 0 ? (
            <section className="delivery-gallery" aria-label="Fotos de entregas">
              <header className="section-head section-head-tight">
                <h3>Entregas y momentos reales</h3>
                <p>Fotos compartidas por la organización para mostrar transparencia y confianza.</p>
              </header>
              <div className="delivery-carousel" role="list">
                {winnersContent.gallery.map((image) => (
                  <article className="delivery-card" key={image.id} role="listitem">
                    <img src={image.imageUrl} alt={image.title ?? 'Foto de entrega'} loading="lazy" />
                    {(image.title || image.caption) ? (
                      <div>
                        {image.title ? <strong>{image.title}</strong> : null}
                        {image.caption ? <p>{image.caption}</p> : null}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {winnersContent.winners.length > 0 ? (
            <section className="public-winners" aria-label="Ganadores destacados">
              <header className="section-head section-head-tight">
                <h3>Ganadores destacados</h3>
                <p>Personas que ya participaron y fueron registradas como ganadoras.</p>
              </header>
              <div className="public-winners-grid">
                {winnersContent.winners.map((winner) => (
                  <article className="public-winner-card" key={winner.id}>
                    {winner.winnerPhotoUrl ? (
                      <img
                        src={winner.winnerPhotoUrl}
                        alt={`Foto de ${winner.winnerDisplayName ?? 'ganador'}`}
                        loading="lazy"
                      />
                    ) : null}
                    <div className="public-winner-body">
                      <span>{winner.raffleTitle}</span>
                      <strong>{winner.winnerDisplayName ?? 'Ganador verificado'}</strong>
                      <p>Número ganador: {winner.winningNumber}</p>
                      {winner.winnerComment ? <blockquote>{winner.winnerComment}</blockquote> : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </section>
      </main>

      <footer className="footer" id="contacto">
        <div className="container footer-grid">
          <div className="footer-brand">
            <Logo
              brandName={textOrEmpty(landing.brandName)}
              brandSubtitle={textOrEmpty(landing.brandSubtitle)}
            />
            <p>{landing.footerBrandText}</p>
          </div>

          <div className="footer-col">
            <h3>{landing.footerContactTitle}</h3>
            <ul>
              <li>
                <span className="footer-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3.5 20.5l1.4-4.2a8 8 0 113.1 3.1L3.5 20.5z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {landing.footerPhone}
              </li>
              <li>
                <span className="footer-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <rect
                      x="3"
                      y="5"
                      width="18"
                      height="14"
                      rx="2.5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    />
                    <path
                      d="M3 7l9 6 9-6"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {landing.footerEmail}
              </li>
              <li>
                <span className="footer-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
                    <path
                      d="M12 7v5l3 2"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                {landing.footerHours}
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h3>{landing.footerLinksTitle}</h3>
            <ul className="footer-links">
              <li>
                <a href="#inicio">Inicio</a>
              </li>
              <li>
                <a href="#como-funciona">Cómo funciona</a>
              </li>
              <li>
                <a href="#resultados">Resultados</a>
              </li>
              <li>
                <a href="#info-campana">Información</a>
              </li>
              <li>
                <a href="#contacto">Contacto</a>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h3>{landing.footerSocialTitle}</h3>
            <div className="social-row">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  aria-label={link.label}
                  className="social-icon"
                  target="_blank"
                  rel="noreferrer"
                >
                  {link.icon === 'instagram' ? (
                    <svg viewBox="0 0 24 24" fill="none">
                      <rect
                        x="3"
                        y="3"
                        width="18"
                        height="18"
                        rx="5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
                      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
                    </svg>
                  ) : null}
                  {link.icon === 'facebook' ? (
                    <svg viewBox="0 0 24 24" fill="none">
                      <path
                        d="M14 8h2V5h-2.5A3.5 3.5 0 0010 8.5V11H8v3h2v7h3v-7h2.5l.5-3H13V8.5c0-.3.2-.5.5-.5H14z"
                        fill="currentColor"
                      />
                    </svg>
                  ) : null}
                  {link.icon === 'youtube' ? (
                    <svg viewBox="0 0 24 24" fill="none">
                      <rect
                        x="3"
                        y="6"
                        width="18"
                        height="12"
                        rx="3"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                      <path d="M11 10l4 2-4 2v-4z" fill="currentColor" />
                    </svg>
                  ) : null}
                  {link.icon === 'whatsapp' ? (
                    <svg viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 3.5a8.5 8.5 0 00-7.3 12.8L3.5 20.5l4.4-1.1A8.5 8.5 0 1012 3.5z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9.2 8.2c.2-.5.4-.5.6-.5h.5c.2 0 .4 0 .6.5l.6 1.4c.1.2 0 .4 0 .5l-.4.5c-.1.2-.2.3 0 .6.3.5.7 1 1.2 1.3.5.3.7.3.9.2l.5-.4c.2-.2.4-.1.5-.1l1.3.6c.2.1.4.2.4.4 0 .5-.2 1.2-.7 1.5-.5.3-1.4.5-2.6 0-1.6-.6-3-2-3.8-3.6-.5-1-.4-1.8-.1-2.4z"
                        fill="currentColor"
                      />
                    </svg>
                  ) : null}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="container footer-bottom-inner">
            <span>
              © {new Date().getFullYear()} {landing.brandName} {landing.brandSubtitle}.{' '}
              {landing.copyrightText}
            </span>
            <span className="footer-meta">
              <span className="footer-secure">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect
                    x="5"
                    y="10"
                    width="14"
                    height="10"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                  <path
                    d="M8 10V7a4 4 0 018 0v3"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
                Sitio seguro
              </span>
              <span className="footer-divider" aria-hidden="true">
                |
              </span>
              <span>
                Hecho en Colombia <span className="flag-co" aria-hidden="true" />
              </span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element was not found.');
}

createRoot(rootElement).render(<App />);
