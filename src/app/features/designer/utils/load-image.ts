const MAX_IMAGE_SIDE_PX = 3000;

export class InvalidImageError extends Error {
  constructor() {
    super('Unsupported image file');
  }
}

export async function loadImageFile(file: File): Promise<HTMLCanvasElement> {
  if (!file.type.startsWith('image/')) throw new InvalidImageError();
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new InvalidImageError();
    }
    const scale = Math.min(1, MAX_IMAGE_SIDE_PX / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const THUMBNAIL_SIDE_PX = 80;

export function createThumbnail(source: HTMLCanvasElement): string {
  const scale = Math.min(1, THUMBNAIL_SIDE_PX / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}
