export function resizeForOCR(
  image: HTMLImageElement | HTMLCanvasElement,
  maxWidth = 1200
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const srcWidth = image.width;
  const srcHeight = image.height;

  let destWidth = srcWidth;
  let destHeight = srcHeight;

  if (srcWidth > maxWidth) {
    const scale = maxWidth / srcWidth;
    destWidth = maxWidth;
    destHeight = Math.round(srcHeight * scale);
  }

  canvas.width = destWidth;
  canvas.height = destHeight;

  // Use explicit source and destination rectangles for reliable scaling
  ctx.drawImage(
    image,
    0, 0, srcWidth, srcHeight,  // source rectangle
    0, 0, destWidth, destHeight  // destination rectangle
  );

  return canvas;
}

/**
 * Preprocess image for better OCR results on license plates
 * - Convert to grayscale
 * - Increase contrast
 * Uses canvas filter API for better performance and reliability
 */
export function preprocessForOCR(
  image: HTMLImageElement | HTMLCanvasElement,
  maxWidth = 1200
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const srcWidth = image.width;
  const srcHeight = image.height;

  let destWidth = srcWidth;
  let destHeight = srcHeight;

  if (srcWidth > maxWidth) {
    const scale = maxWidth / srcWidth;
    destWidth = maxWidth;
    destHeight = Math.round(srcHeight * scale);
  }

  canvas.width = destWidth;
  canvas.height = destHeight;

  // Apply grayscale and contrast via CSS filters
  ctx.filter = 'grayscale(100%) contrast(150%)';

  // Use explicit source and destination rectangles for reliable scaling
  ctx.drawImage(
    image,
    0, 0, srcWidth, srcHeight,  // source rectangle
    0, 0, destWidth, destHeight  // destination rectangle
  );

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to convert canvas to blob'));
      }
    }, 'image/jpeg', 0.8);
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
