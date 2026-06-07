import { DEFAULT_LANDING_CONFIG } from '@rifa/shared';
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
    } catch (uploadError: unknown) {
      setError(
        uploadError instanceof Error ? uploadError.message : 'No se pudo subir el comprobante.',
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleProofChange = (event: ChangeEvent<HTMLInputElement>) => {
    setProofFile(event.target.files?.[0] ?? null);
    setError('');
  };

  const currentStepIndex = FLOW_STEPS.findIndex((item) => item.id === step);
  const landing = { ...DEFAULT_LANDING_CONFIG, ...(session.raffle.landingConfig ?? {}) };
  const qrUrl = session.raffle.paymentQrImageUrl
    ? session.raffle.paymentQrImageUrl
    : `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(
        buildQrPayload(session),
      )}`;

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

                <div className="pay-grid">
                  <div className="qr-box">
                    <img
                      src={qrUrl}
                      alt="Código QR para realizar el pago"
                      width={220}
                      height={220}
                      {...(session.raffle.paymentQrImageUrl
                        ? { className: 'qr-image-uploaded' }
                        : {})}
                    />
                    <span>
                      {session.raffle.paymentQrImageUrl
                        ? 'Escanea el QR de pago de la campaña'
                        : 'Escanea con tu app bancaria'}
                    </span>
                  </div>

                  <div className="pay-details">
                    <div className="pay-amount">
                      <small>Monto exacto</small>
                      <strong>{formatMoney(session.order.amount, session.order.currency)}</strong>
                    </div>

                    <ul className="pay-meta">
                      <li>
                        <span>Método</span>
                        <strong>{session.raffle.paymentMethodLabel ?? 'Transferencia'}</strong>
                      </li>
                      {session.raffle.paymentAccountHolder ? (
                        <li>
                          <span>Titular</span>
                          <strong>{session.raffle.paymentAccountHolder}</strong>
                        </li>
                      ) : null}
                      {session.raffle.paymentAccountType ? (
                        <li>
                          <span>Tipo de cuenta</span>
                          <strong>{session.raffle.paymentAccountType}</strong>
                        </li>
                      ) : null}
                      {session.raffle.paymentAccountNumber ? (
                        <li>
                          <span>Cuenta / Nequi</span>
                          <strong>{session.raffle.paymentAccountNumber}</strong>
                        </li>
                      ) : null}
                      <li>
                        <span>Referencia</span>
                        <strong>#{orderRef}</strong>
                      </li>
                    </ul>
                  </div>
                </div>

                {session.raffle.paymentInstructions ? (
                  <div className="instruction-box">
                    <strong>Instrucciones</strong>
                    <p>{session.raffle.paymentInstructions}</p>
                  </div>
                ) : null}

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
                  <label className="proof-upload">
                    <input
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleProofChange}
                      type="file"
                      disabled={isUploading}
                    />
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
                    <strong>{proofFile ? proofFile.name : 'Toca para subir comprobante'}</strong>
                    <small>PNG, JPG o WEBP</small>
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
