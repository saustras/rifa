import { DEFAULT_LANDING_CONFIG } from '@rifa/shared';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { ImageUploadField } from '../components/ImageUploadField';
import {
  activateRaffle,
  createPrize,
  createRaffle,
  deletePrize,
  fetchDrawResult,
  fetchPrizes,
  fetchRaffleById,
  registerDrawResult,
  updateRaffle,
  uploadRaffleCover,
  uploadRafflePaymentQr,
} from '../api';
import { PUBLIC_WEB_URL } from '../config';
import type {
  AdminCredentials,
  AdminPrize,
  CreateRaffleInput,
  DrawResult,
  RaffleLandingConfig,
  UpdateRaffleInput,
} from '../types';

type FormTab = 'general' | 'marketing' | 'numbers' | 'payments' | 'draw';
type MarketingTab = 'cover' | 'hero' | 'trust' | 'steps' | 'faq' | 'footer';

interface CampaignFormPageProps {
  readonly credentials: AdminCredentials;
  readonly raffleId: string | null;
  readonly activeCampaignId: string | null;
  readonly onDone: () => void;
  readonly onCancel: () => void;
}

const defaultForm: CreateRaffleInput = {
  title: '',
  slug: '',
  description: '',
  status: 'draft',
  pricePerNumber: 10_000,
  currency: 'COP',
  numberMin: 0,
  numberMax: 99,
  numberPadding: 2,
  assignmentMode: 'customer_choice',
  paymentMethodLabel: 'Nequi / Transferencia',
  paymentAccountHolder: '',
  paymentAccountNumber: '',
  paymentInstructions: '',
  landingConfig: { ...DEFAULT_LANDING_CONFIG },
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const readLanding = (config?: RaffleLandingConfig | null): RaffleLandingConfig => ({
  ...DEFAULT_LANDING_CONFIG,
  ...(config ?? {}),
});

const TAB_LABELS: Record<FormTab, string> = {
  general: 'General',
  marketing: 'Publicidad',
  numbers: 'Participaciones',
  payments: 'Pagos',
  draw: 'Sorteo',
};

const MARKETING_TAB_LABELS: Record<MarketingTab, string> = {
  cover: 'Portada',
  hero: 'Texto principal',
  trust: 'Compra y confianza',
  steps: 'Cómo funciona',
  faq: 'Preguntas',
  footer: 'Resultado y pie',
};

export const CampaignFormPage = ({
  credentials,
  raffleId,
  activeCampaignId,
  onDone,
  onCancel,
}: CampaignFormPageProps) => {
  const [form, setForm] = useState<CreateRaffleInput>(defaultForm);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const [paymentQrImageUrl, setPaymentQrImageUrl] = useState<string | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [pendingQrFile, setPendingQrFile] = useState<File | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const [activeTab, setActiveTab] = useState<FormTab>('general');
  const [activeMarketingTab, setActiveMarketingTab] = useState<MarketingTab>('cover');
  const [isLoading, setIsLoading] = useState(Boolean(raffleId));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [prizes, setPrizes] = useState<readonly AdminPrize[]>([]);
  const [drawResult, setDrawResult] = useState<DrawResult | null>(null);
  const [newPrizeTitle, setNewPrizeTitle] = useState('');
  const [drawWinningNumber, setDrawWinningNumber] = useState('');
  const [drawSource, setDrawSource] = useState('');
  const [drawNotes, setDrawNotes] = useState('');

  const isLiveCampaign = Boolean(raffleId && activeCampaignId === raffleId);
  const landing = useMemo(() => readLanding(form.landingConfig), [form.landingConfig]);

  useEffect(() => {
    if (!raffleId) {
      return;
    }

    let active = true;

    const load = async () => {
      setIsLoading(true);
      setError('');

      try {
        const raffle = await fetchRaffleById(credentials, raffleId);

        if (!active) {
          return;
        }

        setForm({
          title: raffle.title,
          slug: raffle.slug,
          description: raffle.description ?? '',
          status: raffle.status,
          pricePerNumber: Number(raffle.pricePerNumber),
          currency: raffle.currency,
          numberMin: raffle.numberMin,
          numberMax: raffle.numberMax,
          assignmentMode: raffle.assignmentMode ?? 'customer_choice',
          paymentMethodLabel: raffle.paymentMethodLabel ?? '',
          paymentAccountHolder: raffle.paymentAccountHolder ?? '',
          paymentAccountType: raffle.paymentAccountType ?? '',
          paymentAccountNumber: raffle.paymentAccountNumber ?? '',
          paymentDocumentNumber: raffle.paymentDocumentNumber ?? '',
          paymentInstructions: raffle.paymentInstructions ?? '',
          drawSourceName: raffle.drawSourceName ?? '',
          drawRule: raffle.drawRule ?? '',
          landingConfig: readLanding(raffle.landingConfig),
        });
        setCoverImageUrl(raffle.coverImageUrl ?? null);
        setPaymentQrImageUrl(raffle.paymentQrImageUrl ?? null);
      } catch (loadError: unknown) {
        if (active) {
          setError(
            loadError instanceof Error ? loadError.message : 'No se pudo cargar la campaña.',
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [credentials, raffleId]);

  useEffect(() => {
    if (!raffleId) {
      return;
    }

    let active = true;

    const loadExtras = async () => {
      try {
        const [nextPrizes, nextDraw] = await Promise.all([
          fetchPrizes(credentials, raffleId),
          fetchDrawResult(credentials, raffleId),
        ]);

        if (!active) {
          return;
        }

        setPrizes(nextPrizes);
        setDrawResult(nextDraw);
      } catch {
        // Non-blocking extras
      }
    };

    void loadExtras();

    return () => {
      active = false;
    };
  }, [credentials, raffleId]);

  const updateLanding = (patch: Partial<RaffleLandingConfig>) => {
    setForm((current) => ({
      ...current,
      landingConfig: { ...readLanding(current.landingConfig), ...patch },
    }));
  };

  const updateLandingField = (field: keyof RaffleLandingConfig, value: string) => {
    updateLanding({ [field]: value } as Partial<RaffleLandingConfig>);
  };

  const buildPayload = (): CreateRaffleInput | UpdateRaffleInput => ({
    title: form.title,
    slug: form.slug,
    pricePerNumber: form.pricePerNumber,
    landingConfig: readLanding(form.landingConfig),
    ...(form.description ? { description: form.description } : {}),
    ...(form.status ? { status: form.status } : {}),
    ...(form.paymentMethodLabel ? { paymentMethodLabel: form.paymentMethodLabel } : {}),
    ...(form.paymentAccountHolder ? { paymentAccountHolder: form.paymentAccountHolder } : {}),
    ...(form.paymentAccountType ? { paymentAccountType: form.paymentAccountType } : {}),
    ...(form.paymentAccountNumber ? { paymentAccountNumber: form.paymentAccountNumber } : {}),
    ...(form.paymentDocumentNumber ? { paymentDocumentNumber: form.paymentDocumentNumber } : {}),
    ...(form.paymentInstructions ? { paymentInstructions: form.paymentInstructions } : {}),
    ...(form.drawSourceName ? { drawSourceName: form.drawSourceName } : {}),
    ...(form.drawRule ? { drawRule: form.drawRule } : {}),
  });

  const persistCoverIfNeeded = async (targetRaffleId: string) => {
    if (!pendingCoverFile) {
      return;
    }

    const uploadedUrl = await uploadRaffleCover(credentials, targetRaffleId, pendingCoverFile);
    setCoverImageUrl(uploadedUrl);
    setCoverPreview(null);
    setPendingCoverFile(null);
  };

  const persistQrIfNeeded = async (targetRaffleId: string) => {
    if (!pendingQrFile) {
      return;
    }

    const uploadedUrl = await uploadRafflePaymentQr(credentials, targetRaffleId, pendingQrFile);
    setPaymentQrImageUrl(uploadedUrl);
    setQrPreview(null);
    setPendingQrFile(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      let targetId = raffleId;

      if (raffleId) {
        await updateRaffle(credentials, raffleId, buildPayload());
      } else {
        const created = await createRaffle(credentials, {
          ...form,
          landingConfig: readLanding(form.landingConfig),
        });
        targetId = created.id;
      }

      if (targetId) {
        await persistCoverIfNeeded(targetId);
        await persistQrIfNeeded(targetId);
      }

      onDone();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la campaña.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleActivateLive = async () => {
    if (!raffleId) {
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await updateRaffle(credentials, raffleId, buildPayload());
      await persistCoverIfNeeded(raffleId);
      await persistQrIfNeeded(raffleId);
      await activateRaffle(credentials, raffleId);
      onDone();
    } catch (activateError: unknown) {
      setError(
        activateError instanceof Error
          ? activateError.message
          : 'No se pudo poner la campaña en curso.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCoverSelect = async (file: File) => {
    const preview = URL.createObjectURL(file);
    setCoverPreview(preview);
    setError('');

    if (!raffleId) {
      setPendingCoverFile(file);
      return;
    }

    setIsUploadingCover(true);

    try {
      const uploadedUrl = await uploadRaffleCover(credentials, raffleId, file);
      setCoverImageUrl(uploadedUrl);
      setCoverPreview(uploadedUrl);
      setPendingCoverFile(null);
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : 'No se pudo subir la imagen.');
      setCoverPreview(coverImageUrl);
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleQrSelect = async (file: File) => {
    const preview = URL.createObjectURL(file);
    setQrPreview(preview);
    setError('');

    if (!raffleId) {
      setPendingQrFile(file);
      return;
    }

    setIsUploadingQr(true);

    try {
      const uploadedUrl = await uploadRafflePaymentQr(credentials, raffleId, file);
      setPaymentQrImageUrl(uploadedUrl);
      setQrPreview(uploadedUrl);
      setPendingQrFile(null);
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : 'No se pudo subir el QR.');
      setQrPreview(paymentQrImageUrl);
    } finally {
      setIsUploadingQr(false);
    }
  };

  const handleAddPrize = async () => {
    if (!raffleId || newPrizeTitle.trim().length < 2) {
      return;
    }

    const created = await createPrize(credentials, raffleId, { title: newPrizeTitle.trim() });
    setPrizes((current) => [...current, created]);
    setNewPrizeTitle('');
  };

  const handleRegisterDraw = async () => {
    if (!raffleId) {
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const trimmedNotes = drawNotes.trim();
      const result = await registerDrawResult(credentials, raffleId, {
        winningNumber: Number(drawWinningNumber),
        externalSource: drawSource.trim(),
        ...(trimmedNotes ? { notes: trimmedNotes } : {}),
      });
      setDrawResult(result);
    } catch (drawError: unknown) {
      setError(
        drawError instanceof Error ? drawError.message : 'No se pudo registrar el resultado.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const previewImage = coverPreview ?? coverImageUrl ?? null;
  const previewQr = qrPreview ?? paymentQrImageUrl ?? null;
  const coverStatusNote = !raffleId
    ? pendingCoverFile
      ? 'Imagen lista. Se subirá al servidor cuando guardes la campaña.'
      : 'Puedes elegir la imagen ahora; se sube al guardar si la campaña es nueva.'
    : coverImageUrl
      ? 'Imagen del premio guardada en la campaña.'
      : undefined;
  const qrStatusNote = !raffleId
    ? pendingQrFile
      ? 'QR listo. Se subirá al servidor cuando guardes la campaña.'
      : 'Puedes elegir el QR ahora; se sube al guardar si la campaña es nueva.'
    : paymentQrImageUrl
      ? 'QR de pago guardado en la campaña.'
      : undefined;
  const previewBadge = landing.heroBadge?.trim() || 'Vista previa de portada';
  const previewTitle = landing.heroTitle?.trim() || form.title.trim() || 'Título de tu campaña';
  const previewAccent = landing.heroAccent?.trim();
  const previewSubtitle =
    landing.heroSubtitle?.trim() ||
    'Agrega el texto principal para ver cómo se sentirá la landing para tus compradores.';
  const previewPrizeLabel = landing.prizeLabel?.trim() || 'Foto del premio';
  const previewCtaLabel = landing.submitButtonLabel?.trim() || 'Comprar participación';

  if (isLoading) {
    return (
      <p className="muted" role="status">
        Cargando campaña…
      </p>
    );
  }

  return (
    <div className="campaign-form-layout">
      {isLiveCampaign ? (
        <div className="live-campaign-banner" role="status">
          <span className="live-dot" aria-hidden="true" />
          <div>
            <strong>Campaña en curso</strong>
            <p className="muted">
              Esta es la rifa activa que ven tus compradores en la landing pública.
            </p>
          </div>
          <a
            className="btn btn-ghost btn-sm"
            href={`${PUBLIC_WEB_URL}/?slug=${form.slug}`}
            target="_blank"
            rel="noreferrer"
          >
            Ver landing
          </a>
        </div>
      ) : raffleId ? (
        <div className="live-campaign-banner live-campaign-banner-muted">
          <div>
            <strong>No es la campaña en curso</strong>
            <p className="muted">
              Solo una campaña puede estar activa. Usa &quot;Poner en curso&quot; para publicarla.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={isSaving}
            onClick={() => void handleActivateLive()}
          >
            Poner en curso
          </button>
        </div>
      ) : null}

      <article className="panel campaign-editor">
        <header className="panel-head panel-head-row">
          <div>
            <p className="panel-eyebrow">{raffleId ? 'Editar campaña' : 'Nueva campaña'}</p>
            <h2>{form.title.trim() || 'Sin título'}</h2>
            <p className="muted">Configura datos, publicidad de la landing e imagen del premio.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            Volver
          </button>
        </header>

        <nav className="campaign-tabs" aria-label="Secciones del formulario">
          {(Object.keys(TAB_LABELS) as FormTab[])
            .filter((tab) => tab !== 'draw' || Boolean(raffleId))
            .map((tab) => (
              <button
                key={tab}
                type="button"
                className={`campaign-tab${activeTab === tab ? ' is-active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
        </nav>

        <form className="campaign-form" onSubmit={handleSubmit}>
          {activeTab === 'general' ? (
            <div className="form-grid">
              <label className="field">
                <span>Título de la campaña</span>
                <input
                  required
                  value={form.title}
                  onChange={(event) => {
                    const title = event.target.value;
                    setForm((current) => ({
                      ...current,
                      title,
                      slug: current.slug || slugify(title),
                    }));
                  }}
                />
              </label>
              <label className="field">
                <span>Slug (URL pública)</span>
                <input
                  required
                  pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                  value={form.slug}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, slug: event.target.value }))
                  }
                />
              </label>
              <label className="field field-span-2">
                <span>Descripción interna</span>
                <textarea
                  rows={3}
                  value={form.description ?? ''}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Estado administrativo</span>
                <select
                  value={form.status ?? 'draft'}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, status: event.target.value }))
                  }
                >
                  <option value="draft">Borrador</option>
                  <option value="active">Activa</option>
                  <option value="paused">Pausada</option>
                  <option value="closed">Cerrada</option>
                </select>
              </label>
              <label className="field">
                <span>Precio por participación (COP)</span>
                <input
                  type="number"
                  min={1}
                  required
                  value={form.pricePerNumber}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      pricePerNumber: Number(event.target.value),
                    }))
                  }
                />
              </label>
            </div>
          ) : null}

          {activeTab === 'marketing' ? (
            <div className="marketing-layout">
              <section className="marketing-fields">
                <div className="marketing-fields-head">
                  <h3>Publicidad de la landing</h3>
                  <p className="muted">
                    Divide la información en secciones cortas para editar más rápido y ver el
                    resultado al lado.
                  </p>
                </div>

                <div
                  className="marketing-subtabs"
                  role="tablist"
                  aria-label="Publicidad de la landing"
                >
                  {(Object.keys(MARKETING_TAB_LABELS) as MarketingTab[]).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={activeMarketingTab === tab}
                      className={`marketing-subtab${activeMarketingTab === tab ? ' is-active' : ''}`}
                      onClick={() => setActiveMarketingTab(tab)}
                    >
                      {MARKETING_TAB_LABELS[tab]}
                    </button>
                  ))}
                </div>

                {activeMarketingTab === 'cover' ? (
                  <div className="marketing-tab-panel" role="tabpanel">
                    <ImageUploadField
                      label="Foto del premio"
                      hint="Aparece grande en la portada de la landing pública."
                      previewSrc={previewImage}
                      emptyLabel="Aún sin foto del premio"
                      previewAlt={landing.prizeLabel ?? 'Foto del premio'}
                      statusNote={coverStatusNote}
                      isUploading={isUploadingCover}
                      onFileSelect={(file) => void handleCoverSelect(file)}
                      onInvalidFile={setError}
                    />
                    <div className="form-grid">
                      <label className="field field-span-2">
                        <span>Texto alternativo del premio</span>
                        <input
                          value={landing.prizeLabel ?? ''}
                          onChange={(event) => updateLanding({ prizeLabel: event.target.value })}
                        />
                      </label>
                    </div>
                  </div>
                ) : null}

                {activeMarketingTab === 'hero' ? (
                  <div className="marketing-tab-panel" role="tabpanel">
                    <h3>Texto principal</h3>
                    <div className="form-grid">
                      <label className="field">
                        <span>Etiqueta superior</span>
                        <input
                          value={landing.heroBadge ?? ''}
                          onChange={(event) => updateLanding({ heroBadge: event.target.value })}
                        />
                      </label>
                      <label className="field field-span-2">
                        <span>Título — parte 1</span>
                        <input
                          value={landing.heroTitle ?? ''}
                          onChange={(event) => updateLanding({ heroTitle: event.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>Título — palabra destacada</span>
                        <input
                          value={landing.heroAccent ?? ''}
                          onChange={(event) => updateLanding({ heroAccent: event.target.value })}
                        />
                      </label>
                      <label className="field field-span-2">
                        <span>Subtítulo</span>
                        <textarea
                          rows={3}
                          value={landing.heroSubtitle ?? ''}
                          onChange={(event) => updateLanding({ heroSubtitle: event.target.value })}
                        />
                      </label>
                    </div>
                  </div>
                ) : null}

                {activeMarketingTab === 'trust' ? (
                  <div className="marketing-tab-panel" role="tabpanel">
                    <h3>Marca, compra y confianza</h3>
                    <div className="form-grid">
                      <label className="field">
                        <span>Nombre de marca</span>
                        <input
                          value={landing.brandName ?? ''}
                          onChange={(event) => updateLanding({ brandName: event.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>Subtítulo de marca</span>
                        <input
                          value={landing.brandSubtitle ?? ''}
                          onChange={(event) => updateLanding({ brandSubtitle: event.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>Botón superior</span>
                        <input
                          value={landing.navbarCtaLabel ?? ''}
                          onChange={(event) =>
                            updateLanding({ navbarCtaLabel: event.target.value })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Título de compra</span>
                        <input
                          value={landing.purchaseTitle ?? ''}
                          onChange={(event) => updateLanding({ purchaseTitle: event.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>Etiqueta de precio</span>
                        <input
                          value={landing.priceLabel ?? ''}
                          onChange={(event) => updateLanding({ priceLabel: event.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>Botón de pago</span>
                        <input
                          value={landing.submitButtonLabel ?? ''}
                          onChange={(event) =>
                            updateLanding({ submitButtonLabel: event.target.value })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Confianza 1</span>
                        <input
                          value={landing.trustCardOneTitle ?? ''}
                          onChange={(event) =>
                            updateLanding({ trustCardOneTitle: event.target.value })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Confianza 2</span>
                        <input
                          value={landing.trustCardTwoTitle ?? ''}
                          onChange={(event) =>
                            updateLanding({ trustCardTwoTitle: event.target.value })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Etiqueta medios de pago</span>
                        <input
                          value={landing.paymentMethodsLabel ?? ''}
                          onChange={(event) =>
                            updateLanding({ paymentMethodsLabel: event.target.value })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Método visible 1</span>
                        <input
                          value={landing.paymentMethodOne ?? ''}
                          onChange={(event) =>
                            updateLanding({ paymentMethodOne: event.target.value })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Método visible 2</span>
                        <input
                          value={landing.paymentMethodTwo ?? ''}
                          onChange={(event) =>
                            updateLanding({ paymentMethodTwo: event.target.value })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Método visible 3</span>
                        <input
                          value={landing.paymentMethodThree ?? ''}
                          onChange={(event) =>
                            updateLanding({ paymentMethodThree: event.target.value })
                          }
                        />
                      </label>
                    </div>
                  </div>
                ) : null}

                {activeMarketingTab === 'steps' ? (
                  <div className="marketing-tab-panel" role="tabpanel">
                    <h3>Cómo funciona</h3>
                    <div className="form-grid">
                      <label className="field">
                        <span>Título de sección</span>
                        <input
                          value={landing.howTitle ?? ''}
                          onChange={(event) => updateLanding({ howTitle: event.target.value })}
                        />
                      </label>
                      <label className="field field-span-2">
                        <span>Subtítulo</span>
                        <input
                          value={landing.howSubtitle ?? ''}
                          onChange={(event) => updateLanding({ howSubtitle: event.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>Paso 1 — título</span>
                        <input
                          value={landing.stepOneTitle ?? ''}
                          onChange={(event) => updateLanding({ stepOneTitle: event.target.value })}
                        />
                      </label>
                      <label className="field field-span-2">
                        <span>Paso 1 — descripción</span>
                        <input
                          value={landing.stepOneDescription ?? ''}
                          onChange={(event) =>
                            updateLanding({ stepOneDescription: event.target.value })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Paso 2 — título</span>
                        <input
                          value={landing.stepTwoTitle ?? ''}
                          onChange={(event) => updateLanding({ stepTwoTitle: event.target.value })}
                        />
                      </label>
                      <label className="field field-span-2">
                        <span>Paso 2 — descripción</span>
                        <input
                          value={landing.stepTwoDescription ?? ''}
                          onChange={(event) =>
                            updateLanding({ stepTwoDescription: event.target.value })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Paso 3 — título</span>
                        <input
                          value={landing.stepThreeTitle ?? ''}
                          onChange={(event) =>
                            updateLanding({ stepThreeTitle: event.target.value })
                          }
                        />
                      </label>
                      <label className="field field-span-2">
                        <span>Paso 3 — descripción</span>
                        <input
                          value={landing.stepThreeDescription ?? ''}
                          onChange={(event) =>
                            updateLanding({ stepThreeDescription: event.target.value })
                          }
                        />
                      </label>
                    </div>

                    <h3>Detalles del premio</h3>
                    <div className="form-grid">
                      <label className="field">
                        <span>Título de sección</span>
                        <input
                          value={landing.prizeDetailsTitle ?? ''}
                          onChange={(event) =>
                            updateLanding({ prizeDetailsTitle: event.target.value })
                          }
                        />
                      </label>
                      <label className="field field-span-2">
                        <span>Subtítulo de sección</span>
                        <input
                          value={landing.prizeDetailsSubtitle ?? ''}
                          onChange={(event) =>
                            updateLanding({ prizeDetailsSubtitle: event.target.value })
                          }
                        />
                      </label>
                      {[
                        ['prizeDetailOne', 'Detalle 1'],
                        ['prizeDetailTwo', 'Detalle 2'],
                        ['prizeDetailThree', 'Detalle 3'],
                      ].map(([prefix, label]) => (
                        <div key={prefix} className="form-grid field-span-2">
                          <label className="field">
                            <span>{label} — etiqueta</span>
                            <input
                              value={landing[`${prefix}Label` as keyof RaffleLandingConfig] ?? ''}
                              onChange={(event) =>
                                updateLandingField(
                                  `${prefix}Label` as keyof RaffleLandingConfig,
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                          <label className="field">
                            <span>{label} — valor</span>
                            <input
                              value={landing[`${prefix}Value` as keyof RaffleLandingConfig] ?? ''}
                              onChange={(event) =>
                                updateLandingField(
                                  `${prefix}Value` as keyof RaffleLandingConfig,
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                          <label className="field field-span-2">
                            <span>{label} — texto menor</span>
                            <input
                              value={landing[`${prefix}Sub` as keyof RaffleLandingConfig] ?? ''}
                              onChange={(event) =>
                                updateLandingField(
                                  `${prefix}Sub` as keyof RaffleLandingConfig,
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {activeMarketingTab === 'faq' ? (
                  <div className="marketing-tab-panel" role="tabpanel">
                    <h3>Organizador y preguntas frecuentes</h3>
                    <div className="form-grid">
                      <label className="field">
                        <span>Título organizador</span>
                        <input
                          value={landing.organizerTitle ?? ''}
                          onChange={(event) =>
                            updateLanding({ organizerTitle: event.target.value })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Empresa</span>
                        <input
                          value={landing.organizerCompany ?? ''}
                          onChange={(event) =>
                            updateLanding({ organizerCompany: event.target.value })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>NIT / documento</span>
                        <input
                          value={landing.organizerTaxId ?? ''}
                          onChange={(event) =>
                            updateLanding({ organizerTaxId: event.target.value })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Dirección</span>
                        <input
                          value={landing.organizerAddress ?? ''}
                          onChange={(event) =>
                            updateLanding({ organizerAddress: event.target.value })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Ciudad</span>
                        <input
                          value={landing.organizerCity ?? ''}
                          onChange={(event) => updateLanding({ organizerCity: event.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>Título método sorteo</span>
                        <input
                          value={landing.drawMethodTitle ?? ''}
                          onChange={(event) =>
                            updateLanding({ drawMethodTitle: event.target.value })
                          }
                        />
                      </label>
                      <label className="field field-span-2">
                        <span>Resumen sorteo fallback</span>
                        <input
                          value={landing.drawMethodFallbackSummary ?? ''}
                          onChange={(event) =>
                            updateLanding({ drawMethodFallbackSummary: event.target.value })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Título FAQ</span>
                        <input
                          value={landing.faqTitle ?? ''}
                          onChange={(event) => updateLanding({ faqTitle: event.target.value })}
                        />
                      </label>
                      {[
                        ['faqOne', 'FAQ 1'],
                        ['faqTwo', 'FAQ 2'],
                        ['faqThree', 'FAQ 3'],
                      ].map(([prefix, label]) => (
                        <div key={prefix} className="form-grid field-span-2">
                          <label className="field">
                            <span>{label} — pregunta</span>
                            <input
                              value={
                                landing[`${prefix}Question` as keyof RaffleLandingConfig] ?? ''
                              }
                              onChange={(event) =>
                                updateLandingField(
                                  `${prefix}Question` as keyof RaffleLandingConfig,
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                          <label className="field field-span-2">
                            <span>{label} — respuesta</span>
                            <textarea
                              rows={2}
                              value={landing[`${prefix}Answer` as keyof RaffleLandingConfig] ?? ''}
                              onChange={(event) =>
                                updateLandingField(
                                  `${prefix}Answer` as keyof RaffleLandingConfig,
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {activeMarketingTab === 'footer' ? (
                  <div className="marketing-tab-panel" role="tabpanel">
                    <h3>Resultado y pie de página</h3>
                    <div className="form-grid">
                      <label className="field">
                        <span>Título resultados</span>
                        <input
                          value={landing.resultsTitle ?? ''}
                          onChange={(event) => updateLanding({ resultsTitle: event.target.value })}
                        />
                      </label>
                      <label className="field field-span-2">
                        <span>Texto resultado pendiente</span>
                        <input
                          value={landing.resultsPendingText ?? ''}
                          onChange={(event) =>
                            updateLanding({ resultsPendingText: event.target.value })
                          }
                        />
                      </label>
                      <label className="field field-span-2">
                        <span>Texto del footer</span>
                        <textarea
                          rows={2}
                          value={landing.footerBrandText ?? ''}
                          onChange={(event) =>
                            updateLanding({ footerBrandText: event.target.value })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Teléfono footer</span>
                        <input
                          value={landing.footerPhone ?? ''}
                          onChange={(event) => updateLanding({ footerPhone: event.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>Email footer</span>
                        <input
                          value={landing.footerEmail ?? ''}
                          onChange={(event) => updateLanding({ footerEmail: event.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>Horario footer</span>
                        <input
                          value={landing.footerHours ?? ''}
                          onChange={(event) => updateLanding({ footerHours: event.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>Instagram URL</span>
                        <input
                          value={landing.instagramUrl ?? ''}
                          onChange={(event) => updateLanding({ instagramUrl: event.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>Facebook URL</span>
                        <input
                          value={landing.facebookUrl ?? ''}
                          onChange={(event) => updateLanding({ facebookUrl: event.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>YouTube URL</span>
                        <input
                          value={landing.youtubeUrl ?? ''}
                          onChange={(event) => updateLanding({ youtubeUrl: event.target.value })}
                        />
                      </label>
                      <label className="field field-span-2">
                        <span>Copyright</span>
                        <input
                          value={landing.copyrightText ?? ''}
                          onChange={(event) => updateLanding({ copyrightText: event.target.value })}
                        />
                      </label>
                    </div>
                  </div>
                ) : null}
              </section>

              <aside className="landing-preview-card" aria-label="Vista previa de la landing">
                <p className="panel-eyebrow">Vista previa</p>
                <div className="landing-preview-hero">
                  {previewImage ? (
                    <img
                      src={previewImage}
                      alt={previewPrizeLabel}
                      className="landing-preview-image"
                    />
                  ) : (
                    <div className="landing-preview-image landing-preview-image-empty">
                      <span>{previewPrizeLabel}</span>
                      <small>Sube una imagen en Portada para completar la vista.</small>
                    </div>
                  )}
                  <div>
                    <span className="badge badge-gold">{previewBadge}</span>
                    <h3>
                      {previewTitle}{' '}
                      {previewAccent ? <span className="accent">{previewAccent}</span> : null}
                    </h3>
                    <p className="muted">{previewSubtitle}</p>
                    <div className="landing-preview-actions" aria-hidden="true">
                      <span>{previewCtaLabel}</span>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          ) : null}

          {activeTab === 'numbers' ? (
            <div className="form-grid">
              {!raffleId ? (
                <>
                  <label className="field">
                    <span>Número mínimo</span>
                    <input
                      type="number"
                      min={0}
                      value={form.numberMin ?? 0}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          numberMin: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Número máximo</span>
                    <input
                      type="number"
                      min={0}
                      required
                      value={form.numberMax}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          numberMax: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                </>
              ) : (
                <p className="muted field-span-2">
                  Rango actual: {form.numberMin ?? 0} – {form.numberMax}. Los números no se pueden
                  cambiar después de crear la campaña.
                </p>
              )}
              <label className="field">
                <span>Modo de asignación</span>
                <select
                  value={form.assignmentMode ?? 'customer_choice'}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, assignmentMode: event.target.value }))
                  }
                  disabled={Boolean(raffleId)}
                >
                  <option value="customer_choice">El cliente elige números</option>
                  <option value="random">Asignación aleatoria</option>
                </select>
              </label>
            </div>
          ) : null}

          {activeTab === 'payments' ? (
            <div className="payments-layout">
              <ImageUploadField
                label="Código QR de pago"
                hint="Sube el QR de Nequi, Bancolombia u otra billetera. Lo verá el comprador al pagar."
                previewSrc={previewQr}
                emptyLabel="Aún sin QR de pago"
                previewAlt="Código QR de pago"
                statusNote={qrStatusNote}
                isUploading={isUploadingQr}
                onFileSelect={(file) => void handleQrSelect(file)}
                onInvalidFile={setError}
              />

              <h3 className="payments-section-title">Datos de transferencia</h3>
              <div className="form-grid">
                <label className="field">
                  <span>Método de pago</span>
                  <input
                    value={form.paymentMethodLabel ?? ''}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, paymentMethodLabel: event.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Titular cuenta</span>
                  <input
                    value={form.paymentAccountHolder ?? ''}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        paymentAccountHolder: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Tipo de cuenta</span>
                  <input
                    value={form.paymentAccountType ?? ''}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, paymentAccountType: event.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Número de cuenta</span>
                  <input
                    value={form.paymentAccountNumber ?? ''}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        paymentAccountNumber: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Documento / NIT</span>
                  <input
                    value={form.paymentDocumentNumber ?? ''}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        paymentDocumentNumber: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="field field-span-2">
                  <span>Instrucciones de pago</span>
                  <textarea
                    rows={4}
                    value={form.paymentInstructions ?? ''}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        paymentInstructions: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            </div>
          ) : null}

          {activeTab === 'draw' && raffleId ? (
            <div className="draw-section">
              <div className="form-grid">
                <label className="field">
                  <span>Fuente del sorteo</span>
                  <input
                    value={form.drawSourceName ?? ''}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, drawSourceName: event.target.value }))
                    }
                  />
                </label>
                <label className="field field-span-2">
                  <span>Regla del sorteo</span>
                  <input
                    value={form.drawRule ?? ''}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, drawRule: event.target.value }))
                    }
                  />
                </label>
              </div>

              <h3>Premios</h3>
              {prizes.length === 0 ? (
                <p className="muted">Sin premios registrados.</p>
              ) : (
                <ul className="prize-list">
                  {prizes.map((prize) => (
                    <li key={prize.id}>
                      <strong>{prize.title}</strong>
                      {prize.description ? (
                        <span className="muted"> — {prize.description}</span>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          void deletePrize(credentials, prize.id).then(() =>
                            setPrizes((current) => current.filter((item) => item.id !== prize.id)),
                          )
                        }
                      >
                        Eliminar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="panel-actions">
                <input
                  placeholder="Título del premio"
                  value={newPrizeTitle}
                  onChange={(event) => setNewPrizeTitle(event.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void handleAddPrize()}
                >
                  Agregar premio
                </button>
              </div>

              <h3>Resultado del sorteo</h3>
              {drawResult ? (
                <dl className="detail-grid">
                  <div>
                    <dt>Número ganador</dt>
                    <dd>{drawResult.winningNumber}</dd>
                  </div>
                  <div>
                    <dt>Fuente</dt>
                    <dd>{drawResult.externalSource}</dd>
                  </div>
                  <div>
                    <dt>Ganador</dt>
                    <dd>{drawResult.winnerDisplayName ?? 'Sin comprador pagado con ese número'}</dd>
                  </div>
                </dl>
              ) : (
                <>
                  <p className="muted">Registra el número ganador según el sorteo externo.</p>
                  <div className="form-grid">
                    <label className="field">
                      <span>Número ganador</span>
                      <input
                        type="number"
                        min={0}
                        value={drawWinningNumber}
                        onChange={(event) => setDrawWinningNumber(event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>Fuente registrada</span>
                      <input
                        value={drawSource}
                        onChange={(event) => setDrawSource(event.target.value)}
                        placeholder="Lotería de Bogotá"
                      />
                    </label>
                    <label className="field field-span-2">
                      <span>Notas</span>
                      <input
                        value={drawNotes}
                        onChange={(event) => setDrawNotes(event.target.value)}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isSaving}
                    onClick={() => void handleRegisterDraw()}
                  >
                    Registrar resultado
                  </button>
                </>
              )}
            </div>
          ) : null}

          {error ? (
            <p className="alert alert-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="panel-actions campaign-form-actions">
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Guardando…' : 'Guardar campaña'}
            </button>
            {raffleId && !isLiveCampaign ? (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={isSaving}
                onClick={() => void handleActivateLive()}
              >
                Poner en curso
              </button>
            ) : null}
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </form>
      </article>
    </div>
  );
};
