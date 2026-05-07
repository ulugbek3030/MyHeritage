export const exportTreeAsPng = async (_containerEl: HTMLElement): Promise<Blob> => {
  // Phase 1.5: use html-to-image or dom-to-image-more for real export.
  // MVP stub: a placeholder PNG with a message.
  const canvas = document.createElement('canvas');
  canvas.width = 600; canvas.height = 800;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0a0a0d'; ctx.fillRect(0, 0, 600, 800);
  ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Click Family — Image export', 300, 380);
  ctx.fillStyle = '#a1a1aa'; ctx.font = '14px sans-serif';
  ctx.fillText('Полный экспорт в Phase 1.5', 300, 410);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
