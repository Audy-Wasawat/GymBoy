import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useDialog } from './Dialog'
import { usePhotoUrl } from './usePhotoUrl'
import { useT } from '../i18n/useT'

export interface ViewerPhoto { blob: Blob; caption?: string }

/**
 * View of stored photos: full screen, or with `popup` a card over the dimmed page. Swipe or use the arrows to move between them; tap ✕, the
 * backdrop or Escape to close. Pinch to zoom is left to the browser.
 */
export function PhotoViewer({ photos, start = 0, title, onClose, popup = false }: {
  photos: ViewerPhoto[]; start?: number; title?: string; onClose: () => void; popup?: boolean
}) {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  useDialog(ref, onClose)
  const [i, setI] = useState(Math.min(start, photos.length - 1))
  const touch = useRef<{ x: number; y: number } | null>(null)
  const many = photos.length > 1
  const go = (d: number) => setI((cur) => (cur + d + photos.length) % photos.length)
  const photo = photos[i]

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? t('photo.view')}
      className={popup
        ? 'fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 outline-none animate-fade-in'
        : 'fixed inset-0 z-[60] flex flex-col bg-black text-white outline-none'}
      style={popup ? { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' } : undefined}
      onClick={popup ? (e) => { if (e.target === e.currentTarget) onClose() } : undefined}
      onKeyDown={(e) => {
        if (!many) return
        if (e.key === 'ArrowLeft') go(-1)
        else if (e.key === 'ArrowRight') go(1)
      }}
    >
      <div className={popup ? 'flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl bg-neutral-900 text-white shadow-2xl' : 'contents'}>
      <div
        className="flex shrink-0 items-center gap-2 px-2"
        style={{ paddingTop: popup ? '8px' : 'calc(env(safe-area-inset-top, 0px) + 6px)' }}
      >
        <div className="min-w-0 flex-1 px-2">
          {title && <div className="truncate text-[15px] font-semibold">{title}</div>}
          <div className="truncate text-[13px] text-white/70">
            {[photo?.caption, many ? `${i + 1} / ${photos.length}` : ''].filter(Boolean).join(' · ')}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label={t('common.close')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15"
        >
          <X size={22} aria-hidden />
        </button>
      </div>

      <div
        className={popup ? 'relative h-[62vh] min-h-0' : 'relative min-h-0 flex-1'}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
        onTouchEnd={(e) => {
          const s = touch.current
          touch.current = null
          if (!s || !many || e.changedTouches.length !== 1) return
          const dx = e.changedTouches[0].clientX - s.x
          const dy = e.changedTouches[0].clientY - s.y
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1)
        }}
      >
        {photo && <ViewerImage key={i} blob={photo.blob} alt={photo.caption ?? ''} onBackdrop={onClose} />}
        {many && (
          <>
            <button
              onClick={() => go(-1)}
              aria-label={t('photo.prev')}
              className="absolute left-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50"
            >
              <ChevronLeft size={24} aria-hidden />
            </button>
            <button
              onClick={() => go(1)}
              aria-label={t('photo.next')}
              className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50"
            >
              <ChevronRight size={24} aria-hidden />
            </button>
          </>
        )}
      </div>

      {many && (
        <div
          className="flex shrink-0 justify-center gap-1.5 pt-3"
          style={{ paddingBottom: popup ? '14px' : 'calc(env(safe-area-inset-bottom, 0px) + 14px)' }}
          aria-hidden
        >
          {photos.map((_, j) => (
            <span key={j} className={`h-1.5 rounded-full transition-all ${j === i ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}`} />
          ))}
        </div>
      )}
      {!many && <div className="shrink-0" style={{ height: popup ? '8px' : 'calc(env(safe-area-inset-bottom, 0px) + 14px)' }} />}
      </div>
    </div>
  )
}

function ViewerImage({ blob, alt, onBackdrop }: { blob: Blob; alt: string; onBackdrop: () => void }) {
  const url = usePhotoUrl(blob)
  return (
    <div className="absolute inset-0 flex items-center justify-center p-2" onClick={(e) => { if (e.target === e.currentTarget) onBackdrop() }}>
      {url && <img src={url} alt={alt} className="max-h-full max-w-full select-none object-contain" draggable={false} />}
    </div>
  )
}
