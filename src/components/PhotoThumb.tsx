import { usePhotoUrl } from './usePhotoUrl'

/** A 56 px rounded thumbnail of a stored photo, loaded lazily; renders nothing without a photo. */
export function PhotoThumb({ blob, alt }: { blob?: Blob; alt: string }) {
  const url = usePhotoUrl(blob)
  if (!blob || !url) return null
  return <img src={url} alt={alt} loading="lazy" decoding="async" width={56} height={56} className="h-14 w-14 shrink-0 rounded-lg bg-bg object-cover" />
}
