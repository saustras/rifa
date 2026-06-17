import { useEffect, useId, useState, type ChangeEvent } from 'react';

interface ImageUploadFieldProps {
  readonly label: string;
  readonly hint: string;
  readonly previewSrc: string | null;
  readonly emptyLabel: string;
  readonly previewAlt: string;
  readonly statusNote?: string | undefined;
  readonly isUploading?: boolean;
  readonly onFileSelect: (file: File) => void;
  readonly onInvalidFile?: (message: string) => void;
}

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

const isAcceptedImage = (file: File): boolean => {
  // Some phones report an empty type for HEIC; allow by extension as a fallback.
  if (file.type && ACCEPTED_TYPES.includes(file.type)) {
    return true;
  }

  return /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
};

export const ImageUploadField = ({
  label,
  hint,
  previewSrc,
  emptyLabel,
  previewAlt,
  statusNote,
  isUploading = false,
  onFileSelect,
  onInvalidFile,
}: ImageUploadFieldProps) => {
  const inputId = useId();
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  // Release the object URL when it changes or the component unmounts.
  useEffect(() => {
    return () => {
      if (localPreview) {
        URL.revokeObjectURL(localPreview);
      }
    };
  }, [localPreview]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!isAcceptedImage(file)) {
      onInvalidFile?.('Usa una imagen JPG, PNG, WebP o HEIC.');
      event.target.value = '';
      return;
    }

    // Show the selected image immediately, before the upload round-trip.
    setLocalPreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return URL.createObjectURL(file);
    });

    onFileSelect(file);
    event.target.value = '';
  };

  const effectivePreview = localPreview ?? previewSrc;

  return (
    <div className="asset-upload-card">
      <div className="asset-upload-head">
        <h3>{label}</h3>
        <p className="muted">{hint}</p>
      </div>

      <div className="asset-upload-body">
        <div className="asset-upload-preview">
          {effectivePreview ? (
            <img className="cover-preview" src={effectivePreview} alt={previewAlt} />
          ) : (
            <div className="cover-preview cover-preview-empty">
              <span>{emptyLabel}</span>
            </div>
          )}
        </div>

        <label className="cover-dropzone cover-dropzone-action" htmlFor={inputId}>
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            disabled={isUploading}
            onChange={handleChange}
          />
          <span className="cover-dropzone-icon" aria-hidden="true">
            ↑
          </span>
          <span className="cover-dropzone-title">
            {isUploading ? 'Subiendo imagen…' : 'Haz clic para subir imagen'}
          </span>
          <small className="muted">JPG, PNG, WebP o HEIC · se optimiza automáticamente</small>
        </label>
      </div>

      {statusNote ? <p className="asset-upload-status">{statusNote}</p> : null}
    </div>
  );
};
