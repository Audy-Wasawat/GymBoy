import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Dumbbell, Footprints, Plus, Trophy, UtensilsCrossed } from 'lucide-react'
import { BodyModel } from '../components/BodyModel'
import { Page, Section } from '../components/Page'
import { db } from '../db/db'
import type { Muscle } from '../db/types'
import { workoutSessions } from '../db/workoutDays'
import { useSettings } from '../db/useSettings'
import { useT } from '../i18n/useT'
import { localDate, parseLocalDate, startOfWeek } from '../lib/dates'
import { formatHms } from '../components/DurationBoxes'
import { activitySec } from '../db/activities'
import { sessionTitle } from '../lib/sessionTitle'
import { round } from '../lib/units'
import { kcalStatus } from '../lib/kcalGoal'

const addDays = (dateStr: string, n: number) => {
  const d = parseLocalDate(dateStr)
  d.setDate(d.getDate() + n)
  return localDate(d)
}

/** Everything the screen shows for one day (today by default, or a past day picked in the date bar). */
function useDayData(day: string) {
  return useLiveQuery(async () => {
    const weekStart = localDate(startOfWeek(parseLocalDate(day)))
    const weekEnd = addDays(weekStart, 6)
    const [sessions, runs, activities, food, weekSessions, weekRuns, weekActivities] = await Promise.all([
      workoutSessions(day, day),
      db.runs.where('date').equals(day).toArray(),
      db.activities.where('date').equals(day).toArray(),
      db.foodEntries.where('date').equals(day).toArray(),
      workoutSessions(weekStart, weekEnd),
      db.runs.where('date').between(weekStart, weekEnd, true, true).toArray(),
      db.activities.where('date').between(weekStart, weekEnd, true, true).toArray()
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
  }, [day])
}

/**
 * Muscles of every exercise with at least one saved working set today, including exercises added
 * to a session on the spot. Drafts and warm-up-only exercises do not count. Primary wins over secondary.
 */
function useDayMuscles(day: string) {
  return useLiveQuery(async () => {
    const sets = await db.sets.where('date').equals(day).filter((s) => s.type === 'working').toArray()
    const exs = await db.exercises.bulkGet([...new Set(sets.map((s) => s.exerciseId))])
    const primary = new Set<Muscle>()
    const secondary = new Set<Muscle>()
    for (const e of exs) {
      e?.primaryMuscles.forEach((m) => primary.add(m))
      e?.secondaryMuscles.forEach((m) => secondary.add(m))
    }
    return { primary: [...primary], secondary: [...secondary].filter((m) => !primary.has(m)) }
  }, [day])
}

function Meter({ label, value, goal, unit, tone }: { label: string; value: number; goal?: number; unit: string; tone: string }) {
  const pct = goal ? Math.min(100, (value / goal) * 100) : 0
  return (
    <div className="min-w-0 flex-1 px-4 py-3.5">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-1">
        <span className="stat-num">{round(value, 1)}</span>
        <span className="whitespace-nowrap text-[14px] text-muted">{goal ? `/ ${goal}` : ''} {unit}</span>
      </div>
      {goal ? (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-raised" aria-hidden>
          <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  )
}

/** Calories against a floor and/or ceiling: the bar fills toward the ceiling (or the floor), with a tick at the floor. */
function KcalMeter({ value, min, max }: { value: number; min?: number; max?: number }) {
  const t = useT()
  const status = kcalStatus(value, min, max)
  const scale = max ?? min
  const pct = scale ? Math.min(100, (value / scale) * 100) : 0
  const tone = status.state === 'over' ? 'bg-weights' : 'bg-food'
  const note =
    status.state === 'below' ? t('kcal.toMin').replace('{n}', String(status.toMin))
    : status.state === 'in' ? (status.room !== undefined ? t('kcal.room').replace('{n}', String(status.room)) : t('kcal.inRange'))
    : status.state === 'over' ? t('kcal.over').replace('{n}', String(status.over))
    : ''
  const goalText = min && max ? `${min}–${max}` : min ? `≥ ${min}` : max ? `≤ ${max}` : ''
  return (
    <div className="min-w-0 flex-1 px-4 py-3.5">
      <div className="text-[13px] text-muted">kcal</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-1">
        <span className={`stat-num ${status.state === 'over' ? 'text-weights' : ''}`}>{round(value, 1)}</span>
        {goalText && <span className="whitespace-nowrap text-[13px] text-muted">/ {goalText}</span>}
      </div>
      {scale ? (
        <div className="relative mt-2.5 h-1.5 rounded-full bg-raised" aria-hidden>
          <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
          {min && max ? <span className="absolute -top-0.5 h-2.5 w-0.5 rounded bg-ink/50" style={{ left: `${(min / max) * 100}%` }} /> : null}
        </div>
      ) : null}
      {note && <div className={`mt-1.5 text-[12px] ${status.state === 'over' ? 'font-semibold text-weights' : status.state === 'in' ? 'text-food' : 'text-muted'}`}>{note}</div>}
    </div>
  )
}

/** Monday-to-Sunday strip; a filled dot is a day with any workout, run or activity. */
function WeekStrip({ weekStart, active, selected, language }: { weekStart: string; active: string[]; selected: string; language: string }) {
  const [y, m, d] = weekStart.split('-').map(Number)
  const days = Array.from({ length: 7 }, (_, i) => new Date(y, m - 1, d + i))
  return (
    <div className="mt-4 grid grid-cols-7 gap-1.5" aria-hidden>
      {days.map((day) => {
        const key = localDate(day)
        const on = active.includes(key)
        const isSel = key === selected
        return (
          <div key={key} className="flex flex-col items-center gap-1.5">
            <span className={`text-[11px] ${isSel ? 'font-bold text-ink' : 'text-muted'}`}>
              {day.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-GB', { weekday: 'narrow' })}
            </span>
            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold ${
              on ? 'bg-weights text-white' : isSel ? 'border-2 border-weights/60 text-ink' : 'bg-raised text-muted'
            } ${on && isSel ? 'ring-2 ring-weights/50 ring-offset-2 ring-offset-surface' : ''}`}>
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
  const today = localDate()
  const [day, setDay] = useState(today)
  const isToday = day === today
  // Leaving the app (or locking the phone) and coming back always lands on today again,
  // so a past day picked to show someone is never left on by mistake.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') setDay(localDate()) }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onVisible)
    }
  }, [])
  const data = useDayData(day)
  const muscles = useDayMuscles(day)
  // Title: "Today", "Yesterday", then the weekday name. The date bar keeps the weekday only for
  // today and yesterday, since further back the title already names it.
  const isYesterday = day === addDays(today, -1)
  const locale = language === 'th' ? 'th-TH-u-ca-gregory' : 'en-GB'
  const recent = isToday || isYesterday
  const title = isToday ? t('today.title') : isYesterday ? t('today.yesterday') : parseLocalDate(day).toLocaleDateString(locale, { weekday: 'long' })
  const dateLabel = parseLocalDate(day).toLocaleDateString(locale, {
    ...(recent ? { weekday: 'long' } : {}), day: 'numeric', month: 'long', ...(day.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' })
  })
  const thisWeek = data?.weekStart === localDate(startOfWeek())
  const nothing = data && data.sessions.length + data.runs.length + data.activities.length === 0

  return (
    <Page title={title}>
      {/* day picker: today by default, any past day to look back at */}
      <div className="-mt-1 mb-5 flex items-center gap-1 rounded-xl border border-line bg-surface px-1 py-1">
        <button onClick={() => setDay(addDays(day, -1))} className="flex h-11 w-11 shrink-0 items-center justify-center" aria-label={t('food.prevDay')}>
          <ChevronLeft size={20} aria-hidden />
        </button>
        <label className="relative flex min-h-[44px] min-w-0 flex-1 cursor-pointer flex-col items-center justify-center text-center">
          <span className="max-w-full truncate text-[15px] font-semibold">{dateLabel}</span>
          <input
            type="date"
            value={day}
            max={today}
            onChange={(e) => { if (e.target.value && e.target.value <= today) setDay(e.target.value) }}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={t('food.jumpToDate')}
          />
        </label>
        {!isToday && (
          <button onClick={() => setDay(today)} className="min-h-[44px] shrink-0 rounded-lg bg-raised px-3 text-[13px] font-semibold">
            {t('today.title')}
          </button>
        )}
        <button
          onClick={() => { if (!isToday) setDay(addDays(day, 1)) }}
          disabled={isToday}
          className="flex h-11 w-11 shrink-0 items-center justify-center disabled:opacity-30"
          aria-label={t('food.nextDay')}
        >
          <ChevronRight size={20} aria-hidden />
        </button>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2.5">
        <QuickAction to="/weights" icon={Dumbbell} label={t('today.startWeights')} tone="bg-weights" />
        <QuickAction to={isToday ? '/running/new' : `/running/new?date=${day}`} icon={Footprints} label={t('today.logRun')} tone="bg-running" />
        <QuickAction to={`/food/add?date=${day}`} icon={UtensilsCrossed} label={t('today.addFood')} tone="bg-food" />
      </div>

      <section className="mb-5 overflow-hidden rounded-2xl border border-line bg-surface p-4">
        <h2 className="eyebrow">{thisWeek ? t('today.week') : t('today.weekPast')}</h2>
        <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1">
              <span className="text-[40px] font-bold leading-none tracking-tight">{data?.weekDays ?? 0}</span>
              {goals.weeklyDays ? <span className="text-[17px] font-semibold text-muted">/ {goals.weeklyDays}</span> : null}
            </div>
            <div className="mt-1 text-[13px] text-muted">{t('today.workoutDays')}</div>
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1">
              <span className="text-[40px] font-bold leading-none tracking-tight text-running">{round(data?.weekKm ?? 0, 1)}</span>
              <span className="text-[17px] font-semibold text-muted">km</span>
            </div>
            <div className="mt-1 text-[13px] text-muted">{t('today.runDistance')}</div>
          </div>
        </div>
        {data && <WeekStrip weekStart={data.weekStart} active={data.activeDays} selected={day} language={language} />}
      </section>

      <Section title={isToday ? t('today.food') : t('today.foodPast')}>
        <div className="flex divide-x divide-line">
          <KcalMeter value={data?.kcal ?? 0} min={goals.kcal} max={goals.kcalMax} />
          <Meter label={t('today.protein')} value={data?.protein ?? 0} goal={goals.proteinG} unit={t('food.gramUnit')} tone="bg-food" />
        </div>
      </Section>

      <Section title={isToday ? t('today.done') : t('today.donePast')}>
        {nothing ? (
          <p className="px-4 py-4 text-[15px] text-muted">{isToday ? t('today.nothingYet') : t('today.nothingPast')}</p>
        ) : (
          <ul>
            {data?.sessions.map((s) => (
              <DoneRow key={`s${s.id}`} icon={Dumbbell} tone="bg-weights/15 text-weights">{sessionTitle(s, t)}</DoneRow>
            ))}
            {data?.runs.map((r) => (
              <DoneRow key={`r${r.id}`} icon={Footprints} tone="bg-running/15 text-running">{round(r.distanceKm, 2)} km</DoneRow>
            ))}
            {data?.activities.map((a) => (
              <DoneRow key={`a${a.id}`} icon={Trophy} tone="bg-other/15 text-other">{a.sport}, {formatHms(activitySec(a), t)}</DoneRow>
            ))}
          </ul>
        )}
      </Section>

      {muscles && muscles.primary.length + muscles.secondary.length > 0 && (
        <Section title={isToday ? t('today.muscles') : t('today.musclesPast')}>
          <div className="flex justify-center px-4 py-5">
            <BodyModel primary={muscles.primary} secondary={muscles.secondary} height={250} />
          </div>
        </Section>
      )}
    </Page>
  )
}

function DoneRow({ icon: Icon, tone, children }: { icon: typeof Plus; tone: string; children: ReactNode }) {
  return (
    <li className="flex min-h-[56px] items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon size={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 break-words text-[16px] font-medium">{children}</span>
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
