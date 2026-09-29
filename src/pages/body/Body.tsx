import { lazy, Suspense, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart2, Plus } from 'lucide-react'
import { Page, Section } from '../../components/Page'
import { listBodyEntries } from '../../db/body'
import { useSettings } from '../../db/useSettings'
import type { BodyEntry } from '../../db/types'
import { useT } from '../../i18n/useT'
import { formatDate } from '../../lib/dates'
import { toDisplayWeight } from '../../lib/units'
import { usePhotoUrl } from '../../components/usePhotoUrl'

const BodyChartView = lazy(() => import('./BodyChartView'))

function PhotoThumb({ blob, label }: { blob?: Blob; label: string }) {
  const url = usePhotoUrl(blob)
  if (!url) return null
  return <img src={url} alt={label} className="h-12 w-12 rounded-md object-cover flex-shrink-0" />
}

export function Body() {
  const t = useT()
  const nav = useNavigate()
  const { weightUnit, language } = useSettings()
  const entries = useLiveQuery(listBodyEntries, [])

  const [compareMode, setCompareMode] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [showChart, setShowChart] = useState(false)

  const withPhotos = entries?.filter((e) => e.photo) ?? []

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
          <BodyChartView entries={entries} weightUnit={weightUnit} />
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
          {entries?.map((e) => (
            <button
              key={e.id}
              onClick={() => compareMode && e.photo ? toggleSelect(e.id!) : nav(`/more/body/${e.id}`)}
              className={`flex w-full min-h-[56px] items-center gap-3 border-b border-line px-4 py-2 last:border-b-0 text-left ${compareMode && e.photo ? (selected.includes(e.id!) ? 'bg-weights/10' : '') : ''}`}
            >
              <PhotoThumb blob={e.photo} label={e.date} />
              <span className="flex-1">
                <span className="block text-[16px]">{toDisplayWeight(e.weightKg, weightUnit)} {weightUnit}</span>
                <span className="block text-[13px] text-muted">{formatDate(e.date, language)}</span>
              </span>
              {compareMode && e.photo && (
                <span className={`h-6 w-6 rounded-full border-2 flex-shrink-0 ${selected.includes(e.id!) ? 'border-weights bg-weights' : 'border-muted'}`} />
              )}
            </button>
          ))}
        </Section>
      )}
    </Page>
  )
}

function CompareView({ entries, weightUnit, language }: { entries: BodyEntry[]; weightUnit: 'kg' | 'lb'; language: 'th' | 'en' }) {
  const url0 = usePhotoUrl(entries[0]?.photo)
  const url1 = usePhotoUrl(entries[1]?.photo)
  return (
    <div className="mb-4 rounded-xl border border-line bg-surface overflow-hidden">
      <div className="grid grid-cols-2 gap-0">
        {[0, 1].map((i) => {
          const e = entries[i]
          const url = i === 0 ? url0 : url1
          return (
            <div key={i} className={`${i === 0 ? 'border-r border-line' : ''}`}>
              {url && <img src={url} alt={e?.date} className="w-full aspect-square object-cover" />}
              <div className="p-2 text-center">
                <div className="text-[13px] font-semibold">{e ? toDisplayWeight(e.weightKg, weightUnit) + ' ' + weightUnit : ''}</div>
                <div className="text-[12px] text-muted">{e ? formatDate(e.date, language) : ''}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
