import { DEFAULT_LANDING_CONFIG, type PaymentMethod } from '@rifa/shared';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';

import { fetchPublicOrderStatus, uploadPaymentProof } from './api';
import { Logo } from './components/Logo';
import type { CheckoutSession, PaymentFlowStep } from './types';

import './checkout.css';

const formatPriceDisplay = (value: number): string =>
  `$ ${value.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

const formatMoney = (value: string, currency: string): string =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));

const buildQrPayload = (session: CheckoutSession): string => {
  const { raffle, order, buyer } = session;
  const landing = { ...DEFAULT_LANDING_CONFIG, ...(raffle.landingConfig ?? {}) };
  const brandLabel = [landing.brandName, landing.brandSubtitle].filter(Boolean).join(' ');
  const lines = [
    brandLabel || 'Campaña promocional',
    `Orden: ${order.id.slice(0, 8).toUpperCase()}`,
    `Monto: ${formatMoney(order.amount, order.currency)}`,
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
  { id: 'pay', label: 'Realiza el pago' },
  { id: 'proof', label: 'Sube comprobante' },
  { id: 'done', label: 'Confirmación' },
];

const buildWhatsappNotificationUrl = (session: CheckoutSession): string | null => {
  const number = (session.ownerWhatsappNumber ?? '').replace(/\D/g, '');

  if (number.length < 7) {
    return null;
  }

  const orderRef = session.order.id.slice(0, 8).toUpperCase();
  const numbers =
    session.reservedNumbers.length > 0
      ? session.reservedNumbers.map((item) => item.displayNumber).join(', ')
      : null;

  const lines = [
    '¡Hola! Acabo de pagar y subir mi comprobante 🧾',
    '',
    `Campaña: ${session.raffle.title}`,
    `Orden: #${orderRef}`,
    `Participaciones: ${session.quantity}`,
    `Total: ${formatMoney(session.order.amount, session.order.currency)}`,
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
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string>('');
  const [orderStatus, setOrderStatus] = useState(session.order.status);
  const [assignedNumbers, setAssignedNumbers] = useState<string>('');

  useEffect(() => {
    if (step !== 'done') {
      return;
    }

    let active = true;

    const pollStatus = async () => {
      try {
        const status = await fetchPublicOrderStatus(session.order.id);

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
  }, [step, session.order.id]);

  const orderRef = session.order.id.slice(0, 8).toUpperCase();
  const totalAmount = Number(session.order.amount);

  const handleProofSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!proofFile) {
      setError('Selecciona una imagen del comprobante.');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      await uploadPaymentProof(session.order.id, proofFile);
      setStep('done');
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Additional heads-up channel: open WhatsApp to the raffle owner with the
      // order details prefilled. (WhatsApp links can't auto-attach the image;
      // the buyer can attach the screenshot manually if they wish.)
      const whatsappUrl = buildWhatsappNotificationUrl(session);
      if (whatsappUrl) {
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (uploadError: unknown) {
      setError(
        uploadError instanceof Error ? uploadError.message : 'No se pudo subir el comprobante.',
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
  const whatsappNotifyUrl = buildWhatsappNotificationUrl(session);
  const landing = { ...DEFAULT_LANDING_CONFIG, ...(session.raffle.landingConfig ?? {}) };
  const fallbackQrUrl = session.raffle.paymentQrImageUrl
    ? session.raffle.paymentQrImageUrl
    : `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(
        buildQrPayload(session),
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
          <aside className="checkout-summary-card">
            <h2>Resumen de tu orden</h2>
            <dl className="summary-list">
              <div>
                <dt>Referencia</dt>
                <dd>#{orderRef}</dd>
              </div>
              <div>
                <dt>Participaciones</dt>
                <dd>{session.quantity}</dd>
              </div>
              <div>
                <dt>Total a pagar</dt>
                <dd className="summary-total">
                  {formatPriceDisplay(totalAmount)} <span>{session.order.currency}</span>
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

            {session.reservedNumbers.length > 0 ? (
              <div className="reserved-numbers">
                <strong>Tus números reservados</strong>
                <div className="number-chips">
                  {session.reservedNumbers.map((item) => (
                    <span key={item.id}>{item.displayNumber}</span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="summary-note">Tus números se asignarán cuando el pago sea aprobado.</p>
            )}
          </aside>

          <div className="checkout-panel">
            {step === 'pay' ? (
              <section className="checkout-card" aria-labelledby="pay-title">
                <h2 id="pay-title">1. Realiza tu pago</h2>
                <p className="checkout-lead">
                  Escanea el código QR o transfiere el monto exacto. Usa la referencia de tu orden.
                </p>

                <div className="pay-amount pay-amount-block">
                  <small>Monto exacto a transferir</small>
                  <strong>{formatMoney(session.order.amount, session.order.currency)}</strong>
                  <span className="pay-reference">
                    Referencia: <strong>#{orderRef}</strong>
                  </span>
                </div>

                <div className="payment-methods-grid">
                  {paymentMethods.map((method) => {
                    const qrSrc = method.qrImageUrl
                      ? method.qrImageUrl
                      : isSingleLegacyMethod
                        ? fallbackQrUrl
                        : null;

                    return (
                      <div className="pay-method-card" key={method.id}>
                        <h3 className="pay-method-title">{method.label}</h3>

                        <div className="pay-grid">
                          {qrSrc ? (
                            <div className="qr-box">
                              <img
                                src={qrSrc}
                                alt={`Código QR para pagar con ${method.label}`}
                                width={200}
                                height={200}
                                {...(method.qrImageUrl ? { className: 'qr-image-uploaded' } : {})}
                              />
                              <span>
                                {method.qrImageUrl
                                  ? 'Escanea el QR de este método'
                                  : 'Escanea con tu app bancaria'}
                              </span>
                            </div>
                          ) : null}

                          <div className="pay-details">
                            <ul className="pay-meta">
                              {method.accountHolder ? (
                                <li>
                                  <span>Titular</span>
                                  <strong>{method.accountHolder}</strong>
                                </li>
                              ) : null}
                              {method.accountType ? (
                                <li>
                                  <span>Tipo de cuenta</span>
                                  <strong>{method.accountType}</strong>
                                </li>
                              ) : null}
                              {method.accountNumber ? (
                                <li>
                                  <span>Cuenta / Nequi</span>
                                  <strong>{method.accountNumber}</strong>
                                </li>
                              ) : null}
                              {method.documentNumber ? (
                                <li>
                                  <span>Documento / NIT</span>
                                  <strong>{method.documentNumber}</strong>
                                </li>
                              ) : null}
                            </ul>
                          </div>
                        </div>

                        {method.instructions ? (
                          <div className="instruction-box">
                            <strong>Instrucciones</strong>
                            <p>{method.instructions}</p>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <ol className="instruction-steps">
                  <li>Abre tu app bancaria o billetera digital.</li>
                  <li>Escanea el QR o copia los datos de pago.</li>
                  <li>Transfiere el monto exacto con la referencia indicada.</li>
                  <li>Guarda el comprobante y continúa al siguiente paso.</li>
                </ol>

                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={() => setStep('proof')}
                >
                  Ya realicé el pago →
                </button>
              </section>
            ) : null}

            {step === 'proof' ? (
              <section className="checkout-card" aria-labelledby="proof-title">
                <h2 id="proof-title">2. Sube tu comprobante</h2>
                <p className="checkout-lead">
                  Adjunta la captura o foto del pago. Verificaremos y te enviaremos un mensaje de
                  confirmación.
                </p>

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
                          // Some formats (e.g. HEIC on Android) can't be shown;
                          // fall back to the filename + confirmation text.
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

                  <div className="proof-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => setStep('pay')}>
                      ← Volver
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isUploading || !proofFile}
                    >
                      {isUploading ? 'Subiendo…' : 'Enviar comprobante'}
                    </button>
                  </div>
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
                <h2 id="done-title">3. Espera la confirmación</h2>
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
