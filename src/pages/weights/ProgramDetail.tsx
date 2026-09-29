import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronRight, ChevronUp, Plus } from 'lucide-react'
import { Page, Section } from '../../components/Page'
import { NameSheet, Sheet, SheetButton } from '../../components/Sheet'
import { db } from '../../db/db'
import { addDay, dayBodyParts, deleteProgram, moveRow, setActiveProgram } from '../../db/programs'
import { useT } from '../../i18n/useT'

export function ProgramDetail() {
  const t = useT()
  const navigate = useNavigate()
  const id = Number(useParams().id)
  const program = useLiveQuery(async () => (await db.programs.get(id)) ?? null, [id])
  const days = useLiveQuery(async () => {
    const list = await db.programDays.where('programId').equals(id).sortBy('order')
    return Promise.all(list.map(async (d) => ({
      day: d,
      count: await db.programExercises.where('dayId').equals(d.id!).count(),
      parts: await dayBodyParts(d.id!)
    })))
  }, [id])
  const [sheet, setSheet] = useState<'addDay' | 'rename' | 'delete'>()

  if (program === undefined) return null
  if (program === null) return <Page title={t('program.notFound')} back="/weights/programs">{null}</Page>

  return (
    <Page title={program.name} back="/weights/programs">
      <div className="-mt-2 mb-5">
        {program.isActive ? (
          <span className="rounded-full bg-weights/15 px-2.5 py-1 text-[13px] font-semibold text-weights">{t('program.active')}</span>
        ) : (
          <button onClick={() => setActiveProgram(id)} className="min-h-[44px] rounded-xl bg-weights px-4 text-[15px] font-semibold text-white">
            {t('program.makeActive')}
          </button>
        )}
      </div>

      <Section title={t('program.days')}>
        {days?.length === 0 && <p className="px-4 py-4 text-[15px] text-muted">{t('program.noDays')}</p>}
        {days?.map(({ day, count, parts }, i) => (
          <div key={day.id} className="flex min-h-[60px] items-center border-b border-line last:border-b-0">
            <Link to={`/weights/programs/${id}/days/${day.id}`} className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-4">
              <span className="min-w-0 flex-1">
                <span className="block text-[16px]">{day.name}</span>
                <span className="block truncate text-[13px] text-muted">
                  {[`${count} ${t('lib.count')}`, ...parts.map((p) => t(`part.${p}`))].join(' · ')}
                </span>
              </span>
              <ChevronRight size={18} className="text-muted" aria-hidden />
            </Link>
            <button
              onClick={() => moveRow(db.programDays, days.map((d) => d.day), day.id!, -1)}
              disabled={i === 0}
              aria-label={t('common.moveUp')}
              className="flex h-11 w-10 items-center justify-center text-muted disabled:opacity-25"
            >
              <ChevronUp size={20} aria-hidden />
            </button>
            <button
              onClick={() => moveRow(db.programDays, days.map((d) => d.day), day.id!, 1)}
              disabled={i === days.length - 1}
              aria-label={t('common.moveDown')}
              className="mr-1 flex h-11 w-10 items-center justify-center text-muted disabled:opacity-25"
            >
              <ChevronDown size={20} aria-hidden />
            </button>
          </div>
        ))}
      </Section>
      <button onClick={() => setSheet('addDay')} className="mb-6 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-[16px] font-semibold text-weights">
        <Plus size={20} aria-hidden />
        {t('program.addDay')}
      </button>

      <Section>
        <button onClick={() => setSheet('rename')} className="flex min-h-[52px] w-full items-center border-b border-line px-4 text-left text-[16px]">
          {t('program.rename')}
        </button>
        <button onClick={() => setSheet('delete')} className="flex min-h-[52px] w-full items-center px-4 text-left text-[16px] text-weights">
          {t('program.delete')}
        </button>
      </Section>

      <NameSheet
        open={sheet === 'addDay'}
        title={t('program.dayName')}
        saveLabel={t('common.create')}
        onClose={() => setSheet(undefined)}
        onSave={async (name) => {
          const dayId = await addDay(id, name)
          setSheet(undefined)
          navigate(`/weights/programs/${id}/days/${dayId}`)
        }}
      />
      <NameSheet
        open={sheet === 'rename'}
        title={t('program.rename')}
        initial={program.name}
        saveLabel={t('common.save')}
        onClose={() => setSheet(undefined)}
        onSave={async (name) => { await db.programs.update(id, { name }); setSheet(undefined) }}
      />
      <Sheet open={sheet === 'delete'} onClose={() => setSheet(undefined)} title={t('program.deleteConfirm')}>
        <p className="mb-4 text-[15px] text-muted">{t('program.deleteNote')}</p>
        <SheetButton tone="danger" onClick={async () => { await deleteProgram(id); navigate('/weights/programs', { replace: true }) }}>
          {t('program.delete')}
        </SheetButton>
        <SheetButton onClick={() => setSheet(undefined)}>{t('common.cancel')}</SheetButton>
      </Sheet>
    </Page>
  )
}
