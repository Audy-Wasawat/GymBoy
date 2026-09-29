import { lazy, Suspense, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Page } from '../../components/Page'
import { Chip } from '../../components/Chip'
import type { ChartPoint } from '../../components/ProgressChart'
import { listRuns } from '../../db/runs'
import type { RunType } from '../../db/types'
import { useSettings } from '../../db/useSettings'
import { useT } from '../../i18n/useT'
import { formatDate } from '../../lib/dates'
import { chartPace, monthlyDistances, RUN_TYPES, weeklyDistances } from '../../lib/running'
import { formatPace } from '../../lib/units'
import type { StringKey } from '../../i18n/strings'

const RunChartsView = lazy(() => import('../../components/RunChartsView'))

const TYPE_KEY: Record<RunType, StringKey> = {
  easy: 'run.typeEasy', lsd: 'run.typeLsd', tempo: 'run.typeTempo', interval: 'run.typeInterval'
}

export function RunCharts() {
  const t = useT()
  const { language } = useSettings()
  const runs = useLiveQuery(listRuns, [])
  const [filter, setFilter] = useState<RunType | 'all'>('all')

  if (!runs) return <Page title={t('run.charts')} back="/running">{null}</Page>

  const paceRuns = runs.filter((r) => filter === 'all' || r.type === filter)
  const pace: ChartPoint[] = paceRuns
    .map((r) => ({ r, p: chartPace(r) }))
    .filter((x): x is { r: typeof x.r; p: number } => x.p !== undefined)
    .sort((a, b) => a.r.date.localeCompare(b.r.date))
    .map(({ r, p }) => ({ label: formatDate(r.date, language, false), full: formatDate(r.date, language), value: p }))

  const weekly: ChartPoint[] = weeklyDistances(runs, 12).map((b) => ({ label: b.label, full: b.start, value: b.km }))
  const monthly: ChartPoint[] = monthlyDistances(runs, 12).map((b) => ({ label: b.label, full: b.start, value: b.km }))
  const hasData = runs.length > 0

  return (
    <Page title={t('run.charts')} back="/running">
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>{t('run.chartAll')}</Chip>
        {RUN_TYPES.map((rt) => (
          <Chip key={rt} selected={filter === rt} onClick={() => setFilter(rt)}>{t(TYPE_KEY[rt])}</Chip>
        ))}
      </div>

      <h2 className="mb-2 text-[15px] font-semibold text-muted">{t('run.chartPace')}</h2>
      <div className="mb-6 rounded-xl border border-line bg-surface p-3">
        {hasData ? (
          <Suspense fallback={<div className="h-56" />}>
            <RunChartsView
              pace={pace}
              weekly={weekly}
              monthly={monthly}
              formatPaceValue={(v) => formatPace(v)}
              paceLabel={`${t('run.chartPace')}: ${pace.map((p) => `${p.full} ${formatPace(p.value)}`).join(', ')}`}
              weeklyLabel={t('run.chartWeekly')}
              monthlyLabel={t('run.chartMonthly')}
            />
          </Suspense>
        ) : (
          <p className="px-1 py-6 text-center text-[15px] text-muted">{t('run.chartTooFew')}</p>
        )}
        {hasData && pace.length < 2 && (
          <p className="mt-2 px-1 text-[13px] text-muted">{t('run.chartTooFew')}</p>
        )}
      </div>
    </Page>
  )
}
