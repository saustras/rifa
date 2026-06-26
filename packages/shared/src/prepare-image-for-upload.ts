// Client-side image normalization for uploads.
//
// Phones (especially iPhones) upload HEIC/HEIF photos with EXIF orientation.
// Canvas re-encoding can produce solid-black JPEGs on iOS when orientation or
// color space is mishandled. We prefer createImageBitmap (respects EXIF),
// detect blank canvas output, and fall back to the original bytes for the API
// to compress with sharp.

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

const stripDataUrlPrefix = (dataUrl: string): string => {
  const commaIndex = dataUrl.indexOf(',');
  return commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1);
};

const swapExtension = (fileName: string, fallbackBaseName: string): string => {
  const base = fileName.replace(/\.[^./\\]+$/, '');
  return `${base || fallbackBaseName}.jpg`;
};

const resolveMimeType = (file: File): string => {
  const normalizedType = file.type.trim().toLowerCase();

  if (normalizedType.startsWith('image/')) {
    return normalizedType;
  }

  if (/\.heic$/i.test(file.name)) {
    return 'image/heic';
  }

  if (/\.heif$/i.test(file.name)) {
    return 'image/heif';
  }

  if (/\.png$/i.test(file.name)) {
    return 'image/png';
  }

  if (/\.webp$/i.test(file.name)) {
    return 'image/webp';
  }

  return 'image/jpeg';
};

const computeTargetSize = (width: number, height: number): { readonly width: number; readonly height: number } => {
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const isBlankImageData = (imageData: ImageData): boolean => {
  const { data, width, height } = imageData;

  if (!width || !height) {
    return true;
  }

  const stepX = Math.max(1, Math.floor(width / 10));
  const stepY = Math.max(1, Math.floor(height / 10));

  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const index = (y * width + x) * 4;
      const red = data[index] ?? 0;
      const green = data[index + 1] ?? 0;
      const blue = data[index + 2] ?? 0;
      const alpha = data[index + 3] ?? 0;

      if (alpha > 16 && (red > 16 || green > 16 || blue > 16)) {
        return false;
      }
    }
  }

  return true;
};

const encodeCanvas = (canvas: HTMLCanvasElement): string | null => {
  const dataUrl = canvas.toDataURL(OUTPUT_MIME, OUTPUT_QUALITY);

  if (!dataUrl.startsWith('data:image/')) {
    return null;
  }

  return dataUrl;
};

const drawSourceToCanvas = (
  source: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement | null => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);

  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    return null;
  }

  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const canvasLooksBlank = (canvas: HTMLCanvasElement): boolean => {
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    return true;
  }

  return isBlankImageData(context.getImageData(0, 0, canvas.width, canvas.height));
};

const buildPreparedImage = (
  file: File,
  fallbackBaseName: string,
  dataUrl: string,
): PreparedImage => ({
  fileName: swapExtension(file.name, fallbackBaseName),
  mimeType: OUTPUT_MIME,
  dataBase64: stripDataUrlPrefix(dataUrl),
});

const compressWithCreateImageBitmap = async (
  file: File,
  fallbackBaseName: string,
): Promise<PreparedImage | null> => {
  if (typeof createImageBitmap !== 'function') {
    return null;
  }

  let bitmap: ImageBitmap | null = null;

  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const targetSize = computeTargetSize(bitmap.width, bitmap.height);
    const canvas = drawSourceToCanvas(bitmap, targetSize.width, targetSize.height);

    if (!canvas || canvasLooksBlank(canvas)) {
      return null;
    }

    const dataUrl = encodeCanvas(canvas);

    if (!dataUrl) {
      return null;
    }

    return buildPreparedImage(file, fallbackBaseName, dataUrl);
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
};

const loadImage = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('No se pudo procesar la imagen.')));
    image.src = dataUrl;
  });

const compressWithImageElement = async (
  file: File,
  fallbackBaseName: string,
  originalDataUrl: string,
): Promise<PreparedImage | null> => {
  try {
    const image = await loadImage(originalDataUrl);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    if (!width || !height) {
      return null;
    }

    const targetSize = computeTargetSize(width, height);
    const canvas = drawSourceToCanvas(image, targetSize.width, targetSize.height);

    if (!canvas || canvasLooksBlank(canvas)) {
      return null;
    }

    const dataUrl = encodeCanvas(canvas);

    if (!dataUrl) {
      return null;
    }

    return buildPreparedImage(file, fallbackBaseName, dataUrl);
  } catch {
    return null;
  }
};

export const prepareImageForUpload = async (
  file: File,
  fallbackBaseName = 'imagen',
): Promise<PreparedImage> => {
  const compressedFromBitmap = await compressWithCreateImageBitmap(file, fallbackBaseName);

  if (compressedFromBitmap) {
    return compressedFromBitmap;
  }

  const originalDataUrl = await readFileAsDataUrl(file);
  const compressedFromImage = await compressWithImageElement(
    file,
    fallbackBaseName,
    originalDataUrl,
  );

  if (compressedFromImage) {
    return compressedFromImage;
  }

  return {
    fileName: file.name || `${fallbackBaseName}.jpg`,
    mimeType: resolveMimeType(file),
    dataBase64: stripDataUrlPrefix(originalDataUrl),
  };
};
