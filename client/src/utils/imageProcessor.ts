import smartcrop from 'smartcrop';

/** Output avatar dimensions (2x retina for 88px max display) */
const AVATAR_SIZE = 256;
const JPEG_QUALITY = 0.85;

/**
 * Load a File as an HTMLImageElement.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    const url = URL.createObjectURL(file);
    img.src = url;
    // Clean up object URL after load
    img.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
  });
}

/**
 * Process an uploaded photo on the client side:
 * 1. Smart-crop to find face / interesting area (square)
 * 2. Resize to AVATAR_SIZE × AVATAR_SIZE
 * 3. Compress as JPEG
 *
 * Returns a ready-to-upload File object (~20-50KB).
 */
export async function processAvatarClient(file: File): Promise<File> {
  const img = await loadImage(file);
  const origW = img.naturalWidth;
  const origH = img.naturalHeight;

  // Smart crop: find best square region
  const minDim = Math.min(origW, origH);
  const result = await smartcrop.crop(img, { width: minDim, height: minDim });
  const crop = result.topCrop;

  // Clamp crop bounds to image dimensions
  const left = Math.max(0, Math.round(crop.x));
  const top = Math.max(0, Math.round(crop.y));
  const width = Math.min(Math.round(crop.width), origW - left);
  const height = Math.min(Math.round(crop.height), origH - top);

  // Draw cropped + resized image on canvas
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, left, top, width, height, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

  // Convert to JPEG blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });

  // Wrap as File for FormData upload
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
}
