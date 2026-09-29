import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, History as HistoryIcon, Library, ListChecks, Play } from 'lucide-react'
import { Page, Section } from '../../components/Page'
import { Sheet, SheetButton } from '../../components/Sheet'
import { db } from '../../db/db'
import { getActiveProgram } from '../../db/programs'
import { getOpenSession, startSession } from '../../db/sessions'
import { useT } from '../../i18n/useT'
import { sessionTitle } from '../../lib/sessionTitle'

export function Weights() {
  const t = useT()
  const navigate = useNavigate()
  const program = useLiveQuery(async () => (await getActiveProgram()) ?? null, [])
  const days = useLiveQuery(
    () => (program ? db.programDays.where('programId').equals(program.id!).sortBy('order') : []),
    [program?.id]
  )
  const open = useLiveQuery(async () => (await getOpenSession()) ?? null, [])
  const [choosing, setChoosing] = useState(false)

  const start = async (dayId?: number) => {
    await startSession(dayId)
    navigate('/weights/session')
  }

  return (
    <Page title={t('weights.title')}>
      {open ? (
        <Link to="/weights/session" className="mb-5 flex min-h-[72px] items-center gap-3 rounded-xl bg-weights px-4 py-3 text-white">
          <Play size={22} aria-hidden />
          <span className="flex-1">
            <span className="block text-[17px] font-semibold">{t('session.resume')}</span>
            <span className="block text-[14px] opacity-90">{sessionTitle(open, t)} · {open.date}</span>
          </span>
          <ChevronRight size={20} aria-hidden />
        </Link>
      ) : (
        open === null && days !== undefined && (
          <div className="mb-5 flex flex-col gap-2">
            {days.length > 0 && (
              <button onClick={() => setChoosing(true)} className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-xl bg-weights text-[17px] font-semibold text-white">
                <Play size={20} aria-hidden />
                {t('session.startFromProgram')}
              </button>
            )}
            {/* Training by feel needs no program: an empty session is always one tap away. */}
            <button
              onClick={() => start()}
              className={`flex w-full items-center justify-center gap-2 rounded-xl text-[17px] font-semibold ${
                days.length > 0 ? 'min-h-[52px] border border-line bg-surface text-weights' : 'min-h-[64px] bg-weights text-white'
              }`}
            >
              <Play size={20} aria-hidden />
              {t('session.startEmpty')}
            </button>
          </div>
        )
      )}

      <Section>
        <Link to="/weights/programs" className="flex min-h-[60px] items-center gap-3 border-b border-line px-4 py-2">
          <ListChecks size={22} className="text-weights" aria-hidden />
          <span className="flex-1">
            <span className="block text-[16px]">{t('program.title')}</span>
            <span className="block text-[13px] text-muted">{program ? program.name : t('program.noneActive')}</span>
          </span>
          <ChevronRight size={18} className="text-muted" aria-hidden />
        </Link>
        <Link to="/weights/history" className="flex min-h-[60px] items-center gap-3 border-b border-line px-4 py-2">
          <HistoryIcon size={22} className="text-weights" aria-hidden />
          <span className="flex-1">
            <span className="block text-[16px]">{t('history.title')}</span>
            <span className="block text-[13px] text-muted">{t('history.note')}</span>
          </span>
          <ChevronRight size={18} className="text-muted" aria-hidden />
        </Link>
        <Link to="/weights/exercises" className="flex min-h-[60px] items-center gap-3 px-4 py-2">
          <Library size={22} className="text-weights" aria-hidden />
          <span className="flex-1">
            <span className="block text-[16px]">{t('weights.library')}</span>
            <span className="block text-[13px] text-muted">{t('weights.libraryNote')}</span>
          </span>
          <ChevronRight size={18} className="text-muted" aria-hidden />
        </Link>
      </Section>

      <Sheet open={choosing} onClose={() => setChoosing(false)} title={t('session.startFromProgram')}>
        <p className="mb-3 text-[14px] text-muted">{t('session.fromProgram')} {program?.name}</p>
        {days?.map((d) => (
          <SheetButton key={d.id} onClick={() => start(d.id)}>{d.name}</SheetButton>
        ))}
      </Sheet>
    </Page>
  )
}
