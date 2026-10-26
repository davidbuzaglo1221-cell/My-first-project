/**
 * Downscales a photo in the browser before it leaves the phone: smaller uploads, faster
 * recognition, and a small thumbnail to keep in the diary. EXIF orientation is applied by
 * createImageBitmap, so phone photos come out upright.
 */
export async function resizeImage(file: Blob, maxSide: number, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

/** "data:image/jpeg;base64,XXXX" → "XXXX". */
export function base64Of(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}
