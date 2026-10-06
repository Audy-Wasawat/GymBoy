import { useState } from 'react'
import { Camera, ImagePlus, X } from 'lucide-react'
import type { BodyPhoto, BodyPose } from '../../db/types'
import { useT } from '../../i18n/useT'
import { BODY_PHOTO_MAX, compressImage } from '../../lib/photos'
import { usePhotoUrl } from '../../components/usePhotoUrl'

export const POSES: BodyPose[] = ['front', 'side', 'back', 'other']
export const MAX_BODY_PHOTOS = 6

/** The first pose not used yet (front, then side, then back), so three quick photos label themselves. */
const nextPose = (photos: BodyPhoto[]): BodyPose =>
  POSES.find((p) => p !== 'other' && !photos.some((x) => x.pose === p)) ?? 'other'

const button = 'flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-raised px-3 text-[15px] font-medium'

/** Several progress photos for one body entry, each tagged front / side / back / other. */
export function BodyPhotosField({ photos, onChange, alt }: {
  photos: BodyPhoto[]
  onChange: (photos: BodyPhoto[]) => void
  alt: string
}) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const full = photos.length >= MAX_BODY_PHOTOS

  async function add(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])]
    e.target.value = '' // so picking the same file again still fires
    if (!files.length) return
    setBusy(true)
    setFailed(false)
    let next = photos
    try {
      for (const file of files.slice(0, MAX_BODY_PHOTOS - photos.length)) {
        try {
          const blob = await compressImage(file, BODY_PHOTO_MAX)
          next = [...next, { blob, pose: nextPose(next) }]
        } catch {
          setFailed(true)
        }
      }
      onChange(next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-4 py-3">
      {photos.length > 0 && (
        <ul className="mb-3 grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <PhotoTile
              key={i}
              photo={p}
              alt={`${alt} · ${t(`pose.${p.pose}`)}`}
              onPose={(pose) => onChange(photos.map((x, j) => (j === i ? { ...x, pose } : x)))}
              onRemove={() => onChange(photos.filter((_, j) => j !== i))}
            />
          ))}
        </ul>
      )}
      {!full && (
        <div className="flex gap-2">
          <label className={button}>
            <Camera size={18} aria-hidden />
            {t('photo.take')}
            <input type="file" accept="image/*" capture="user" className="sr-only" onChange={add} disabled={busy} />
          </label>
          <label className={button}>
            <ImagePlus size={18} aria-hidden />
            {t('photo.choose')}
            <input type="file" accept="image/*" multiple className="sr-only" onChange={add} disabled={busy} />
          </label>
        </div>
      )}
      <p className="mt-2 text-[12px] text-muted">{t('body.photosNote').replace('{n}', String(MAX_BODY_PHOTOS))}</p>
      {busy && <p role="status" className="mt-2 text-[13px] text-muted">{t('photo.working')}</p>}
      {failed && <p role="alert" className="mt-2 text-[14px] text-weights">{t('photo.failed')}</p>}
    </div>
  )
}

function PhotoTile({ photo, alt, onPose, onRemove }: {
  photo: BodyPhoto; alt: string; onPose: (pose: BodyPose) => void; onRemove: () => void
}) {
  const t = useT()
  const url = usePhotoUrl(photo.blob)
  return (
    <li className="relative overflow-hidden rounded-xl bg-raised">
      {url && <img src={url} alt={alt} className="aspect-[3/4] w-full object-cover" />}
      <button
        onClick={onRemove}
        aria-label={`${t('photo.remove')} ${t(`pose.${photo.pose}`)}`}
        className="absolute right-0 top-0 flex h-11 w-11 items-start justify-end p-1.5"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white/95"><X size={16} aria-hidden /></span>
      </button>
      <select
        value={photo.pose}
        onChange={(e) => onPose(e.target.value as BodyPose)}
        aria-label={t('pose.label')}
        className="absolute inset-x-1 bottom-1 min-h-[40px] rounded-lg bg-black/60 px-2 text-center text-[13px] font-semibold text-white/95"
      >
        {POSES.map((p) => <option key={p} value={p}>{t(`pose.${p}`)}</option>)}
      </select>
    </li>
  )
}
