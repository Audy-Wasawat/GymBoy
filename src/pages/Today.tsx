import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Dumbbell, Footprints, Plus, UtensilsCrossed } from 'lucide-react'
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

function Stat({ label, value, goal, unit }: { label: string; value: number; goal?: number; unit: string }) {
  return (
    <div className="flex-1 px-4 py-3">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="text-[26px] font-semibold leading-tight">
        {round(value, 1)}
        <span className="text-[15px] font-normal text-muted">{goal ? ` / ${goal}` : ''} {unit}</span>
      </div>
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

      <div className="mb-5 grid grid-cols-3 gap-2">
        <QuickAction to="/weights" icon={Dumbbell} label={t('today.startWeights')} tone="bg-weights" />
        <QuickAction to="/running/new" icon={Footprints} label={t('today.logRun')} tone="bg-running" />
        <QuickAction to={`/food/add?date=${localDate()}`} icon={UtensilsCrossed} label={t('today.addFood')} tone="bg-food" />
      </div>

      <Section title={t('today.done')}>
        {nothing ? (
          <p className="px-4 py-4 text-[15px] text-muted">{t('today.nothingYet')}</p>
        ) : (
          <ul>
            {data?.sessions.map((s) => (
              <li key={`s${s.id}`} className="border-b border-line px-4 py-3 last:border-b-0">
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-weights" aria-hidden />
                {sessionTitle(s, t)}
              </li>
            ))}
            {data?.runs.map((r) => (
              <li key={`r${r.id}`} className="border-b border-line px-4 py-3 last:border-b-0">
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-running" aria-hidden />
                {round(r.distanceKm, 2)} km
              </li>
            ))}
            {data?.activities.map((a) => (
              <li key={`a${a.id}`} className="border-b border-line px-4 py-3 last:border-b-0">
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-other" aria-hidden />
                {a.sport}, {a.minutes} {t('today.minutes')}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {muscles && muscles.primary.length + muscles.secondary.length > 0 && (
        <Section title={t('today.muscles')}>
          <div className="flex justify-center p-4">
            <BodyModel primary={muscles.primary} secondary={muscles.secondary} height={220} />
          </div>
        </Section>
      )}

      <Section title={t('today.food')}>
        <div className="flex divide-x divide-line">
          <Stat label="kcal" value={data?.kcal ?? 0} goal={goals.kcal} unit="" />
          <Stat label={t('today.protein')} value={data?.protein ?? 0} goal={goals.proteinG} unit="g" />
        </div>
      </Section>

      <Section title={t('today.week')}>
        <div className="flex divide-x divide-line">
          <Stat label={t('today.workoutDays')} value={data?.weekDays ?? 0} goal={goals.weeklyDays} unit="" />
          <Stat label={t('today.runDistance')} value={data?.weekKm ?? 0} unit="km" />
        </div>
      </Section>
    </Page>
  )
}

function QuickAction({ to, icon: Icon, label, tone }: {
  to: string; icon: typeof Plus; label: string; tone: string
}) {
  return (
    <Link to={to} className="flex min-h-[84px] flex-col items-start justify-between rounded-xl border border-line bg-surface p-3">
      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${tone} text-white`}>
        <Icon size={17} aria-hidden />
      </span>
      <span className="text-[14px] font-semibold leading-tight">{label}</span>
    </Link>
  )
}
