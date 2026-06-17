import { useEffect, useState, type FormEvent } from 'react';

import {
  createDeliveryGalleryImage,
  deleteDeliveryGalleryImage,
  fetchDeliveryGallery,
  fetchWinners,
  updateDeliveryGalleryImage,
  updateWinner,
  uploadWinnerPhoto,
} from '../api';
import { REQUEST_STATUS, type AdminCredentials, type AdminWinner, type DeliveryGalleryImage, type RequestStatus } from '../types';

interface WinnersPageProps {
  readonly credentials: AdminCredentials;
}

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(value));

export const WinnersPage = ({ credentials }: WinnersPageProps) => {
  const [winners, setWinners] = useState<readonly AdminWinner[]>([]);
  const [gallery, setGallery] = useState<readonly DeliveryGalleryImage[]>([]);
  const [status, setStatus] = useState<RequestStatus>(REQUEST_STATUS.loading);
  const [message, setMessage] = useState('');
  const [galleryFile, setGalleryFile] = useState<File | null>(null);
  const [galleryTitle, setGalleryTitle] = useState('');
  const [galleryCaption, setGalleryCaption] = useState('');

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

    setMessage('Subiendo foto del ganador…');

    try {
      const updated = await uploadWinnerPhoto(credentials, winner.id, file);
      setWinners((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage('Foto del ganador actualizada.');
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'No se pudo subir la foto.');
    }
  };

  const handleGallerySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!galleryFile) {
      setMessage('Selecciona una foto para agregar al carrusel.');
      return;
    }

    setMessage('Subiendo foto al carrusel…');

    try {
      const created = await createDeliveryGalleryImage(credentials, {
        file: galleryFile,
        ...(galleryTitle.trim() ? { title: galleryTitle.trim() } : {}),
        ...(galleryCaption.trim() ? { caption: galleryCaption.trim() } : {}),
        isPublic: true,
        displayOrder: gallery.length,
      });
      setGallery((current) => [...current, created]);
      setGalleryFile(null);
      setGalleryTitle('');
      setGalleryCaption('');
      setMessage('Foto agregada al carrusel.');
    } catch (error: unknown) {
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

  const removeGalleryImage = async (image: DeliveryGalleryImage) => {
    try {
      await deleteDeliveryGalleryImage(credentials, image.id);
      setGallery((current) => current.filter((item) => item.id !== image.id));
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

        <form className="gallery-upload-form" onSubmit={(event) => void handleGallerySubmit(event)}>
          <label className="field">
            <span>Foto</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              onChange={(event) => setGalleryFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <label className="field">
            <span>Título</span>
            <input value={galleryTitle} onChange={(event) => setGalleryTitle(event.target.value)} />
          </label>
          <label className="field field-grow">
            <span>Comentario</span>
            <input value={galleryCaption} onChange={(event) => setGalleryCaption(event.target.value)} />
          </label>
          <button type="submit" className="btn btn-primary">Agregar foto</button>
        </form>

        {gallery.length > 0 ? (
          <div className="admin-gallery-grid">
            {gallery.map((image) => (
              <article className="admin-gallery-card" key={image.id}>
                <img src={image.imageUrl} alt={image.title ?? 'Foto de entrega'} />
                <div>
                  <strong>{image.title || 'Foto de entrega'}</strong>
                  {image.caption ? <p className="muted">{image.caption}</p> : null}
                </div>
                <div className="panel-actions compact-actions">
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
                <div className="winner-admin-photo">
                  {winner.winnerPhotoUrl ? (
                    <img src={winner.winnerPhotoUrl} alt={`Foto de ${winner.winnerDisplayName ?? 'ganador'}`} />
                  ) : (
                    <span>Sin foto</span>
                  )}
                </div>
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
                  <label className="field">
                    <span>Foto del ganador</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                      onChange={(event) => void handleWinnerPhoto(winner, event.target.files?.[0])}
                    />
                  </label>
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
