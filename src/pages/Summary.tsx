import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Page, Section } from '../components/Page'
import { ActivityGrid } from '../components/ActivityGrid'
import { db } from '../db/db'
import { workoutSessions } from '../db/workoutDays'
import { useSettings } from '../db/useSettings'
import { useT } from '../i18n/useT'
import { formatDate, localDate, parseLocalDate } from '../lib/dates'
import { addMonths, monthEnd, monthStart, weeksInMonth, yearMonth } from '../lib/summary'
import { round } from '../lib/units'

function monthLabel(year: number, month: number, lang: 'th' | 'en') {
  return parseLocalDate(`${year}-${String(month).padStart(2, '0')}-15`)
    .toLocaleDateString(lang === 'th' ? 'th-TH-u-ca-gregory' : 'en-GB', { month: 'long', year: 'numeric' })
}

export function Summary() {
  const t = useT()
  const { language, goals } = useSettings()
  const today = localDate()
  const { year: initY, month: initM } = yearMonth(today)
  const [year, setYear] = useState(initY)
  const [month, setMonth] = useState(initM)

  const isCurrentMonth = year === initY && month === initM

  const from = monthStart(year, month)
  const to = monthEnd(year, month)

  const data = useLiveQuery(async () => {
    const [sessions, runs, activities, foodEntries] = await Promise.all([
      workoutSessions(from, to),
      db.runs.where('date').between(from, to, true, true).toArray(),
      db.activities.where('date').between(from, to, true, true).toArray(),
      db.foodEntries.where('date').between(from, to, true, true).toArray()
    ])

    const activeDays = new Set([
      ...sessions.map((s) => s.date),
      ...runs.map((r) => r.date),
      ...activities.map((a) => a.date)
    ])
    const workoutDays = activeDays.size

    const monthKm = runs.reduce((s, r) => s + r.distanceKm, 0)

    // Weekly running distances
    const weeks = weeksInMonth(year, month)
    const weekKm: { week: string; km: number }[] = weeks.map((monday) => {
      const sunday = localDate(new Date(parseLocalDate(monday).getTime() + 6 * 86400000))
      const km = runs.filter((r) => r.date >= monday && r.date <= sunday)
        .reduce((s, r) => s + r.distanceKm, 0)
      return { week: monday, km }
    })

    // Food: average per day with at least one entry
    const foodByDay = new Map<string, { kcal: number; protein: number }>()
    for (const e of foodEntries) {
      const d = foodByDay.get(e.date) ?? { kcal: 0, protein: 0 }
      d.kcal += e.kcal
      d.protein += e.proteinG
      foodByDay.set(e.date, d)
    }
    const foodDays = foodByDay.size
    const avgKcal = foodDays ? Array.from(foodByDay.values()).reduce((s, v) => s + v.kcal, 0) / foodDays : undefined
    const avgProtein = foodDays ? Array.from(foodByDay.values()).reduce((s, v) => s + v.protein, 0) / foodDays : undefined

    // Current week workout days (for weekly goal progress bar)
    const now = new Date()
    const weekStart = localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)))
    const weekSessions = await workoutSessions(weekStart)
    const weekRuns = await db.runs.where('date').aboveOrEqual(weekStart).toArray()
    const weekActivities = await db.activities.where('date').aboveOrEqual(weekStart).toArray()
    const weekDays = new Set([...weekSessions, ...weekRuns, ...weekActivities].map((x) => x.date)).size

    return { workoutDays, monthKm, weekKm, avgKcal, avgProtein, foodDays, weekDays }
  }, [from, to, year, month])

  function nav(delta: number) {
    const nm = addMonths(year, month, delta)
    setYear(nm.year)
    setMonth(nm.month)
  }

  return (
    <Page title={t('more.summary')} back="/more">
      {/* month nav */}
      <div className="mb-5 flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2">
        <button onClick={() => nav(-1)} className="flex h-10 w-10 items-center justify-center" aria-label={t('sum.prevMonth')}>
          <ChevronLeft size={20} aria-hidden />
        </button>
        <span className="text-[15px] font-semibold">{monthLabel(year, month, language)}</span>
        <button onClick={() => { if (!isCurrentMonth) nav(1) }} disabled={isCurrentMonth} className="flex h-10 w-10 items-center justify-center disabled:opacity-30" aria-label={t('sum.nextMonth')}>
          <ChevronRight size={20} aria-hidden />
        </button>
      </div>

      {!data ? null : (
        <>
          <Section title={t('sum.workoutDays')}>
            <div className="px-4 py-3">
              <div className="text-[32px] font-semibold">{data.workoutDays}</div>
              {goals.weeklyDays && isCurrentMonth && (
                <div className="mt-2 text-[13px] text-muted">
                  {t('sum.weekGoal')}: {data.weekDays} / {goals.weeklyDays}
                  <div className="mt-1 h-2 w-full rounded-full bg-line">
                    <div
                      className="h-2 rounded-full bg-weights"
                      style={{ width: `${Math.min(100, (data.weekDays / goals.weeklyDays) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </Section>

          <Section title={`${t('sum.runMonth')}: ${round(data.monthKm, 1)} km`}>
            {data.weekKm.filter((w) => w.km > 0).length === 0 ? (
              <div className="px-4 py-3 text-[14px] text-muted">{t('sum.noData')}</div>
            ) : (
              <div className="divide-y divide-line">
                {data.weekKm.map(({ week, km }) =>
                  km > 0 ? (
                    <div key={week} className="flex items-center justify-between px-4 py-2">
                      <span className="text-[14px] text-muted">{formatDate(week, language, false)}</span>
                      <span className="text-[15px] font-semibold">{round(km, 1)} {t('sum.monthKm')}</span>
                    </div>
                  ) : null
                )}
              </div>
            )}
          </Section>

          {data.avgKcal !== undefined && (
            <Section title={t('sum.avgKcal')}>
              <div className="px-4 py-3">
                <div className="text-[28px] font-semibold">{Math.round(data.avgKcal)}</div>
                <div className="text-[13px] text-muted">kcal · {t('sum.noFood')}</div>
              </div>
            </Section>
          )}

          {data.avgProtein !== undefined && (
            <Section title={t('sum.avgProtein')}>
              <div className="px-4 py-3">
                <div className="text-[28px] font-semibold">{round(data.avgProtein, 1)}</div>
                <div className="text-[13px] text-muted">g protein · {t('sum.noFood')}</div>
              </div>
            </Section>
          )}
        </>
      )}

      <Section title={t('grid.title')}>
        <div className="px-4 py-3">
          <ActivityGrid />
        </div>
      </Section>
    </Page>
  )
}
