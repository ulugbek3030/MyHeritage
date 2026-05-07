import smartcrop from 'smartcrop';

export const processAvatar = async (file: File, size = 256): Promise<Blob> => {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = URL.createObjectURL(file);
  });
  let blob: Blob;
  try {
    const r = await smartcrop.crop(img, { width: size, height: size });
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, r.topCrop.x, r.topCrop.y, r.topCrop.width, r.topCrop.height, 0, 0, size, size);
    blob = await new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b!), 'image/jpeg', 0.85));
  } catch {
    blob = file;
  }
  return blob;
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
