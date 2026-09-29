/** Photos are kept to about this size on average, so the phone and the backup file stay small. */
export const PHOTO_TARGET_BYTES = 60 * 1024

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
 * The encoding attempts for a photo, best first: the given quality, then lower qualities, then a
 * smaller picture. The first result within PHOTO_TARGET_BYTES wins; a photo that needs the whole
 * list keeps its smallest result. Pure, so it is testable.
 */
export function compressionSteps(quality = PHOTO_QUALITY): { scale: number; quality: number }[] {
  return [
    { scale: 1, quality },
    { scale: 1, quality: Math.max(0.5, quality - 0.1) },
    { scale: 1, quality: Math.max(0.45, quality - 0.2) },
    { scale: 0.85, quality: Math.max(0.5, quality - 0.15) },
    { scale: 0.7, quality: Math.max(0.5, quality - 0.15) }
  ]
}

/**
 * Compresses a picked/taken image to a JPEG Blob (Safari cannot encode WebP), honouring EXIF
 * orientation via createImageBitmap. Browser-only; the pure parts are fitDimensions and compressionSteps.
 */
export async function compressImage(file: Blob, maxSide: number, quality = PHOTO_QUALITY): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const { w, h } = fitDimensions(bitmap.width, bitmap.height, maxSide)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    let best: Blob | undefined
    for (const step of compressionSteps(quality)) {
      canvas.width = Math.max(1, Math.round(w * step.scale))
      canvas.height = Math.max(1, Math.round(h * step.scale))
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', step.quality)
      )
      if (blob.size <= PHOTO_TARGET_BYTES) return blob
      if (!best || blob.size < best.size) best = blob
    }
    return best!
  } finally {
    bitmap.close()
  }
}
