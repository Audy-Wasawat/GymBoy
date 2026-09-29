/** Longest-side limits: body photos keep more detail than food photos. */
export const BODY_PHOTO_MAX = 800
export const FOOD_PHOTO_MAX = 480
export const PHOTO_QUALITY = 0.75

/** Scales (w, h) so the longest side is at most maxSide, never enlarging. Pure, so it is testable. */
export function fitDimensions(w: number, h: number, maxSide: number): { w: number; h: number } {
  const scale = Math.min(1, maxSide / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) }
}

/**
 * Compresses a picked/taken image to a JPEG Blob (Safari cannot encode WebP), honouring EXIF
 * orientation via createImageBitmap. Browser-only; the pure sizing lives in fitDimensions.
 */
export async function compressImage(file: Blob, maxSide: number, quality = PHOTO_QUALITY): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const { w, h } = fitDimensions(bitmap.width, bitmap.height, maxSide)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) { bitmap.close(); throw new Error('no 2d context') }
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality)
  )
}
