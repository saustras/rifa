// Client-side image normalization (admin panel).
//
// Phones (especially iPhones) upload HEIC/HEIF photos and very large files,
// which the API rejected before. We downscale and re-encode to JPEG in the
// browser so the payload is small and always in a server-supported format.
// If the browser cannot decode the image, we fall back to the original file.

export interface PreparedImage {
  readonly fileName: string;
  readonly mimeType: string;
  readonly dataBase64: string;
}

const MAX_DIMENSION = 1600;
const OUTPUT_MIME = 'image/jpeg';
const OUTPUT_QUALITY = 0.82;

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('No se pudo leer la imagen.'));
    });
    reader.addEventListener('error', () => reject(new Error('No se pudo leer la imagen.')));
    reader.readAsDataURL(file);
  });

const loadImage = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('No se pudo procesar la imagen.')));
    image.src = dataUrl;
  });

const swapExtension = (fileName: string): string => {
  const base = fileName.replace(/\.[^./\\]+$/, '');
  return `${base || 'imagen'}.jpg`;
};

const stripDataUrlPrefix = (dataUrl: string): string => {
  const commaIndex = dataUrl.indexOf(',');
  return commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1);
};

export const prepareImageForUpload = async (file: File): Promise<PreparedImage> => {
  const originalDataUrl = await readFileAsDataUrl(file);

  try {
    const image = await loadImage(originalDataUrl);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    if (!width || !height) {
      throw new Error('empty-image');
    }

    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('no-canvas');
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight);
    const compressedDataUrl = canvas.toDataURL(OUTPUT_MIME, OUTPUT_QUALITY);

    if (!compressedDataUrl.startsWith('data:image/')) {
      throw new Error('encode-failed');
    }

    return {
      fileName: swapExtension(file.name),
      mimeType: OUTPUT_MIME,
      dataBase64: stripDataUrlPrefix(compressedDataUrl),
    };
  } catch {
    return {
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      dataBase64: stripDataUrlPrefix(originalDataUrl),
    };
  }
};
