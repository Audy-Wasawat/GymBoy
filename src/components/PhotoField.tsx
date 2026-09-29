import { useState } from 'react'
import { Camera, ImagePlus, Trash2 } from 'lucide-react'
import { useT } from '../i18n/useT'
import { compressImage } from '../lib/photos'
import { usePhotoUrl } from './usePhotoUrl'

const button = 'flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 text-[15px]'

/**
 * A photo with two ways to add it: "Take photo" opens the camera only (capture), "Choose photo"
 * opens the photo library. iOS gives the library only to an input without `capture`, so one input
 * cannot do both. The picture is compressed before it is handed back.
 */
export function PhotoField({ photo, onChange, maxSide, capture, alt, allowRemove = true }: {
  photo?: Blob
  onChange: (photo: Blob | undefined) => void
  maxSide: number
  /** Which camera "Take photo" opens: the back one for food, the front one for selfies. */
  capture: 'environment' | 'user'
  alt: string
  allowRemove?: boolean
}) {
  const t = useT()
  const url = usePhotoUrl(photo)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // so picking the same file again still fires
    if (!file) return
    setBusy(true)
    setFailed(false)
    try {
      onChange(await compressImage(file, maxSide))
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-4 py-3">
      {url && <img src={url} alt={alt} className="mb-3 w-full rounded-lg object-cover" style={{ maxHeight: 300 }} />}
      <div className="flex gap-2">
        <label className={button}>
          <Camera size={18} aria-hidden />
          {t('photo.take')}
          <input type="file" accept="image/*" capture={capture} className="sr-only" onChange={handle} disabled={busy} />
        </label>
        <label className={button}>
          <ImagePlus size={18} aria-hidden />
          {t('photo.choose')}
          <input type="file" accept="image/*" className="sr-only" onChange={handle} disabled={busy} />
        </label>
      </div>
      {photo && allowRemove && (
        <button onClick={() => onChange(undefined)} className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-line text-[15px] text-weights">
          <Trash2 size={18} aria-hidden />
          {t('photo.remove')}
        </button>
      )}
      {busy && <p role="status" className="mt-2 text-[13px] text-muted">{t('photo.working')}</p>}
      {failed && <p role="alert" className="mt-2 text-[14px] text-weights">{t('photo.failed')}</p>}
    </div>
  )
}
