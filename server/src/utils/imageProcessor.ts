/**
 * imageProcessor — smart-crop + resize + compress uploaded photos.
 *
 * Uses `smartcrop` (content-aware cropping by skin tone / edges / saturation)
 * paired with `sharp` (resize, extract, JPEG compress).
 *
 * We write our own smartcrop↔sharp adapter instead of using `smartcrop-sharp`
 * because that package requires sharp ^0.32.5 (we have 0.33.2).
 * The adapter is based on https://github.com/jwagner/smartcrop-sharp
 */
import sharp from 'sharp';
import smartcrop from 'smartcrop';

// Output avatar: 256×256 — retina quality for 88px max display (3x) + quality margin
const AVATAR_SIZE = 256;
const JPEG_QUALITY = 85;

/* ─────── smartcrop ↔ sharp adapter ─────── */

interface SmartCropResult {
  topCrop: { x: number; y: number; width: number; height: number };
}

async function smartCropWithSharp(
  inputBuffer: Buffer,
  width: number,
  height: number
): Promise<SmartCropResult> {
  const imageOperations = {
    async open(src: Buffer) {
      const image = sharp(src);
      const metadata = await image.metadata();
      return {
        width: metadata.width!,
        height: metadata.height!,
        _sharp: image,
      };
    },
    async resample(img: any, w: number, h: number) {
      return { width: w, height: h, _sharp: sharp(inputBuffer) };
    },
    async getData(img: any) {
      const { data, info } = await img._sharp
        .resize(img.width, img.height, { fit: 'fill' })
        .raw()
        .ensureAlpha()
        .toBuffer({ resolveWithObject: true });
      return {
        data: new Uint8ClampedArray(data.buffer),
        width: info.width,
        height: info.height,
      };
    },
  };

  // smartcrop types don't include imageOperations, but it's supported at runtime
  return (smartcrop as any).crop(inputBuffer, { width, height, imageOperations });
}

/* ─────── Main export ─────── */

/**
 * Process uploaded photo into an optimized square avatar:
 * 1. Smart-crop to find face/interesting area
 * 2. Extract best square region
 * 3. Resize to AVATAR_SIZE × AVATAR_SIZE
 * 4. Compress as JPEG 85%
 *
 * Input: raw image buffer (JPEG/PNG/WebP, any size up to 5MB)
 * Output: ~20-50KB JPEG 256×256
 */
export async function processAvatar(inputBuffer: Buffer): Promise<{
  data: Buffer;
  mime: string;
}> {
  // Get original dimensions
  const metadata = await sharp(inputBuffer).metadata();
  const origW = metadata.width!;
  const origH = metadata.height!;

  // Smart crop: find best square crop region
  const minDim = Math.min(origW, origH);
  const result = await smartCropWithSharp(inputBuffer, minDim, minDim);
  const crop = result.topCrop;

  // Clamp crop coordinates to image bounds
  const left = Math.max(0, Math.round(crop.x));
  const top = Math.max(0, Math.round(crop.y));
  const width = Math.min(Math.round(crop.width), origW - left);
  const height = Math.min(Math.round(crop.height), origH - top);

  // Extract crop region → resize to avatar → compress as JPEG
  const outputBuffer = await sharp(inputBuffer)
    .extract({ left, top, width, height })
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  return { data: outputBuffer, mime: 'image/jpeg' };
}
