import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { MoreHorizontal, Plus } from 'lucide-react'
import { ExercisePicker } from '../../components/ExercisePicker'
import { Page } from '../../components/Page'
import { Sheet, SheetButton } from '../../components/Sheet'
import { db } from '../../db/db'
import { moveRow } from '../../db/programs'
import {
  addExerciseToSession, cancelSession, deleteSet, emptyDraft, getOpenSession, previousEntry,
  refreshBodyParts, removeSessionExercise, replaceSessionExercise, setToText, startRest
} from '../../db/sessions'
import type { SessionExercise, SetDraft, SetLog, WeightUnit, WorkoutSession } from '../../db/types'
import { useSettings } from '../../db/useSettings'
import { useT } from '../../i18n/useT'
import { loadProgress, weightHint, type WeightHint } from '../../lib/progress'
import { sessionTitle } from '../../lib/sessionTitle'
import { useWakeLock } from '../../lib/useWakeLock'
import { FinishFlow } from './FinishFlow'
import { RestBar } from './RestBar'
import { HintNote } from './HintNote'
import { rowOrder, rowType, SetHeader, SetRow, type Row } from './SetRow'

interface Block { se: SessionExercise; rows: Row[]; prev: SetLog[]; unit: WeightUnit; prIds: Set<number>; hint?: WeightHint }

export function SessionPage() {
  const t = useT()
  const navigate = useNavigate()
  useWakeLock()
  const session = useLiveQuery(async () => (await getOpenSession()) ?? null, [])
  const blocks = useLiveQuery(async (): Promise<Block[] | undefined> => {
    if (!session) return undefined
    const ses = await db.sessionExercises.where('sessionId').equals(session.id!).sortBy('order')
    const ids = ses.map((se) => se.id!)
    // The unit is read here, not from useSettings, so rows never render with the default before
    // settings load (a draft typed in lb must not be read as kg).
    const [sets, drafts, settings] = await Promise.all([
      db.sets.where('sessionExerciseId').anyOf(ids).toArray(),
      db.setDrafts.where('sessionExerciseId').anyOf(ids).toArray(),
      db.settings.get('app')
    ])
    const unit = settings?.weightUnit ?? 'kg'
    return Promise.all(ses.map(async (se) => {
      const saved = sets.filter((s) => s.sessionExerciseId === se.id)
      const prev = await previousEntry(se.exerciseId, session.id!)
      return {
        se,
        rows: [
          ...saved.map((set): Row => ({ kind: 'set', set })),
          ...drafts.filter((d) => d.sessionExerciseId === se.id).map((draft): Row => ({ kind: 'draft', draft }))
        ].sort((a, b) => rowOrder(a) - rowOrder(b)),
        prev: prev?.sets.filter((s) => s.type === 'working') ?? [],
        unit,
        prIds: (await loadProgress(se.exerciseId))?.prIds ?? new Set<number>(),
        hint: weightHint(prev, saved)
      }
    }))
  }, [session?.id])
  const [sheet, setSheet] = useState<'add' | 'cancel'>()
  const [finishing, setFinishing] = useState(false)

  if (session === undefined) return null
  if (session === null) return <Navigate to="/weights" replace />

  return (
    <Page title={sessionTitle(session, t)} back="/weights">
      <p className="-mt-2 mb-4 text-[15px] text-muted">
        {/* A session without a day name is already titled by its body parts. */}
        {[session.date, ...(session.dayName ? session.bodyParts.map((p) => t(`part.${p}`)) : [])].join(' · ')}
      </p>

      {blocks?.map((b, i) => (
        <ExerciseBlock key={b.se.id} block={b} session={session} ses={blocks.map((x) => x.se)} index={i} />
      ))}
      {blocks && blocks.length === 0 && <p className="mb-4 px-1 text-[15px] text-muted">{t('session.noExercises')}</p>}

      <button onClick={() => setSheet('add')} className="mb-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-[16px] font-semibold text-weights">
        <Plus size={20} aria-hidden />
        {t('day.addExercise')}
      </button>
      <button onClick={() => setFinishing(true)} className="mb-3 min-h-[56px] w-full rounded-xl bg-weights text-[17px] font-semibold text-white">
        {t('session.finish')}
      </button>
      <button onClick={() => setSheet('cancel')} className="mb-28 min-h-[48px] w-full text-[15px] text-muted">
        {t('session.cancel')}
      </button>

      <RestBar session={session} />
      <ExercisePicker
        open={sheet === 'add'}
        onClose={() => setSheet(undefined)}
        onPick={async (ex) => { await addExerciseToSession(session.id!, ex); setSheet(undefined) }}
      />
      <Sheet open={sheet === 'cancel'} onClose={() => setSheet(undefined)} title={t('session.cancelConfirm')}>
        <p className="mb-4 text-[15px] text-muted">{t('session.cancelNote')}</p>
        <SheetButton tone="danger" onClick={async () => { await cancelSession(session.id!); navigate('/weights', { replace: true }) }}>
          {t('session.cancel')}
        </SheetButton>
        <SheetButton onClick={() => setSheet(undefined)}>{t('finish.back')}</SheetButton>
      </Sheet>
      <FinishFlow
        sessionId={session.id}
        active={finishing}
        onCancel={() => setFinishing(false)}
        onDone={() => { setFinishing(false); navigate('/weights', { replace: true }) }}
      />
    </Page>
  )
}

function ExerciseBlock({ block, session, ses, index }: {
  block: Block; session: WorkoutSession; ses: SessionExercise[]; index: number
}) {
  const t = useT()
  const { defaultRestSec } = useSettings()
  const navigate = useNavigate()
  const { se, rows, prev, unit: weightUnit, prIds, hint } = block
  const [menu, setMenu] = useState<'menu' | 'swap' | 'remove'>()
  const [rowMenu, setRowMenu] = useState<Row>()
  const [note, setNote] = useState(se.note ?? '')
  useEffect(() => setNote(se.note ?? ''), [se.id])

  const savedCount = rows.filter((r) => r.kind === 'set').length
  const nextOrder = rows.reduce((m, r) => Math.max(m, rowOrder(r) + 1), 0)
  const firstOrder = rows.reduce((m, r) => Math.min(m, rowOrder(r)), 0)
  const addRow = (type: 'working' | 'warmup') =>
    db.setDrafts.add(emptyDraft(se.id!, type === 'working' ? nextOrder : firstOrder - 1, type))

  const target = se.targetSets
    ? `${se.targetSets}×${se.repMin}–${se.repMax}${se.timed ? ` ${t('set.sec')}` : ''}`
    : undefined
  const rest = `${t('rest.title')} ${se.restSec ?? defaultRestSec} ${t('set.sec')}`

  // Working sets are numbered 1, 2, 3...; warm-ups show "W". "Previous" matches working sets by number.
  let working = 0
  const labelled = rows.map((r, i) => {
    const isWorking = rowType(r) === 'working'
    const n = isWorking ? working++ : -1
    const aboveRow = rows[i - 1]
    const above = aboveRow && (aboveRow.kind === 'set' ? setToText(aboveRow.set, se, weightUnit) : aboveRow.draft)
    return { r, label: isWorking ? String(n + 1) : 'W', prev: isWorking ? prev[n] : undefined, above: above && (above.weight || above.value || above.left) ? above : undefined }
  })

  const onSaved = (d: SetDraft) => {
    if (d.type === 'working') void startRest(session.id!, se.restSec ?? defaultRestSec)
  }

  return (
    <section className="mb-4 rounded-xl border border-line bg-surface p-3">
      <div className="mb-1 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold leading-snug">{se.name}</h2>
          <p className="text-[13px] text-muted">{[target, rest].filter(Boolean).join(' · ')}</p>
          {hint && <HintNote hint={hint} unit={weightUnit} />}
        </div>
        <button onClick={() => setMenu('menu')} aria-label={t('session.exerciseMenu')} className="-mr-1 -mt-1 flex h-11 w-11 items-center justify-center text-muted">
          <MoreHorizontal size={22} aria-hidden />
        </button>
      </div>

      <SetHeader se={se} unit={weightUnit} />
      {labelled.map(({ r, label, prev: p, above }) => (
        <SetRow
          key={r.kind === 'set' ? `s${r.set.id}` : `d${r.draft.id}`}
          se={se} row={r} label={label} prev={p} above={above}
          pr={r.kind === 'set' && prIds.has(r.set.id!)}
          unit={weightUnit} date={session.date}
          onLabel={() => setRowMenu(r)}
          onSaved={onSaved}
        />
      ))}

      <div className="mt-2 flex gap-2">
        <button onClick={() => addRow('working')} className="min-h-[44px] flex-1 rounded-lg border border-line text-[15px]">{t('set.addSet')}</button>
        <button onClick={() => addRow('warmup')} className="min-h-[44px] flex-1 rounded-lg border border-line text-[15px] text-muted">{t('set.addWarmup')}</button>
      </div>
      <textarea
        value={note}
        onChange={(e) => { setNote(e.target.value); void db.sessionExercises.update(se.id!, { note: e.target.value }) }}
        placeholder={t('session.note')}
        aria-label={t('session.note')}
        rows={1}
        className="mt-2 min-h-[44px] w-full resize-none rounded-lg border border-line bg-bg px-3 py-2.5 text-[16px]"
      />

      <Sheet open={menu === 'menu'} onClose={() => setMenu(undefined)} title={se.name}>
        {index > 0 && <SheetButton onClick={() => { void moveRow(db.sessionExercises, ses, se.id!, -1); setMenu(undefined) }}>{t('common.moveUp')}</SheetButton>}
        {index < ses.length - 1 && <SheetButton onClick={() => { void moveRow(db.sessionExercises, ses, se.id!, 1); setMenu(undefined) }}>{t('common.moveDown')}</SheetButton>}
        <SheetButton onClick={() => navigate(`/weights/exercises/${se.exerciseId}/history`, { state: { from: '/weights/session' } })}>{t('history.exercise')}</SheetButton>
        {savedCount === 0 && <SheetButton onClick={() => setMenu('swap')}>{t('session.swap')}</SheetButton>}
        <SheetButton tone="danger" onClick={() => (savedCount ? setMenu('remove') : void removeSessionExercise(se))}>{t('session.removeExercise')}</SheetButton>
        <SheetButton onClick={() => setMenu(undefined)}>{t('common.cancel')}</SheetButton>
      </Sheet>
      <Sheet open={menu === 'remove'} onClose={() => setMenu(undefined)} title={t('session.removeConfirm')}>
        <p className="mb-4 text-[15px] text-muted">{t('session.removeNote').replace('{n}', String(savedCount))}</p>
        <SheetButton tone="danger" onClick={() => void removeSessionExercise(se)}>{t('session.removeExercise')}</SheetButton>
        <SheetButton onClick={() => setMenu(undefined)}>{t('common.cancel')}</SheetButton>
      </Sheet>
      <ExercisePicker
        open={menu === 'swap'}
        onClose={() => setMenu(undefined)}
        onPick={async (ex) => { await replaceSessionExercise(se.id!, ex); setMenu(undefined) }}
      />

      <Sheet open={!!rowMenu} onClose={() => setRowMenu(undefined)} title={t('set.rowMenu')}>
        {rowMenu && (
          <>
            <SheetButton onClick={async () => {
              const type = rowType(rowMenu) === 'working' ? 'warmup' : 'working'
              if (rowMenu.kind !== 'set') await db.setDrafts.update(rowMenu.draft.id!, { type })
              else { await db.sets.update(rowMenu.set.id!, { type }); await refreshBodyParts(session.id!) }
              setRowMenu(undefined)
            }}>
              {rowType(rowMenu) === 'working' ? t('set.makeWarmup') : t('set.makeWorking')}
            </SheetButton>
            <SheetButton tone="danger" onClick={async () => {
              if (rowMenu.kind !== 'set') await db.setDrafts.delete(rowMenu.draft.id!)
              else await deleteSet(rowMenu.set, session.id!)
              setRowMenu(undefined)
            }}>
              {rowMenu.kind === 'set' ? t('set.deleteSaved') : t('set.delete')}
            </SheetButton>
            <SheetButton onClick={() => setRowMenu(undefined)}>{t('common.cancel')}</SheetButton>
          </>
        )}
      </Sheet>
    </section>
  )
}
