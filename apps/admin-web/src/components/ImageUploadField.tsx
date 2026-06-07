import { useId, type ChangeEvent } from 'react';

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

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      onInvalidFile?.('Usa una imagen JPG, PNG o WebP.');
      event.target.value = '';
      return;
    }

    onFileSelect(file);
    event.target.value = '';
  };

  return (
    <div className="asset-upload-card">
      <div className="asset-upload-head">
        <h3>{label}</h3>
        <p className="muted">{hint}</p>
      </div>

      <div className="asset-upload-body">
        <div className="asset-upload-preview">
          {previewSrc ? (
            <img className="cover-preview" src={previewSrc} alt={previewAlt} />
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
            accept="image/jpeg,image/png,image/webp"
            disabled={isUploading}
            onChange={handleChange}
          />
          <span className="cover-dropzone-icon" aria-hidden="true">
            ↑
          </span>
          <span className="cover-dropzone-title">
            {isUploading ? 'Subiendo imagen…' : 'Haz clic para subir imagen'}
          </span>
          <small className="muted">JPG, PNG o WebP · máx. 5 MB recomendado</small>
        </label>
      </div>

      {statusNote ? <p className="asset-upload-status">{statusNote}</p> : null}
    </div>
  );
};
