import { lazy, Suspense, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart2, Plus } from 'lucide-react'
import { Page, Section } from '../../components/Page'
import { listBodyEntries } from '../../db/body'
import { useSettings } from '../../db/useSettings'
import type { BodyEntry, BodyPose } from '../../db/types'
import { POSES } from './BodyPhotosField'
import { useT } from '../../i18n/useT'
import { formatDate } from '../../lib/dates'
import { toDisplayWeight } from '../../lib/units'
import { usePhotoUrl } from '../../components/usePhotoUrl'
import { PhotoViewer } from '../../components/PhotoViewer'

const BodyChartView = lazy(() => import('./BodyChartView'))

function PhotoThumb({ blob, label, count }: { blob?: Blob; label: string; count: number }) {
  const url = usePhotoUrl(blob)
  if (!url) return null
  return (
    <span className="relative flex-shrink-0">
      <img src={url} alt={label} className="h-12 w-12 rounded-lg object-cover" />
      {count > 1 && (
        <span className="absolute -bottom-1 -right-1 rounded-full border-2 border-surface bg-ink px-1.5 text-[11px] font-bold leading-4 text-surface">{count}</span>
      )}
    </span>
  )
}

const hasPhotos = (e: BodyEntry) => !!e.photos?.length

export function Body() {
  const t = useT()
  const nav = useNavigate()
  const { weightUnit, language } = useSettings()
  const entries = useLiveQuery(listBodyEntries, [])

  const [compareMode, setCompareMode] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [showChart, setShowChart] = useState(false)
  const [viewing, setViewing] = useState<BodyEntry | null>(null)

  const withPhotos = entries?.filter(hasPhotos) ?? []

  function toggleSelect(id: number) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length < 2) return [...prev, id]
      return [prev[1], id]
    })
  }

  const compareEntries = selected.map((id) => entries?.find((e) => e.id === id)).filter(Boolean) as BodyEntry[]

  return (
    <Page title={t('body.title')} back="/more">
      <div className="mb-5 flex gap-3">
        <button
          onClick={() => nav('/more/body/new')}
          className="flex flex-1 min-h-[52px] items-center justify-center gap-2 rounded-xl bg-weights text-[16px] font-semibold text-white"
        >
          <Plus size={18} aria-hidden />
          {t('body.add')}
        </button>
        {entries && entries.length >= 2 && (
          <button
            onClick={() => setShowChart(!showChart)}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-[15px]"
            aria-label={t('body.chart')}
          >
            <BarChart2 size={18} className="text-muted" aria-hidden />
          </button>
        )}
      </div>

      {showChart && entries && entries.length >= 2 && (
        <Suspense fallback={null}>
          <BodyChartView entries={entries} weightUnit={weightUnit} language={language} />
        </Suspense>
      )}

      {/* photo compare */}
      {withPhotos.length >= 2 && (
        <div className="mb-4">
          <button
            onClick={() => { setCompareMode(!compareMode); setSelected([]) }}
            className={`mb-3 flex min-h-[44px] w-full items-center justify-center rounded-xl border text-[15px] ${compareMode ? 'border-weights bg-weights text-white' : 'border-line bg-surface'}`}
          >
            {compareMode ? t('body.comparing') : t('body.compare')}
          </button>
          {compareMode && (
            <p className="mb-3 text-[13px] text-muted px-1">
              {selected.length < 2 ? t('body.compareHint') : ''}
            </p>
          )}
          {compareMode && selected.length === 2 && (
            <CompareView entries={compareEntries} weightUnit={weightUnit} language={language} />
          )}
        </div>
      )}

      {entries?.length === 0 ? (
        <p className="px-1 py-4 text-[15px] text-muted">{t('body.empty')}</p>
      ) : (
        <Section>
          {entries?.map((e) => {
            const pick = () => {
              if (compareMode) { if (hasPhotos(e)) toggleSelect(e.id!) }
              else nav(`/more/body/${e.id}`)
            }
            return (
              <div
                key={e.id}
                className={`flex w-full min-h-[56px] items-center gap-3 border-b border-line px-4 py-2 last:border-b-0 ${compareMode ? (hasPhotos(e) ? (selected.includes(e.id!) ? 'bg-weights/10' : '') : 'opacity-30') : ''}`}
              >
                {hasPhotos(e) && (
                  <button
                    type="button"
                    onClick={() => (compareMode ? pick() : setViewing(e))}
                    aria-label={`${t('photo.view')} ${formatDate(e.date, language)}`}
                    className="-my-1 flex min-h-[44px] shrink-0 items-center"
                  >
                    <PhotoThumb blob={e.photos?.[0]?.blob} count={e.photos?.length ?? 0} label="" />
                  </button>
                )}
                <button type="button" onClick={pick} className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px]">{toDisplayWeight(e.weightKg, weightUnit)} {weightUnit}</span>
                    <span className="block text-[13px] text-muted">{formatDate(e.date, language)}</span>
                  </span>
                  {compareMode && hasPhotos(e) && (
                    <span className={`h-6 w-6 rounded-full border-2 flex-shrink-0 ${selected.includes(e.id!) ? 'border-weights bg-weights' : 'border-muted'}`} />
                  )}
                </button>
              </div>
            )
          })}
        </Section>
      )}

      {viewing?.photos?.length ? (
        <PhotoViewer
          popup
          photos={viewing.photos.map((p) => ({ blob: p.blob, caption: t(`pose.${p.pose}`) }))}
          title={`${formatDate(viewing.date, language)} · ${toDisplayWeight(viewing.weightKg, weightUnit)} ${weightUnit}`}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </Page>
  )
}

/** Pairs of photos from the same side; without any shared side, the first photo of each day. */
function comparePairs(a: BodyEntry, b: BodyEntry) {
  const pa = a.photos ?? []
  const pb = b.photos ?? []
  const pairs = POSES.flatMap((pose) => {
    const x = pa.find((p) => p.pose === pose)
    const y = pb.find((p) => p.pose === pose)
    return x && y ? [{ pose: pose as BodyPose | undefined, a: x.blob, b: y.blob }] : []
  })
  return pairs.length ? { pairs, matched: true } : { pairs: [{ pose: undefined, a: pa[0]?.blob, b: pb[0]?.blob }], matched: false }
}

function CompareView({ entries, weightUnit, language }: { entries: BodyEntry[]; weightUnit: 'kg' | 'lb'; language: 'th' | 'en' }) {
  const t = useT()
  // Older day on the left.
  const [a, b] = [...entries].sort((x, y) => x.date.localeCompare(y.date))
  const { pairs, matched } = comparePairs(a, b)
  const [viewing, setViewing] = useState<{ pair: number; side: 0 | 1 } | null>(null)
  // Viewer pages: every compared photo in reading order (pair by pair, older then newer).
  const viewerPhotos = pairs.flatMap((p) => [
    p.a ? { blob: p.a, caption: `${formatDate(a.date, language)}${p.pose ? ` · ${t(`pose.${p.pose}`)}` : ''}` } : null,
    p.b ? { blob: p.b, caption: `${formatDate(b.date, language)}${p.pose ? ` · ${t(`pose.${p.pose}`)}` : ''}` } : null
  ]).filter((x): x is { blob: Blob; caption: string } => x !== null)
  const startIndex = (pair: number, side: 0 | 1) => {
    const blob = side === 0 ? pairs[pair].a : pairs[pair].b
    return Math.max(0, viewerPhotos.findIndex((v) => v.blob === blob))
  }
  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="grid grid-cols-2 border-b border-line">
        {[a, b].map((e, i) => (
          <div key={i} className={`p-2 text-center ${i === 0 ? 'border-r border-line' : ''}`}>
            <div className="text-[15px] font-bold">{toDisplayWeight(e.weightKg, weightUnit)} {weightUnit}</div>
            <div className="text-[12px] text-muted">{formatDate(e.date, language)}</div>
          </div>
        ))}
      </div>
      {!matched && <p className="px-3 pt-2 text-[12px] text-muted">{t('body.noSamePose')}</p>}
      {pairs.map((p, i) => (
        <div key={i} className="p-2">
          {p.pose && <div className="eyebrow mb-1.5 px-1">{t(`pose.${p.pose}`)}</div>}
          <div className="grid grid-cols-2 gap-2">
            <CompareImg blob={p.a} alt={`${t('body.photo')} ${formatDate(a.date, language)}`} onView={() => setViewing({ pair: i, side: 0 })} />
            <CompareImg blob={p.b} alt={`${t('body.photo')} ${formatDate(b.date, language)}`} onView={() => setViewing({ pair: i, side: 1 })} />
          </div>
        </div>
      ))}
      {viewing && viewerPhotos.length > 0 && (
        <PhotoViewer photos={viewerPhotos} start={startIndex(viewing.pair, viewing.side)} onClose={() => setViewing(null)} />
      )}
    </div>
  )
}

function CompareImg({ blob, alt, onView }: { blob?: Blob; alt: string; onView: () => void }) {
  const url = usePhotoUrl(blob)
  if (!url) return <div className="aspect-[3/4] rounded-xl bg-raised" />
  return (
    <button type="button" onClick={onView} aria-label={`${alt}`} className="block w-full">
      <img src={url} alt="" className="aspect-[3/4] w-full rounded-xl object-cover" />
    </button>
  )
}
