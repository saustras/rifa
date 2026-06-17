import { useEffect, useState } from 'react';

import { ImageUploadField } from '../components/ImageUploadField';
import {
  createDeliveryGalleryImage,
  deleteDeliveryGalleryImage,
  fetchDeliveryGallery,
  fetchWinners,
  updateDeliveryGalleryImage,
  updateWinner,
  uploadWinnerPhoto,
} from '../api';
import {
  REQUEST_STATUS,
  type AdminCredentials,
  type AdminWinner,
  type DeliveryGalleryImage,
  type RequestStatus,
} from '../types';

interface WinnersPageProps {
  readonly credentials: AdminCredentials;
}

interface GalleryDraft {
  readonly title: string;
  readonly caption: string;
  readonly displayOrder: string;
}

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(value));

const toGalleryDrafts = (
  items: readonly DeliveryGalleryImage[],
): Record<string, GalleryDraft> =>
  Object.fromEntries(
    items.map((item) => [
      item.id,
      {
        title: item.title ?? '',
        caption: item.caption ?? '',
        displayOrder: String(item.displayOrder),
      },
    ]),
  );

export const WinnersPage = ({ credentials }: WinnersPageProps) => {
  const [winners, setWinners] = useState<readonly AdminWinner[]>([]);
  const [gallery, setGallery] = useState<readonly DeliveryGalleryImage[]>([]);
  const [status, setStatus] = useState<RequestStatus>(REQUEST_STATUS.loading);
  const [message, setMessage] = useState('');
  const [galleryTitle, setGalleryTitle] = useState('');
  const [galleryCaption, setGalleryCaption] = useState('');
  const [galleryDrafts, setGalleryDrafts] = useState<Record<string, GalleryDraft>>({});
  const [galleryUploadStatus, setGalleryUploadStatus] = useState<RequestStatus>(REQUEST_STATUS.idle);
  const [uploadingWinnerId, setUploadingWinnerId] = useState<string>('');
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<DeliveryGalleryImage | null>(null);

  const loadContent = async () => {
    setStatus(REQUEST_STATUS.loading);
    setMessage('');

    try {
      const [nextWinners, nextGallery] = await Promise.all([
        fetchWinners(credentials),
        fetchDeliveryGallery(credentials),
      ]);
      setWinners(nextWinners);
      setGallery(nextGallery);
      setGalleryDrafts(toGalleryDrafts(nextGallery));
      setStatus(REQUEST_STATUS.success);
    } catch (error: unknown) {
      setStatus(REQUEST_STATUS.error);
      setMessage(error instanceof Error ? error.message : 'No se pudo cargar ganadores.');
    }
  };

  useEffect(() => {
    void loadContent();
  }, [credentials]);

  const patchWinner = async (
    winner: AdminWinner,
    payload: Parameters<typeof updateWinner>[2],
  ) => {
    setMessage('');
    try {
      const updated = await updateWinner(credentials, winner.id, payload);
      setWinners((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage('Ganador actualizado.');
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar el ganador.');
    }
  };

  const handleWinnerPhoto = async (winner: AdminWinner, file: File | undefined) => {
    if (!file) {
      return;
    }

    setUploadingWinnerId(winner.id);
    setMessage('Subiendo foto del ganador…');

    try {
      const updated = await uploadWinnerPhoto(credentials, winner.id, file);
      setWinners((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage('Foto del ganador actualizada.');
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'No se pudo subir la foto.');
    } finally {
      setUploadingWinnerId('');
    }
  };

  const handleGalleryPhoto = async (file: File) => {
    setGalleryUploadStatus(REQUEST_STATUS.loading);
    setMessage('Subiendo foto al carrusel…');

    try {
      const created = await createDeliveryGalleryImage(credentials, {
        file,
        ...(galleryTitle.trim() ? { title: galleryTitle.trim() } : {}),
        ...(galleryCaption.trim() ? { caption: galleryCaption.trim() } : {}),
        isPublic: true,
        displayOrder: gallery.length,
      });
      setGallery((current) => [...current, created]);
      setGalleryDrafts((current) => ({
        ...current,
        [created.id]: {
          title: created.title ?? '',
          caption: created.caption ?? '',
          displayOrder: String(created.displayOrder),
        },
      }));
      setGalleryTitle('');
      setGalleryCaption('');
      setGalleryUploadStatus(REQUEST_STATUS.success);
      setMessage('Foto agregada al carrusel.');
    } catch (error: unknown) {
      setGalleryUploadStatus(REQUEST_STATUS.error);
      setMessage(error instanceof Error ? error.message : 'No se pudo agregar la foto.');
    }
  };

  const toggleGalleryImage = async (image: DeliveryGalleryImage) => {
    try {
      const updated = await updateDeliveryGalleryImage(credentials, image.id, {
        isPublic: !image.isPublic,
      });
      setGallery((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la foto.');
    }
  };

  const updateGalleryDraft = (
    imageId: string,
    field: keyof GalleryDraft,
    value: string,
  ) => {
    setGalleryDrafts((current) => ({
      ...current,
      [imageId]: {
        ...(current[imageId] ?? { title: '', caption: '', displayOrder: '0' }),
        [field]: value,
      },
    }));
  };

  const saveGalleryImage = async (image: DeliveryGalleryImage) => {
    const draft = galleryDrafts[image.id] ?? {
      title: image.title ?? '',
      caption: image.caption ?? '',
      displayOrder: String(image.displayOrder),
    };
    const displayOrder = Number(draft.displayOrder);

    if (!Number.isInteger(displayOrder) || displayOrder < 0) {
      setMessage('El orden debe ser un número entero positivo.');
      return;
    }

    try {
      const updated = await updateDeliveryGalleryImage(credentials, image.id, {
        title: draft.title.trim() || null,
        caption: draft.caption.trim() || null,
        displayOrder,
      });
      setGallery((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setGalleryDrafts((current) => ({
        ...current,
        [updated.id]: {
          title: updated.title ?? '',
          caption: updated.caption ?? '',
          displayOrder: String(updated.displayOrder),
        },
      }));
      setMessage('Foto del carrusel actualizada.');
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar la foto.');
    }
  };

  const removeGalleryImage = async (image: DeliveryGalleryImage) => {
    try {
      await deleteDeliveryGalleryImage(credentials, image.id);
      setGallery((current) => current.filter((item) => item.id !== image.id));
      setGalleryDrafts((current) => {
        const next = { ...current };
        delete next[image.id];
        return next;
      });
      setMessage('Foto eliminada del carrusel.');
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'No se pudo eliminar la foto.');
    }
  };

  return (
    <div className="winners-page">
      {message ? <p className="alert" role="status">{message}</p> : null}

      <section className="panel winners-gallery-panel">
        <header className="panel-head panel-head-row">
          <div>
            <h2>Carrusel de entregas</h2>
            <p className="muted">Sube fotos de entregas, momentos reales o evidencia social. Si no hay fotos visibles, la landing no muestra esta sección.</p>
          </div>
        </header>

        <div className="gallery-upload-layout">
          <div className="gallery-upload-form">
            <div className="gallery-upload-intro">
              <p className="modal-eyebrow">Nueva imagen</p>
              <h3>Agregar foto al carrusel</h3>
              <p className="muted">
                Completa el texto que aparecerá en la landing y luego selecciona la imagen.
              </p>
            </div>
            <label className="field">
              <span>Título</span>
              <input
                placeholder="Ej: Entrega del premio"
                value={galleryTitle}
                onChange={(event) => setGalleryTitle(event.target.value)}
              />
            </label>
            <label className="field field-grow">
              <span>Comentario</span>
              <textarea
                placeholder="Ej: Cliente feliz recibiendo su premio."
                value={galleryCaption}
                onChange={(event) => setGalleryCaption(event.target.value)}
              />
            </label>
          </div>
          <ImageUploadField
            label="Imagen"
            hint="JPG, PNG, WebP o HEIC. Se optimiza automáticamente al subir."
            previewSrc={null}
            emptyLabel="Sin imagen"
            previewAlt="Vista previa de foto para carrusel"
            isUploading={galleryUploadStatus === REQUEST_STATUS.loading}
            statusNote={
              galleryUploadStatus === REQUEST_STATUS.loading
                ? 'Subiendo foto al carrusel…'
                : galleryUploadStatus === REQUEST_STATUS.success
                  ? 'Última foto agregada correctamente.'
                  : undefined
            }
            onFileSelect={(file) => void handleGalleryPhoto(file)}
            onInvalidFile={setMessage}
          />
        </div>

        {gallery.length > 0 ? (
          <div className="admin-gallery-grid">
            {gallery.map((image) => (
              <article className="admin-gallery-card" key={image.id}>
                <button
                  type="button"
                  className="admin-gallery-image-button"
                  onClick={() => setSelectedGalleryImage(image)}
                  aria-label={`Ver foto ${image.title ?? 'de entrega'} en grande`}
                >
                  <img src={image.imageUrl} alt={image.title ?? 'Foto de entrega'} />
                </button>
                <div className="admin-gallery-editor">
                  <label className="field">
                    <span>Título</span>
                    <input
                      value={galleryDrafts[image.id]?.title ?? ''}
                      placeholder="Ej: Entrega del premio"
                      onChange={(event) => updateGalleryDraft(image.id, 'title', event.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Comentario</span>
                    <textarea
                      value={galleryDrafts[image.id]?.caption ?? ''}
                      placeholder="Describe esta entrega o momento."
                      onChange={(event) => updateGalleryDraft(image.id, 'caption', event.target.value)}
                    />
                  </label>
                  <label className="field gallery-order-field">
                    <span>Orden</span>
                    <input
                      type="number"
                      min={0}
                      value={galleryDrafts[image.id]?.displayOrder ?? '0'}
                      onChange={(event) =>
                        updateGalleryDraft(image.id, 'displayOrder', event.target.value)
                      }
                    />
                  </label>
                </div>
                <div className="panel-actions compact-actions">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => void saveGalleryImage(image)}>
                    Guardar
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedGalleryImage(image)}>
                    Ver grande
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => void toggleGalleryImage(image)}>
                    {image.isPublic ? 'Ocultar' : 'Mostrar'}
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => void removeGalleryImage(image)}>
                    Eliminar
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">Aún no hay fotos para el carrusel.</p>
        )}
      </section>

      {selectedGalleryImage ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Vista grande de foto">
          <div className="modal-card panel gallery-preview-modal">
            <header className="panel-head panel-head-row">
              <div>
                <h2>{selectedGalleryImage.title || 'Foto de entrega'}</h2>
                {selectedGalleryImage.caption ? (
                  <p className="muted">{selectedGalleryImage.caption}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedGalleryImage(null)}
              >
                Cerrar
              </button>
            </header>
            <img
              src={selectedGalleryImage.imageUrl}
              alt={selectedGalleryImage.title ?? 'Foto de entrega'}
            />
          </div>
        </div>
      ) : null}

      <section className="panel">
        <header className="panel-head panel-head-row">
          <div>
            <h2>Ganadores registrados</h2>
            <p className="muted">Selecciona uno o varios ganadores para mostrarlos en la landing. Vienen de los resultados de sorteo registrados.</p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => void loadContent()}>
            Actualizar
          </button>
        </header>

        {status === REQUEST_STATUS.loading ? <p className="muted">Cargando ganadores…</p> : null}
        {status !== REQUEST_STATUS.loading && winners.length === 0 ? (
          <p className="muted">No hay resultados de sorteo registrados todavía.</p>
        ) : null}

        {winners.length > 0 ? (
          <div className="winners-admin-list">
            {winners.map((winner) => (
              <article className={`winner-admin-card${winner.isPublicWinner ? ' is-public' : ''}`} key={winner.id}>
                <div className="winner-admin-body">
                  <div className="winner-admin-head">
                    <div>
                      <strong>{winner.winnerDisplayName ?? 'Ganador sin nombre público'}</strong>
                      <small>{winner.raffleTitle} · número {winner.winningNumber} · {formatDate(winner.registeredAt)}</small>
                    </div>
                    <label className="switch-row">
                      <input
                        type="checkbox"
                        checked={winner.isPublicWinner}
                        onChange={(event) => void patchWinner(winner, { isPublicWinner: event.target.checked })}
                      />
                      Mostrar
                    </label>
                  </div>
                  <ImageUploadField
                    label="Foto del ganador"
                    hint="Usa una foto clara de la persona, la entrega o el premio."
                    previewSrc={winner.winnerPhotoUrl}
                    emptyLabel="Sin foto del ganador"
                    previewAlt={`Foto de ${winner.winnerDisplayName ?? 'ganador'}`}
                    isUploading={uploadingWinnerId === winner.id}
                    statusNote={
                      uploadingWinnerId === winner.id ? 'Subiendo foto del ganador…' : undefined
                    }
                    onFileSelect={(file) => void handleWinnerPhoto(winner, file)}
                    onInvalidFile={setMessage}
                  />
                  <label className="field">
                    <span>Comentario / testimonio</span>
                    <textarea
                      defaultValue={winner.winnerComment ?? ''}
                      placeholder="Ej: Entrega realizada en tienda, feliz con su premio…"
                      onBlur={(event) => void patchWinner(winner, { winnerComment: event.target.value })}
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
};
