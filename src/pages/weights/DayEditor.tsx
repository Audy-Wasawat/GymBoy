import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { ExercisePicker } from '../../components/ExercisePicker'
import { NumberField } from '../../components/NumberField'
import { Page, Section } from '../../components/Page'
import { NameSheet, Sheet, SheetButton } from '../../components/Sheet'
import { db } from '../../db/db'
import { addDayExercise, dayBodyParts, deleteDay, moveRow } from '../../db/programs'
import type { ProgramExercise } from '../../db/types'
import { useSettings } from '../../db/useSettings'
import { useT } from '../../i18n/useT'

export function DayEditor() {
  const t = useT()
  const navigate = useNavigate()
  const { defaultRestSec } = useSettings()
  const params = useParams()
  const programId = Number(params.id)
  const dayId = Number(params.dayId)
  const back = `/weights/programs/${programId}`
  const day = useLiveQuery(async () => (await db.programDays.get(dayId)) ?? null, [dayId])
  const data = useLiveQuery(async () => {
    const rows = await db.programExercises.where('dayId').equals(dayId).sortBy('order')
    const exs = await db.exercises.bulkGet(rows.map((r) => r.exerciseId))
    return { rows: rows.map((r, i) => ({ row: r, ex: exs[i] })), parts: await dayBodyParts(dayId) }
  }, [dayId])
  const [sheet, setSheet] = useState<'rename' | 'delete' | 'pick'>()

  if (day === undefined) return null
  if (day === null) return <Page title={t('program.notFound')} back={back}>{null}</Page>

  const update = (id: number, patch: Partial<ProgramExercise>) => db.programExercises.update(id, patch)
  const rows = data?.rows ?? []

  return (
    <Page title={day.name} back={back}>
      <p className="-mt-2 mb-4 text-[15px] text-muted">
        {data?.parts.length ? data.parts.map((p) => t(`part.${p}`)).join(' · ') : t('day.partsAuto')}
      </p>

      {rows.map(({ row, ex }, i) => {
        const timed = !!ex?.timed
        return (
          <div key={row.id} className="mb-3 rounded-xl border border-line bg-surface p-3">
            <div className="mb-2 flex items-center gap-1">
              <span className="min-w-0 flex-1 text-[16px] font-semibold">{ex?.name ?? '—'}</span>
              <button onClick={() => moveRow(db.programExercises, rows.map((r) => r.row), row.id!, -1)} disabled={i === 0} aria-label={t('common.moveUp')} className="flex h-11 w-10 items-center justify-center text-muted disabled:opacity-25">
                <ChevronUp size={20} aria-hidden />
              </button>
              <button onClick={() => moveRow(db.programExercises, rows.map((r) => r.row), row.id!, 1)} disabled={i === rows.length - 1} aria-label={t('common.moveDown')} className="flex h-11 w-10 items-center justify-center text-muted disabled:opacity-25">
                <ChevronDown size={20} aria-hidden />
              </button>
              <button
                onClick={() => db.programExercises.delete(row.id!)}
                aria-label={t('day.removeExercise')}
                className="flex h-11 w-10 items-center justify-center text-muted"
              >
                <Trash2 size={18} aria-hidden />
              </button>
            </div>
            <div className="flex gap-2">
              <NumberField label={t('day.sets')} value={row.targetSets} min={1} onSave={(targetSets) => update(row.id!, { targetSets })} />
              <NumberField
                label={timed ? t('day.minSec') : t('day.minReps')}
                value={row.repMin}
                min={1}
                onSave={(repMin) => update(row.id!, { repMin, repMax: Math.max(repMin, row.repMax) })}
              />
              <NumberField
                label={timed ? t('day.maxSec') : t('day.maxReps')}
                value={row.repMax}
                min={1}
                onSave={(repMax) => update(row.id!, { repMax, repMin: Math.min(repMax, row.repMin) })}
              />
              <NumberField label={t('day.restSec')} value={row.restSec} onSave={(restSec) => update(row.id!, { restSec })} />
            </div>
          </div>
        )
      })}
      {data && rows.length === 0 && <p className="mb-4 px-1 text-[15px] text-muted">{t('day.noExercises')}</p>}

      <button onClick={() => setSheet('pick')} className="mb-6 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-[16px] font-semibold text-weights">
        <Plus size={20} aria-hidden />
        {t('day.addExercise')}
      </button>

      <Section>
        <button onClick={() => setSheet('rename')} className="flex min-h-[52px] w-full items-center border-b border-line px-4 text-left text-[16px]">
          {t('day.rename')}
        </button>
        <button onClick={() => setSheet('delete')} className="flex min-h-[52px] w-full items-center px-4 text-left text-[16px] text-weights">
          {t('day.delete')}
        </button>
      </Section>

      <ExercisePicker
        open={sheet === 'pick'}
        onClose={() => setSheet(undefined)}
        onPick={async (ex) => { await addDayExercise(dayId, ex, defaultRestSec); setSheet(undefined) }}
      />
      <NameSheet
        open={sheet === 'rename'}
        title={t('day.rename')}
        initial={day.name}
        saveLabel={t('common.save')}
        onClose={() => setSheet(undefined)}
        onSave={async (name) => { await db.programDays.update(dayId, { name }); setSheet(undefined) }}
      />
      <Sheet open={sheet === 'delete'} onClose={() => setSheet(undefined)} title={t('day.deleteConfirm')}>
        <p className="mb-4 text-[15px] text-muted">{t('program.deleteNote')}</p>
        <SheetButton tone="danger" onClick={async () => { await deleteDay(dayId); navigate(back, { replace: true }) }}>
          {t('day.delete')}
        </SheetButton>
        <SheetButton onClick={() => setSheet(undefined)}>{t('common.cancel')}</SheetButton>
      </Sheet>
    </Page>
  )
}
