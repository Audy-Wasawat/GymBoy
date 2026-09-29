import { lazy, Suspense } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Trophy } from 'lucide-react'
import { Page } from '../../components/Page'
import { db } from '../../db/db'
import type { WeightUnit } from '../../db/types'
import { useSettings } from '../../db/useSettings'
import { useT } from '../../i18n/useT'
import { formatDate } from '../../lib/dates'
import { formatDuration } from '../../lib/numbers'
import { loadProgress, weightHint, type MetricKind } from '../../lib/progress'
import { sessionTitle } from '../../lib/sessionTitle'
import { setSummary } from '../../lib/setFormat'
import { toDisplayWeight } from '../../lib/units'
import { HintNote } from './HintNote'

const ProgressChart = lazy(() => import('../../components/ProgressChart'))

export function ExerciseHistory() {
  const t = useT()
  const { language, weightUnit } = useSettings()
  const id = Number(useParams().id)
  // Opened from a session card, back returns to that session.
  const from = (useLocation().state as { from?: string } | null)?.from
  const data = useLiveQuery(async () => {
    const ex = await db.exercises.get(id)
    return ex ? { ex, progress: (await loadProgress(id))! } : null
  }, [id])

  if (data === undefined) return null
  if (data === null) return <Page title={t('ex.notFound')} back="/weights/exercises">{null}</Page>
  const { ex, progress } = data
  const { kind, entries, prIds, best, points, skipped } = progress
  const format = (v: number) => formatMetric(kind, v, weightUnit, t('set.reps'), t('set.sec'))
  // The hint looks at the latest finished session, as it would when the next session starts.
  const last = [...entries].reverse().find((e) => e.session.finishedAt)
  const hint = last && weightHint({ se: last.se, sets: last.working }, [])

  return (
    <Page title={ex.name} back={from ?? `/weights/exercises/${id}`}>
      <div className="mb-4 rounded-xl border border-line bg-surface p-4">
        <div className="mb-1 flex items-center gap-1.5 text-[13px] text-muted">
          <Trophy size={15} className="text-weights" aria-hidden />
          {t('pr.current')}
        </div>
        {best ? (
          <>
            <div className="text-[28px] font-semibold leading-tight">{format(best.value)}</div>
            <div className="text-[13px] text-muted">{formatDate(best.entry.session.date, language)}</div>
          </>
        ) : (
          <div className="text-[15px] text-muted">{t('pr.none')}</div>
        )}
        {hint && <div className="mt-3"><HintNote hint={hint} unit={weightUnit} /></div>}
      </div>

      <section className="mb-5">
        <h2 className="mb-2 text-[15px] font-semibold text-muted">{t(`chart.${kind}`)}</h2>
        <div className="rounded-xl border border-line bg-surface p-3">
          {points.length >= 2 ? (
            <Suspense fallback={<div className="h-56" />}>
              <ProgressChart
                label={`${t(`chart.${kind}`)}: ${points.map((p) => `${p.entry.session.date} ${format(p.value)}`).join(', ')}`}
                format={(v) => (kind === 'weight' || kind === 'added' ? `${v} ${weightUnit}` : format(v))}
                points={points.map((p) => ({
                  label: formatDate(p.entry.session.date, language, false),
                  full: formatDate(p.entry.session.date, language),
                  value: kind === 'weight' || kind === 'added' ? toDisplayWeight(p.value, weightUnit) : p.value
                }))}
              />
            </Suspense>
          ) : (
            <p className="px-1 py-6 text-center text-[15px] text-muted">{t('chart.tooFew')}</p>
          )}
          {skipped > 0 && <p className="mt-2 px-1 text-[13px] text-muted">{t('chart.skipped').replace('{n}', String(skipped))}</p>}
        </div>
      </section>

      <h2 className="mb-2 text-[15px] font-semibold text-muted">{t('history.sessions')}</h2>
      {entries.length === 0 && <p className="px-1 text-[15px] text-muted">{t('history.noSessions')}</p>}
      <ul className="mb-8 rounded-xl border border-line bg-surface empty:hidden">
        {[...entries].reverse().map(({ session, se, working }) => (
          <li key={se.id} className="border-b border-line last:border-b-0">
            <Link to={session.finishedAt ? `/weights/history/${session.id}` : '/weights/session'} className="block px-4 py-3">
              <span className="block text-[13px] text-muted">
                {formatDate(session.date, language)} · {sessionTitle(session, t)}{session.finishedAt ? '' : ` · ${t('history.inProgress')}`}
              </span>
              <span className="mt-1 flex flex-wrap gap-1.5">
                {working.map((s) => (
                  <span
                    key={s.id}
                    className={`rounded-md px-2 py-0.5 text-[14px] ${prIds.has(s.id!) ? 'bg-weights font-semibold text-white' : 'bg-bg'}`}
                  >
                    {setSummary(s, se, weightUnit)}{prIds.has(s.id!) ? ' PR' : ''}
                  </span>
                ))}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  )
}

/** A PR/chart value for display: weight in the chosen unit, reps, or a duration. */
function formatMetric(kind: MetricKind, v: number, unit: WeightUnit, reps: string, sec: string) {
  if (kind === 'weight') return `${toDisplayWeight(v, unit)} ${unit}`
  if (kind === 'added') return `+${toDisplayWeight(v, unit)} ${unit}`
  if (kind === 'reps') return `${v} ${reps}`
  return v < 60 ? `${v} ${sec}` : formatDuration(v)
}
