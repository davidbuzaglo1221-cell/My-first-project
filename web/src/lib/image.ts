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

/**
 * Like resizeImage, but steps the size down until the data URL fits `maxChars` (a stored
 * document in the chat build holds at most 256 KB).
 */
export async function resizeImageUnder(file: Blob, maxSide: number, maxChars: number): Promise<string> {
  let side = maxSide;
  let q = 0.8;
  for (;;) {
    const url = await resizeImage(file, side, q);
    if (url.length <= maxChars || side <= 320) return url;
    if (q > 0.66) q -= 0.07;
    else side = Math.round(side * 0.82);
  }
}

/** "data:image/jpeg;base64,XXXX" → "XXXX". */
export function base64Of(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}
