import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import type { ReactNode } from 'react'
import { Dumbbell, Footprints, Plus, Trophy, UtensilsCrossed } from 'lucide-react'
import { BodyModel } from '../components/BodyModel'
import { Page, Section } from '../components/Page'
import { db } from '../db/db'
import type { Muscle } from '../db/types'
import { workoutSessions } from '../db/workoutDays'
import { useSettings } from '../db/useSettings'
import { useT } from '../i18n/useT'
import { localDate, startOfWeek } from '../lib/dates'
import { sessionTitle } from '../lib/sessionTitle'
import { round } from '../lib/units'

function useTodayData() {
  return useLiveQuery(async () => {
    const today = localDate()
    const weekStart = localDate(startOfWeek())
    const [sessions, runs, activities, food, weekSessions, weekRuns, weekActivities] = await Promise.all([
      workoutSessions(today, today),
      db.runs.where('date').equals(today).toArray(),
      db.activities.where('date').equals(today).toArray(),
      db.foodEntries.where('date').equals(today).toArray(),
      workoutSessions(weekStart),
      db.runs.where('date').aboveOrEqual(weekStart).toArray(),
      db.activities.where('date').aboveOrEqual(weekStart).toArray()
    ])
    const activeDays = new Set([...weekSessions, ...weekRuns, ...weekActivities].map((x) => x.date))
    return {
      sessions, runs, activities,
      kcal: food.reduce((s, f) => s + f.kcal, 0),
      protein: food.reduce((s, f) => s + f.proteinG, 0),
      weekDays: activeDays.size,
      activeDays: [...activeDays],
      weekStart,
      weekKm: weekRuns.reduce((s, r) => s + r.distanceKm, 0)
    }
  }, [])
}

/**
 * Muscles of every exercise with at least one saved working set today, including exercises added
 * to a session on the spot. Drafts and warm-up-only exercises do not count. Primary wins over secondary.
 */
function useTodayMuscles() {
  return useLiveQuery(async () => {
    const sets = await db.sets.where('date').equals(localDate()).filter((s) => s.type === 'working').toArray()
    const exs = await db.exercises.bulkGet([...new Set(sets.map((s) => s.exerciseId))])
    const primary = new Set<Muscle>()
    const secondary = new Set<Muscle>()
    for (const e of exs) {
      e?.primaryMuscles.forEach((m) => primary.add(m))
      e?.secondaryMuscles.forEach((m) => secondary.add(m))
    }
    return { primary: [...primary], secondary: [...secondary].filter((m) => !primary.has(m)) }
  }, [])
}

function Meter({ label, value, goal, unit, tone }: { label: string; value: number; goal?: number; unit: string; tone: string }) {
  const pct = goal ? Math.min(100, (value / goal) * 100) : 0
  return (
    <div className="flex-1 px-4 py-3.5">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="stat-num">{round(value, 1)}</span>
        <span className="text-[14px] text-muted">{goal ? `/ ${goal}` : ''} {unit}</span>
      </div>
      {goal ? (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-raised" aria-hidden>
          <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  )
}

/** Monday-to-Sunday strip; a filled dot is a day with any workout, run or activity. */
function WeekStrip({ weekStart, active, language }: { weekStart: string; active: string[]; language: string }) {
  const today = localDate()
  const [y, m, d] = weekStart.split('-').map(Number)
  const days = Array.from({ length: 7 }, (_, i) => new Date(y, m - 1, d + i))
  return (
    <div className="mt-4 grid grid-cols-7 gap-1.5" aria-hidden>
      {days.map((day) => {
        const key = localDate(day)
        const on = active.includes(key)
        const isToday = key === today
        return (
          <div key={key} className="flex flex-col items-center gap-1.5">
            <span className={`text-[11px] ${isToday ? 'font-bold text-ink' : 'text-muted'}`}>
              {day.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-GB', { weekday: 'narrow' })}
            </span>
            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold ${
              on ? 'bg-weights text-white' : isToday ? 'border-2 border-weights/60 text-ink' : 'bg-raised text-muted'
            }`}>
              {day.getDate()}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function Today() {
  const t = useT()
  const { goals, language } = useSettings()
  const data = useTodayData()
  const muscles = useTodayMuscles()
  const dateLabel = new Date().toLocaleDateString(language === 'th' ? 'th-TH-u-ca-gregory' : 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'long'
  })
  const nothing = data && data.sessions.length + data.runs.length + data.activities.length === 0

  return (
    <Page title={t('today.title')}>
      <p className="-mt-3 mb-5 text-[15px] text-muted">{dateLabel}</p>

      <div className="mb-5 grid grid-cols-3 gap-2.5">
        <QuickAction to="/weights" icon={Dumbbell} label={t('today.startWeights')} tone="bg-weights" />
        <QuickAction to="/running/new" icon={Footprints} label={t('today.logRun')} tone="bg-running" />
        <QuickAction to={`/food/add?date=${localDate()}`} icon={UtensilsCrossed} label={t('today.addFood')} tone="bg-food" />
      </div>

      <section className="mb-5 overflow-hidden rounded-2xl border border-line bg-surface p-4">
        <h2 className="eyebrow">{t('today.week')}</h2>
        <div className="mt-2 flex items-end gap-6">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-[40px] font-bold leading-none tracking-tight">{data?.weekDays ?? 0}</span>
              {goals.weeklyDays ? <span className="text-[17px] font-semibold text-muted">/ {goals.weeklyDays}</span> : null}
            </div>
            <div className="mt-1 text-[13px] text-muted">{t('today.workoutDays')}</div>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-[40px] font-bold leading-none tracking-tight text-running">{round(data?.weekKm ?? 0, 1)}</span>
              <span className="text-[17px] font-semibold text-muted">km</span>
            </div>
            <div className="mt-1 text-[13px] text-muted">{t('today.runDistance')}</div>
          </div>
        </div>
        {data && <WeekStrip weekStart={data.weekStart} active={data.activeDays} language={language} />}
      </section>

      <Section title={t('today.done')}>
        {nothing ? (
          <p className="px-4 py-4 text-[15px] text-muted">{t('today.nothingYet')}</p>
        ) : (
          <ul>
            {data?.sessions.map((s) => (
              <DoneRow key={`s${s.id}`} icon={Dumbbell} tone="bg-weights/15 text-weights">{sessionTitle(s, t)}</DoneRow>
            ))}
            {data?.runs.map((r) => (
              <DoneRow key={`r${r.id}`} icon={Footprints} tone="bg-running/15 text-running">{round(r.distanceKm, 2)} km</DoneRow>
            ))}
            {data?.activities.map((a) => (
              <DoneRow key={`a${a.id}`} icon={Trophy} tone="bg-other/15 text-other">{a.sport}, {a.minutes} {t('today.minutes')}</DoneRow>
            ))}
          </ul>
        )}
      </Section>

      {muscles && muscles.primary.length + muscles.secondary.length > 0 && (
        <Section title={t('today.muscles')}>
          <div className="flex justify-center px-4 py-5">
            <BodyModel primary={muscles.primary} secondary={muscles.secondary} height={250} />
          </div>
        </Section>
      )}

      <Section title={t('today.food')}>
        <div className="flex divide-x divide-line">
          <Meter label="kcal" value={data?.kcal ?? 0} goal={goals.kcal} unit="" tone="bg-food" />
          <Meter label={t('today.protein')} value={data?.protein ?? 0} goal={goals.proteinG} unit={t('food.gramUnit')} tone="bg-food" />
        </div>
      </Section>
    </Page>
  )
}

function DoneRow({ icon: Icon, tone, children }: { icon: typeof Plus; tone: string; children: ReactNode }) {
  return (
    <li className="flex min-h-[56px] items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon size={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-[16px] font-medium">{children}</span>
    </li>
  )
}

function QuickAction({ to, icon: Icon, label, tone }: {
  to: string; icon: typeof Plus; label: string; tone: string
}) {
  return (
    <Link to={to} className={`relative flex min-h-[96px] flex-col items-start justify-between overflow-hidden rounded-2xl p-3 text-white ${tone}`}>
      <span className="pointer-events-none absolute -right-5 -top-5 h-20 w-20 rounded-full bg-white/15" aria-hidden />
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
        <Icon size={18} strokeWidth={2.3} aria-hidden />
      </span>
      <span className="text-[14px] font-bold leading-tight">{label}</span>
    </Link>
  )
}
