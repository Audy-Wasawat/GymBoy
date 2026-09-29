import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useSettings } from '../db/useSettings'
import { useT } from '../i18n/useT'
import { formatDate, localDate, parseLocalDate, startOfWeek } from '../lib/dates'
import type { StringKey } from '../i18n/strings'

type Filter = 'all' | 'weights' | 'running'
type DayColor = 'weights' | 'running' | 'both' | 'other' | 'none' | 'blank'

interface DayData {
  date: string
  color: DayColor
  hasWeights: boolean
  hasRun: boolean
  hasOther: boolean
}

const DAY_KEYS: StringKey[] = ['grid.mon', 'grid.tue', 'grid.wed', 'grid.thu', 'grid.fri', 'grid.sat', 'grid.sun']

function dayColor(d: DayData, filter: Filter): DayColor {
  if (d.color === 'blank') return 'blank'
  if (filter === 'weights') return d.hasWeights ? 'weights' : 'none'
  if (filter === 'running') return d.hasRun ? 'running' : 'none'
  return d.color
}

function cellBg(color: DayColor): string {
  switch (color) {
    case 'weights': return 'bg-weights'
    case 'running': return 'bg-running'
    case 'other': return 'bg-other'
    case 'none': return 'bg-line'
    case 'blank': return ''
    case 'both': return '' // handled specially
  }
}

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

  const today = localDate()

  const allData = useLiveQuery(async () => {
    const [sessions, runs, activities] = await Promise.all([
      db.sessions.toArray(),
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
      <div className="mb-3 flex gap-2">
        {(['all', 'weights', 'running'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`min-h-[44px] rounded-lg px-4 text-[14px] font-semibold ${filter === f ? (f === 'running' ? 'bg-running text-white' : 'bg-weights text-white') : 'border border-line bg-surface'}`}
          >
            {f === 'all' ? t('grid.all') : f === 'weights' ? t('grid.weights') : t('grid.running')}
          </button>
        ))}
      </div>

      {/* day-of-week row labels */}
      <div className="flex">
        <div className="w-7 shrink-0" />
        <div className="flex gap-0.5 overflow-hidden">
          {DAY_KEYS.map((k) => (
            <div key={k} className="w-7 text-center text-[10px] text-muted">{t(k)}</div>
          ))}
        </div>
      </div>

      {/* grid — scrolls horizontally (weeks = columns, days of week = rows) */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-0.5" style={{ width: `${weeks.length * 30}px` }}>
          {weeks.map((monday) => (
            <div key={monday} className="flex flex-col gap-0.5">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                const d = parseLocalDate(monday)
                d.setDate(d.getDate() + i)
                const dateStr = localDate(d)
                const data = days.get(dateStr)
                if (!data) return <div key={i} className="h-7 w-7" />
                const col = dayColor(data, filter)
                if (col === 'blank') return <div key={i} className="h-7 w-7" />

                return (
                  <button
                    key={i}
                    onClick={() => setPopup(data)}
                    aria-label={`${dateStr}: ${col}`}
                    className={`h-7 w-7 rounded-sm ${col === 'both' ? '' : cellBg(col)} overflow-hidden`}
                    style={col === 'both' ? {} : undefined}
                  >
                    {col === 'both' && (
                      <div className="flex h-full w-full">
                        <div className="flex-1 bg-weights" />
                        <div className="flex-1 bg-running" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
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
      <div className="w-full rounded-t-2xl border-t border-line bg-bg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[17px] font-semibold">{formatDate(data.date, lang)}</span>
          <button onClick={onClose} className="text-muted text-[14px]">{t('common.close')}</button>
        </div>
        {!data.hasWeights && !data.hasRun && !data.hasOther ? (
          <p className="text-[15px] text-muted">{t('grid.noLog')}</p>
        ) : (
          <div className="space-y-2 text-[15px]">
            {data.hasWeights && <div><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-weights" />{t('grid.weights')}</div>}
            {data.hasRun && <div><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-running" />{t('grid.running')}</div>}
            {data.hasOther && <div><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-other" />{t('more.activities')}</div>}
            {kcal > 0 && <div className="text-muted">{kcal} kcal · {Math.round(protein * 10) / 10} g protein</div>}
          </div>
        )}
      </div>
    </div>
  )
}
