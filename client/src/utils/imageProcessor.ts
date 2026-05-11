import smartcrop from 'smartcrop';

/**
 * Best-effort smart-crop + JPEG encode. Any failure (HEIC from iOS Photos,
 * canvas encode returning null, smartcrop blowing up on weird aspect ratios)
 * falls through to the original file so the upload can still try; the server
 * is the final gatekeeper on mime + size.
 */
export const processAvatar = async (file: File, size = 256): Promise<Blob> => {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('image decode failed'));
      i.src = URL.createObjectURL(file);
    });
    const r = await smartcrop.crop(img, { width: size, height: size });
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, r.topCrop.x, r.topCrop.y, r.topCrop.width, r.topCrop.height, 0, 0, size, size);
    const blob = await new Promise<Blob | null>((resolve) => c.toBlob((b) => resolve(b), 'image/jpeg', 0.85));
    return blob ?? file;
  } catch (e) {
    console.warn('[processAvatar] falling back to original file', e);
    return file;
  }
};

export const uploadPhoto = async (treeId: string, personId: string, blob: Blob): Promise<string> => {
  // Use the shared axios client so token refresh + Authorization header behave
  // the same as everywhere else (raw fetch silently failed on 401).
  const { api } = await import('../api/client');
  const fd = new FormData();
  fd.append('photo', blob, 'photo.jpg');
  const r = await api.post<{ photoUrl: string }>(`/trees/${treeId}/persons/${personId}/photo`, fd);
  return r.data.photoUrl;
};
