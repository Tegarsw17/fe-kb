// Shrinks photos before upload (max 1280 px, JPEG ~70%) — a 4 MB phone photo
// becomes ~150–250 KB, which saves storage, data and battery.

export async function compressImage(file: File | Blob, maxSide = 1280, quality = 0.7): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d')!.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b ?? file), 'image/jpeg', quality));
  } finally {
    URL.revokeObjectURL(url);
  }
}
