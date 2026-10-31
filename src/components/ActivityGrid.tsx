import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { workoutSessions } from '../db/workoutDays'
import { useSettings } from '../db/useSettings'
import { useT } from '../i18n/useT'
import { formatDate, localDate, parseLocalDate, startOfWeek } from '../lib/dates'
import type { StringKey } from '../i18n/strings'
import { gridPartsLabel, type GridPart } from '../lib/gridLabel'

type Filter = 'all' | 'weights' | 'running' | 'other'
type DayColor = 'weights' | 'running' | 'both' | 'other' | 'none' | 'blank'

interface DayData {
  date: string
  color: DayColor
  hasWeights: boolean
  hasRun: boolean
  hasOther: boolean
}

const DAY_KEYS: StringKey[] = ['grid.mon', 'grid.tue', 'grid.wed', 'grid.thu', 'grid.fri', 'grid.sat', 'grid.sun']

/** The coloured stripes of a cell, in a fixed order: red weights, blue running, yellow other sports. */
function dayParts(d: DayData, filter: Filter): GridPart[] {
  if (filter === 'weights') return d.hasWeights ? ['weights'] : []
  if (filter === 'running') return d.hasRun ? ['running'] : []
  if (filter === 'other') return d.hasOther ? ['other'] : []
  const parts: GridPart[] = []
  if (d.hasWeights) parts.push('weights')
  if (d.hasRun) parts.push('running')
  if (d.hasOther) parts.push('other')
  return parts
}

const FILTER_BG: Record<Filter, string> = { all: 'bg-weights', weights: 'bg-weights', running: 'bg-running', other: 'bg-other' }
const FILTER_KEY: Record<Filter, StringKey> = { all: 'grid.all', weights: 'grid.weights', running: 'grid.running', other: 'grid.other' }

const PART_BG: Record<GridPart, string> = { weights: 'bg-weights', running: 'bg-running', other: 'bg-other' }

interface DaySummaryPopup {
  date: string
  hasWeights: boolean
  hasRun: boolean
  hasOther: boolean
}

export function ActivityGrid() {
  const t = useT()
  const [filter, setFilter] = useState<Filter>('all')
  const [popup, setPopup] = useState<DaySummaryPopup | null>(null)
  const { language } = useSettings()

  const today = localDate()

  const allData = useLiveQuery(async () => {
    const [sessions, runs, activities] = await Promise.all([
      workoutSessions(),
      db.runs.toArray(),
      db.activities.toArray()
    ])
    return { sessions, runs, activities }
  }, [])

  const { weeks, days } = useMemo(() => {
    if (!allData) return { weeks: [] as string[], days: new Map<string, DayData>() }

    const allDates = [
      ...allData.sessions.map((s) => s.date),
      ...allData.runs.map((r) => r.date),
      ...allData.activities.map((a) => a.date)
    ]

    if (allDates.length === 0) return { weeks: [] as string[], days: new Map<string, DayData>() }

    const firstDate = allDates.reduce((a, b) => (a < b ? a : b))
    const firstMonday = localDate(startOfWeek(parseLocalDate(firstDate)))
    const lastMonday = localDate(startOfWeek(parseLocalDate(today)))

    // Collect all Mondays from firstMonday to lastMonday
    const weeks: string[] = []
    let cur = parseLocalDate(firstMonday)
    while (localDate(cur) <= lastMonday) {
      weeks.push(localDate(cur))
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 7)
    }

    // Build per-day data map
    const weightDates = new Set(allData.sessions.map((s) => s.date))
    const runDates = new Set(allData.runs.map((r) => r.date))
    const otherDates = new Set(allData.activities.map((a) => a.date))

    const days = new Map<string, DayData>()

    for (const monday of weeks) {
      for (let i = 0; i < 7; i++) {
        const d = parseLocalDate(monday)
        d.setDate(d.getDate() + i)
        const dateStr = localDate(d)

        // Blank: before first log or in the future
        if (dateStr < firstDate || dateStr > today) {
          days.set(dateStr, { date: dateStr, color: 'blank', hasWeights: false, hasRun: false, hasOther: false })
          continue
        }

        const hasWeights = weightDates.has(dateStr)
        const hasRun = runDates.has(dateStr)
        const hasOther = otherDates.has(dateStr)

        let color: DayColor
        if (!hasWeights && !hasRun && !hasOther) color = 'none'
        else if (hasWeights && hasRun) color = 'both'
        else if (hasWeights) color = 'weights'
        else if (hasRun) color = 'running'
        else color = 'other'

        days.set(dateStr, { date: dateStr, color, hasWeights, hasRun, hasOther })
      }
    }

    return { weeks, days }
  }, [allData, today])

  if (!allData || weeks.length === 0) {
    return <div className="px-1 text-[14px] text-muted py-2">{t('grid.noLog')}</div>
  }

  return (
    <div>
      {/* filter buttons */}
      <div className="mb-3 flex flex-wrap gap-2">
        {(['all', 'weights', 'running', 'other'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`min-h-[44px] whitespace-nowrap rounded-lg px-4 text-[14px] font-semibold ${filter === f ? `${FILTER_BG[f]} text-white` : 'border border-line bg-surface'}`}
          >
            {t(FILTER_KEY[f])}
          </button>
        ))}
      </div>

      {/* weekday labels down the left (one row per weekday), weeks scroll sideways as columns */}
      <div className="flex">
        <div className="w-8 shrink-0" aria-hidden>
          {DAY_KEYS.map((k) => (
            <div key={k} className="flex h-11 items-center text-[11px] text-muted">{t(k)}</div>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto pb-2">
          <div className="flex" style={{ width: `${weeks.length * 44}px` }}>
            {weeks.map((monday) => (
              <div key={monday} className="flex flex-col">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                  const d = parseLocalDate(monday)
                  d.setDate(d.getDate() + i)
                  const dateStr = localDate(d)
                  const data = days.get(dateStr)
                  if (!data) return <div key={i} className="h-11 w-11" />
                  if (data.color === 'blank') return <div key={i} className="h-11 w-11" />
                  const parts = dayParts(data, filter)

                  return (
                    <button
                      key={i}
                      onClick={() => setPopup(data)}
                      aria-label={gridPartsLabel(dateStr, parts, language, t)}
                      className="flex h-11 w-11 items-center justify-center"
                    >
                      <span className={`flex h-7 w-7 overflow-hidden rounded-sm ${parts.length ? '' : 'bg-line'}`}>
                        {parts.map((p) => <span key={p} className={`flex-1 ${PART_BG[p]}`} />)}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* day popup */}
      {popup && (
        <DayPopup
          data={popup}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  )
}

function DayPopup({ data, onClose }: { data: DaySummaryPopup; onClose: () => void }) {
  const t = useT()
  const { language: lang } = useSettings()

  // Load food entries for this day
  const food = useLiveQuery(
    () => db.foodEntries.where('date').equals(data.date).toArray(),
    [data.date]
  )
  const kcal = food?.reduce((s, f) => s + f.kcal, 0) ?? 0
  const protein = food?.reduce((s, f) => s + f.proteinG, 0) ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full rounded-t-2xl border-t border-line bg-bg px-6 pt-6"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[17px] font-semibold">{formatDate(data.date, lang)}</span>
          <button onClick={onClose} className="-mr-3 min-h-[44px] px-3 text-muted text-[14px]">{t('common.close')}</button>
        </div>
        {!data.hasWeights && !data.hasRun && !data.hasOther ? (
          <p className="text-[15px] text-muted">{t('grid.noLog')}</p>
        ) : (
          <div className="space-y-2 text-[15px]">
            {data.hasWeights && <div><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-weights" />{t('grid.weights')}</div>}
            {data.hasRun && <div><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-running" />{t('grid.running')}</div>}
            {data.hasOther && <div><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-other" />{t('more.activities')}</div>}
            {kcal > 0 && <div className="text-muted">{kcal} kcal · {Math.round(protein * 10) / 10} {t('food.gramUnit')} {t('food.protein')}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
