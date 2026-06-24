import { DEFAULT_LANDING_CONFIG, type PaymentMethod } from '@rifa/shared';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';

import { fetchPublicOrderStatus, submitPublicOrderWithProof } from './api';
import { Logo } from './components/Logo';
import type {
  CheckoutSession,
  CreatedOrder,
  PaymentFlowStep,
  PublicRaffle,
  PublicRaffleNumber,
} from './types';

import './checkout.css';

const formatPriceDisplay = (value: number): string =>
  `$ ${value.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

const formatMoney = (value: string, currency: string): string =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));

const computeCheckoutTotal = (raffle: PublicRaffle, quantity: number): number => {
  const landing = { ...DEFAULT_LANDING_CONFIG, ...(raffle.landingConfig ?? {}) };
  const packageMatch = (landing.participationPackages ?? []).find(
    (item) => item.quantity === quantity,
  );

  if (packageMatch?.price !== undefined && Number(packageMatch.price) > 0) {
    return Number(packageMatch.price);
  }

  return Number(raffle.pricePerNumber) * quantity;
};

const buildQrPayload = (
  session: CheckoutSession,
  totalAmount: number,
  orderRef?: string,
): string => {
  const { raffle, buyer } = session;
  const landing = { ...DEFAULT_LANDING_CONFIG, ...(raffle.landingConfig ?? {}) };
  const brandLabel = [landing.brandName, landing.brandSubtitle].filter(Boolean).join(' ');
  const lines = [
    brandLabel || 'Campaña promocional',
    ...(orderRef ? [`Orden: ${orderRef}`] : []),
    `Monto: ${formatMoney(String(totalAmount), raffle.currency)}`,
    `Referencia: ${buyer.documentNumber}`,
  ];

  if (raffle.paymentAccountNumber) {
    lines.push(`Cuenta: ${raffle.paymentAccountNumber}`);
  }

  if (raffle.paymentAccountHolder) {
    lines.push(`Titular: ${raffle.paymentAccountHolder}`);
  }

  return lines.join('\n');
};

const FLOW_STEPS: ReadonlyArray<{ id: PaymentFlowStep; label: string }> = [
  { id: 'pay', label: 'Pago y comprobante' },
  { id: 'done', label: 'Confirmación' },
];

const buildWhatsappNotificationUrl = (input: {
  readonly session: CheckoutSession;
  readonly order: CreatedOrder;
  readonly reservedNumbers: readonly PublicRaffleNumber[];
}): string | null => {
  const { session, order, reservedNumbers } = input;
  const number = (session.ownerWhatsappNumber ?? '').replace(/\D/g, '');

  if (number.length < 7) {
    return null;
  }

  const orderRef = order.id.slice(0, 8).toUpperCase();
  const numbers =
    reservedNumbers.length > 0
      ? reservedNumbers.map((item) => item.displayNumber).join(', ')
      : null;

  const lines = [
    '¡Hola! Acabo de pagar y subir mi comprobante 🧾',
    '',
    `Campaña: ${session.raffle.title}`,
    `Orden: #${orderRef}`,
    `Participaciones: ${session.quantity}`,
    `Total: ${formatMoney(order.amount, order.currency)}`,
    '',
    'Mis datos:',
    `Nombre: ${session.buyer.fullName}`,
    `Documento: ${session.buyer.documentNumber}`,
    `Teléfono: ${session.buyer.phone}`,
    `Email: ${session.buyer.email}`,
    ...(numbers ? [`Números: ${numbers}`] : []),
    '',
    'Ya subí el comprobante en la página. Adjunto también la imagen por aquí. ¡Gracias!',
  ];

  return `https://wa.me/${number}?text=${encodeURIComponent(lines.join('\n'))}`;
};

interface PaymentFlowPageProps {
  readonly session: CheckoutSession;
  readonly onBack: () => void;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_review: 'Pendiente de revisión',
  paid: 'Pago confirmado',
  rejected: 'Pago rechazado',
  cancelled: 'Cancelada',
  expired: 'Expirada',
};

export const PaymentFlowPage = ({ session, onBack }: PaymentFlowPageProps) => {
  const [step, setStep] = useState<PaymentFlowStep>('pay');
  const [selectedMethodId, setSelectedMethodId] = useState(
    () => session.paymentMethods?.[0]?.id ?? 'default',
  );
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string>('');
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(session.order ?? null);
  const [reservedNumbers, setReservedNumbers] = useState<readonly PublicRaffleNumber[]>(
    session.reservedNumbers ?? [],
  );
  const [orderStatus, setOrderStatus] = useState(session.order?.status ?? 'pending_review');
  const [assignedNumbers, setAssignedNumbers] = useState<string>('');

  const activeOrderId = createdOrder?.id ?? null;
  const totalAmount = createdOrder
    ? Number(createdOrder.amount)
    : computeCheckoutTotal(session.raffle, session.quantity);
  const orderRef = createdOrder
    ? createdOrder.id.slice(0, 8).toUpperCase()
    : session.buyer.documentNumber;

  useEffect(() => {
    if (step !== 'done' || !activeOrderId) {
      return;
    }

    let active = true;

    const pollStatus = async () => {
      try {
        const status = await fetchPublicOrderStatus(activeOrderId);

        if (!active) {
          return;
        }

        setOrderStatus(status.status);

        if (status.numbers.length > 0) {
          setAssignedNumbers(status.numbers.map((number) => number.displayNumber).join(', '));
        }
      } catch {
        // Keep last known status
      }
    };

    void pollStatus();
    const interval = window.setInterval(() => void pollStatus(), 8000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [step, activeOrderId]);

  const handleProofSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!proofFile) {
      setError('Selecciona una imagen del comprobante.');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const result = await submitPublicOrderWithProof({
        slug: session.raffle.slug,
        buyer: session.buyer,
        quantity: session.quantity,
        proofFile,
      });

      setCreatedOrder(result.order);
      setReservedNumbers(result.reservedNumbers);
      setOrderStatus(result.order.status);
      setStep('done');
      window.scrollTo({ top: 0, behavior: 'smooth' });

      const whatsappUrl = buildWhatsappNotificationUrl({
        session,
        order: result.order,
        reservedNumbers: result.reservedNumbers,
      });
      if (whatsappUrl) {
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (uploadError: unknown) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'No se pudo registrar tu compra con el comprobante.',
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Release the preview object URL when it changes or on unmount.
  useEffect(() => {
    return () => {
      if (proofPreview) {
        URL.revokeObjectURL(proofPreview);
      }
    };
  }, [proofPreview]);

  const handleProofChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setProofFile(file);
    setError('');
    setProofPreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return file ? URL.createObjectURL(file) : null;
    });
  };

  const currentStepIndex = FLOW_STEPS.findIndex((item) => item.id === step);
  const landing = { ...DEFAULT_LANDING_CONFIG, ...(session.raffle.landingConfig ?? {}) };
  const fallbackQrUrl = session.raffle.paymentQrImageUrl
    ? session.raffle.paymentQrImageUrl
    : `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(
        buildQrPayload(session, totalAmount, createdOrder ? orderRef : undefined),
      )}`;

  // Prefer the seller's configured payment methods; fall back to the single
  // legacy method built from the raffle's payment fields.
  const configuredMethods = session.paymentMethods ?? [];
  const paymentMethods: readonly PaymentMethod[] =
    configuredMethods.length > 0
      ? configuredMethods
      : [
          {
            id: 'default',
            label: session.raffle.paymentMethodLabel ?? 'Transferencia',
            accountHolder: session.raffle.paymentAccountHolder ?? undefined,
            accountType: session.raffle.paymentAccountType ?? undefined,
            accountNumber: session.raffle.paymentAccountNumber ?? undefined,
            documentNumber: session.raffle.paymentDocumentNumber ?? undefined,
            instructions: session.raffle.paymentInstructions ?? undefined,
            qrImageUrl: session.raffle.paymentQrImageUrl ?? undefined,
          },
        ];
  const isSingleLegacyMethod = configuredMethods.length === 0;

  const selectedMethod =
    paymentMethods.find((method) => method.id === selectedMethodId) ?? paymentMethods[0];

  const getMethodQrSrc = (method: PaymentMethod): string | null => {
    if (method.qrImageUrl) {
      return method.qrImageUrl;
    }

    if (isSingleLegacyMethod) {
      return fallbackQrUrl;
    }

    return null;
  };

  const selectedQrSrc = selectedMethod ? getMethodQrSrc(selectedMethod) : null;
  const whatsappNotifyUrl =
    createdOrder && step === 'done'
      ? buildWhatsappNotificationUrl({
          session,
          order: createdOrder,
          reservedNumbers,
        })
      : null;

  return (
    <div className="oryum-page checkout-page">
      <header className="navbar is-scrolled">
        <div className="container navbar-inner">
          <Logo brandName={landing.brandName ?? ''} brandSubtitle={landing.brandSubtitle ?? ''} />
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            ← Volver al inicio
          </button>
        </div>
      </header>

      <main className="container checkout-main" id="main-content">
        <header className="checkout-hero">
          <span className="badge badge-gold">
            <span className="badge-dot" /> PAGO EN PROCESO
          </span>
          <h1>Completa tu participación</h1>
          <p>
            Sigue estos pasos para confirmar tu pago. Te notificaremos por correo y WhatsApp cuando
            quede aprobado.
          </p>
        </header>

        <ol className="checkout-stepper" aria-label="Pasos del pago">
          {FLOW_STEPS.map((flowStep, index) => (
            <li
              key={flowStep.id}
              className={
                index < currentStepIndex ? 'is-done' : index === currentStepIndex ? 'is-active' : ''
              }
            >
              <span>{index + 1}</span>
              <small>{flowStep.label}</small>
            </li>
          ))}
        </ol>

        <div className="checkout-layout">
          <div className="checkout-sidebar">
            <aside className="checkout-summary-card">
            <h2>Resumen de tu orden</h2>
            <dl className="summary-list">
              <div>
                <dt>{createdOrder ? 'Referencia' : 'Referencia de pago'}</dt>
                <dd>{createdOrder ? `#${orderRef}` : orderRef}</dd>
              </div>
              <div>
                <dt>Participaciones</dt>
                <dd>{session.quantity}</dd>
              </div>
              <div>
                <dt>Total a pagar</dt>
                <dd className="summary-total">
                  {formatPriceDisplay(totalAmount)} <span>{session.raffle.currency}</span>
                </dd>
              </div>
              <div>
                <dt>Comprador</dt>
                <dd>{session.buyer.fullName}</dd>
              </div>
              <div>
                <dt>WhatsApp</dt>
                <dd>{session.buyer.phone}</dd>
              </div>
            </dl>

            {reservedNumbers.length > 0 ? (
              <div className="reserved-numbers">
                <strong>Tus números reservados</strong>
                <div className="number-chips">
                  {reservedNumbers.map((item) => (
                    <span key={item.id}>{item.displayNumber}</span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="summary-note">
                Tus números se asignarán al confirmar el pago con tu comprobante.
              </p>
            )}
            </aside>

            {step === 'pay' && paymentMethods.length > 0 ? (
              <nav className="payment-method-selector" aria-label="Medios de pago">
                <span className="payment-method-selector-label">Medio de pago</span>
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    className={`payment-method-btn${
                      selectedMethod?.id === method.id ? ' is-active' : ''
                    }`}
                    aria-pressed={selectedMethod?.id === method.id}
                    onClick={() => setSelectedMethodId(method.id)}
                  >
                    {method.label}
                  </button>
                ))}
              </nav>
            ) : null}
          </div>

          <div className="checkout-panel">
            {step === 'pay' ? (
              <section className="checkout-card" aria-labelledby="pay-title">
                <h2 id="pay-title">1. Realiza tu pago</h2>

                <ol className="instruction-steps">
                  <li>Abre tu app bancaria o billetera digital.</li>
                  <li>Escanea el QR o copia los datos de pago.</li>
                  <li>Transfiere el monto exacto con la referencia indicada.</li>
                  <li>Sube el comprobante y confirma con el botón de abajo.</li>
                </ol>

                {selectedMethod ? (
                  <div className="pay-method-card">
                    <div className="pay-grid">
                      {selectedQrSrc ? (
                        <div className="qr-box">
                          <img
                            src={selectedQrSrc}
                            alt={`Código QR para pagar con ${selectedMethod.label}`}
                            width={200}
                            height={200}
                            {...(selectedMethod.qrImageUrl ? { className: 'qr-image-uploaded' } : {})}
                          />
                        </div>
                      ) : null}

                      <div className="pay-details">
                        <ul className="pay-meta">
                          {selectedMethod.accountHolder ? (
                            <li>
                              <span>Titular</span>
                              <strong>{selectedMethod.accountHolder}</strong>
                            </li>
                          ) : null}
                          {selectedMethod.accountType ? (
                            <li>
                              <span>Tipo de cuenta</span>
                              <strong>{selectedMethod.accountType}</strong>
                            </li>
                          ) : null}
                          {selectedMethod.accountNumber ? (
                            <li>
                              <span>Cuenta / Nequi</span>
                              <strong>{selectedMethod.accountNumber}</strong>
                            </li>
                          ) : null}
                          {selectedMethod.documentNumber ? (
                            <li>
                              <span>Documento / NIT</span>
                              <strong>{selectedMethod.documentNumber}</strong>
                            </li>
                          ) : null}
                        </ul>
                      </div>
                    </div>

                    {selectedMethod.instructions ? (
                      <div className="instruction-box">
                        <strong>Instrucciones</strong>
                        <p>{selectedMethod.instructions}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <form className="proof-form" onSubmit={handleProofSubmit}>
                  <label className={`proof-upload${proofPreview ? ' has-preview' : ''}`}>
                    <input
                      accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                      onChange={handleProofChange}
                      type="file"
                      disabled={isUploading}
                    />
                    {proofPreview ? (
                      <img
                        className="proof-preview-image"
                        src={proofPreview}
                        alt="Vista previa del comprobante"
                        onError={() => {
                          setProofPreview((current) => {
                            if (current) {
                              URL.revokeObjectURL(current);
                            }
                            return null;
                          });
                        }}
                      />
                    ) : (
                      <span className="proof-upload-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none">
                          <path
                            d="M12 16V6m0 0l-3 3m3-3l3 3M4 18v1a2 2 0 002 2h12a2 2 0 002-2v-1"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    )}
                    <strong>
                      {proofFile ? proofFile.name : 'Toca para subir comprobante'}
                    </strong>
                    <small>
                      {proofFile
                        ? '✓ Comprobante listo · toca para cambiarlo'
                        : 'Foto o captura · se optimiza automáticamente'}
                    </small>
                  </label>

                  {error ? (
                    <p className="checkout-alert checkout-alert-error" role="alert">
                      {error}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    className="btn btn-primary btn-block"
                    disabled={isUploading || !proofFile}
                  >
                    {isUploading ? 'Enviando…' : 'Ya realicé el pago →'}
                  </button>
                </form>
              </section>
            ) : null}

            {step === 'done' ? (
              <section className="checkout-card checkout-card-success" aria-labelledby="done-title">
                <div className="success-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
                    <path
                      d="M8 12.5l2.5 2.5 5-5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h2 id="done-title">2. Espera la confirmación</h2>
                <p className="checkout-lead">
                  Recibimos tu comprobante. Nuestro equipo lo revisará y te avisaremos en minutos.
                </p>

                <ul className="wait-list">
                  <li>
                    <strong>Correo:</strong> {session.buyer.email}
                  </li>
                  <li>
                    <strong>WhatsApp:</strong> {session.buyer.phone}
                  </li>
                  <li>
                    <strong>Estado:</strong> {ORDER_STATUS_LABELS[orderStatus] ?? orderStatus}
                  </li>
                  {assignedNumbers ? (
                    <li>
                      <strong>Tus números:</strong> {assignedNumbers}
                    </li>
                  ) : null}
                </ul>

                <div className="instruction-box">
                  <strong>¿Qué sigue?</strong>
                  <p>
                    Verificamos que el monto y la referencia coincidan. Si todo está correcto,
                    recibirás tus números por correo y WhatsApp. Si hay algún problema, te
                    contactaremos para ayudarte.
                  </p>
                </div>

                {whatsappNotifyUrl ? (
                  <a
                    className="btn btn-whatsapp btn-block"
                    href={whatsappNotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width={18} height={18}>
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
                    Avisar al organizador por WhatsApp
                  </a>
                ) : null}

                <button type="button" className="btn btn-primary btn-block" onClick={onBack}>
                  Volver al inicio
                </button>
              </section>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
};
