import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart3, ChevronRight, Footprints, ListChecks, Plus } from 'lucide-react'
import { Page, Section } from '../../components/Page'
import { db } from '../../db/db'
import { listRuns } from '../../db/runs'
import { useSettings } from '../../db/useSettings'
import { useT } from '../../i18n/useT'
import { formatDate } from '../../lib/dates'
import { chartPace } from '../../lib/running'
import { formatPace, round } from '../../lib/units'

const TYPE_KEY = { easy: 'run.typeEasy', lsd: 'run.typeLsd', tempo: 'run.typeTempo', interval: 'run.typeInterval' } as const

export function Running() {
  const t = useT()
  const { language } = useSettings()
  const runs = useLiveQuery(listRuns, [])
  const shoes = useLiveQuery(() => db.shoes.toArray(), [])
  const shoeName = (id?: number) => shoes?.find((s) => s.id === id)?.name

  return (
    <Page title={t('running.title')}>
      <Link to="/running/new" className="mb-5 flex min-h-[64px] w-full items-center justify-center gap-2 rounded-xl bg-running text-[17px] font-semibold text-white">
        <Plus size={20} aria-hidden />
        {t('run.add')}
      </Link>

      <Section>
        <Link to="/running/charts" className="flex min-h-[60px] items-center gap-3 border-b border-line px-4 py-2">
          <BarChart3 size={22} className="text-running" aria-hidden />
          <span className="flex-1">
            <span className="block text-[16px]">{t('run.charts')}</span>
            <span className="block text-[13px] text-muted">{t('run.chartsNote')}</span>
          </span>
          <ChevronRight size={18} className="text-muted" aria-hidden />
        </Link>
        <Link to="/running/templates" className="flex min-h-[60px] items-center gap-3 border-b border-line px-4 py-2">
          <ListChecks size={22} className="text-running" aria-hidden />
          <span className="flex-1">
            <span className="block text-[16px]">{t('run.templates')}</span>
            <span className="block text-[13px] text-muted">{t('run.templatesNote')}</span>
          </span>
          <ChevronRight size={18} className="text-muted" aria-hidden />
        </Link>
        <Link to="/more/shoes" className="flex min-h-[60px] items-center gap-3 px-4 py-2">
          <Footprints size={22} className="text-running" aria-hidden />
          <span className="flex-1">
            <span className="block text-[16px]">{t('run.shoesLink')}</span>
            <span className="block text-[13px] text-muted">{t('run.shoesNote')}</span>
          </span>
          <ChevronRight size={18} className="text-muted" aria-hidden />
        </Link>
      </Section>

      {runs && runs.length === 0 ? (
        <p className="px-1 py-4 text-[15px] text-muted">{t('run.empty')}</p>
      ) : (
        <ul className="rounded-xl border border-line bg-surface empty:hidden">
          {runs?.map((r) => {
            const pace = chartPace(r)
            return (
              <li key={r.id} className="border-b border-line last:border-b-0">
                <Link to={`/running/${r.id}`} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex-1">
                    <span className="block text-[16px]">
                      {round(r.distanceKm, 2)} km
                      <span className="text-muted"> · {t(TYPE_KEY[r.type])}</span>
                    </span>
                    <span className="block text-[13px] text-muted">
                      {formatDate(r.date, language)}
                      {pace ? ` · ${formatPace(pace)} ${t('run.paceUnit')}` : ''}
                      {shoeName(r.shoeId) ? ` · ${shoeName(r.shoeId)}` : ''}
                    </span>
                  </span>
                  <ChevronRight size={18} className="text-muted" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Page>
  )
}
