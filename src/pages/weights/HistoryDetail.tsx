import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { MoreHorizontal, Plus } from 'lucide-react'
import { ExercisePicker } from '../../components/ExercisePicker'
import { Page } from '../../components/Page'
import { Sheet, SheetButton } from '../../components/Sheet'
import { db } from '../../db/db'
import { deleteHistoryExercise, deleteHistorySet, pendingSe, saveHistorySet, setSessionDate, setSetType } from '../../db/history'
import { cancelSession, emptyDraft, setToText } from '../../db/sessions'
import type { Exercise, SessionExercise, SetDraft, SetLog, WeightUnit } from '../../db/types'
import { useT } from '../../i18n/useT'
import { isPastOrToday, localDate } from '../../lib/dates'
import { loadProgress } from '../../lib/progress'
import { sessionTitle } from '../../lib/sessionTitle'
import { rowOrder, rowType, SetHeader, SetRow, type Row } from './SetRow'

const LIST = '/weights/history'
let localIds = -1

const hasTyped = (d: SetDraft) => !!(d.weight.trim() || d.value.trim() || d.left.trim() || d.right.trim())

/**
 * While rows with typed numbers are unsaved, in-app links (the back arrow, the tab bar) ask first.
 * HashRouter has no navigation blocker, so link clicks are caught before React Router sees them.
 */
function useLeaveGuard(active: boolean, onBlocked: (to: string) => void) {
  useEffect(() => {
    if (!active) return
    const onClick = (e: MouseEvent) => {
      const href = (e.target as Element | null)?.closest?.('a')?.getAttribute('href')
      if (!href?.startsWith('#')) return
      e.preventDefault()
      e.stopPropagation()
      onBlocked(href.slice(1) || '/')
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [active, onBlocked])
}

/**
 * A finished session, editable: numbers, set type, failure, deleting sets / exercises / the session,
 * adding sets or exercises, and changing the date. With id "new" it creates a backdated session,
 * which is only stored once its first set is saved.
 */
export function HistoryDetail() {
  const t = useT()
  const navigate = useNavigate()
  const param = useParams().id
  const [sessionId, setSessionId] = useState<number | undefined>(param === 'new' ? undefined : Number(param))
  const [newDate, setNewDate] = useState(localDate())
  const [pending, setPending] = useState<{ key: number; ex: Exercise }[]>([])
  // Unsaved rows of a pending exercise, handed over once its first set creates it.
  const [carry, setCarry] = useState<Record<number, SetDraft[]>>({})
  const [sheet, setSheet] = useState<'add' | 'delete'>()
  // Which blocks have unsaved rows with typed numbers.
  const [dirty, setDirty] = useState<Record<string, boolean>>({})
  const markDirty = useCallback((key: string, d: boolean) => setDirty((m) => (!!m[key] === d ? m : { ...m, [key]: d })), [])
  const [leaveTo, setLeaveTo] = useState<string>()
  useLeaveGuard(Object.values(dirty).some(Boolean), setLeaveTo)

  const data = useLiveQuery(async () => {
    const unit = (await db.settings.get('app'))?.weightUnit ?? 'kg'
    if (sessionId === undefined) return { unit, session: undefined, blocks: [] }
    const session = (await db.sessions.get(sessionId)) ?? null
    if (!session) return { unit, session, blocks: [] }
    const ses = await db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order')
    const sets = await db.sets.where('sessionExerciseId').anyOf(ses.map((se) => se.id!)).toArray()
    const blocks = await Promise.all(ses.map(async (se) => ({
      se,
      sets: sets.filter((s) => s.sessionExerciseId === se.id),
      prIds: (await loadProgress(se.exerciseId))?.prIds ?? new Set<number>()
    })))
    return { unit, session, blocks }
  }, [sessionId])

  if (!data) return null
  const { session, blocks, unit } = data
  if (session === null) return <Navigate to={LIST} replace />
  if (session && !session.finishedAt) return <Navigate to="/weights/session" replace />
  const date = session?.date ?? newDate
  const exerciseCount = blocks.length + pending.length

  return (
    <Page title={session ? sessionTitle(session, t) : t('history.newTitle')} back={LIST}>
      <label className="mb-4 flex min-h-[52px] items-center gap-3 rounded-xl border border-line bg-surface px-4">
        <span className="flex-1 text-[16px]">{t('history.date')}</span>
        <input
          type="date"
          value={date}
          max={localDate()}
          aria-label={t('history.date')}
          onChange={(e) => {
            const v = e.target.value
            if (!isPastOrToday(v)) return
            if (session) void setSessionDate(session.id!, v)
            else setNewDate(v)
          }}
          className="min-h-[40px] rounded-lg border border-line bg-bg px-2 text-[16px]"
        />
      </label>

      {blocks.map((b) => (
        <HistoryBlock
          key={b.se.id} se={b.se} sets={b.sets} prIds={b.prIds} unit={unit} date={date}
          dirtyKey={`s${b.se.id}`} markDirty={markDirty}
          sessionId={session!.id} exerciseCount={exerciseCount} initialRows={carry[b.se.id!]}
          onSessionGone={() => navigate(LIST, { replace: true })}
        />
      ))}
      {pending.map((p) => (
        <HistoryBlock
          key={`p${p.key}`} se={pendingSe(p.ex)} exercise={p.ex} sets={[]} prIds={new Set()} unit={unit} date={date}
          dirtyKey={`p${p.key}`} markDirty={markDirty}
          sessionId={sessionId} exerciseCount={exerciseCount}
          onCreated={(ids, rest) => {
            setCarry((c) => ({ ...c, [ids.seId]: rest }))
            setSessionId(ids.sessionId)
            setPending((list) => list.filter((x) => x.key !== p.key))
          }}
          onRemovePending={() => setPending((list) => list.filter((x) => x.key !== p.key))}
          onSessionGone={() => navigate(LIST, { replace: true })}
        />
      ))}
      {exerciseCount === 0 && <p className="mb-4 px-1 text-[15px] text-muted">{t('history.newHint')}</p>}

      <button onClick={() => setSheet('add')} className="mb-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-[16px] font-semibold text-weights">
        <Plus size={20} aria-hidden />
        {t('day.addExercise')}
      </button>
      {session && (
        <button onClick={() => setSheet('delete')} className="mb-8 min-h-[48px] w-full text-[15px] text-weights">
          {t('history.deleteSession')}
        </button>
      )}

      <ExercisePicker
        open={sheet === 'add'}
        onClose={() => setSheet(undefined)}
        onPick={(ex) => { setPending((list) => [...list, { key: Date.now(), ex }]); setSheet(undefined) }}
      />
      <Sheet open={leaveTo !== undefined} onClose={() => setLeaveTo(undefined)} title={t('history.leaveTitle')}>
        <p className="mb-4 text-[15px] text-muted">{t('history.leaveBody')}</p>
        <SheetButton tone="danger" onClick={() => { const to = leaveTo!; setDirty({}); setLeaveTo(undefined); navigate(to) }}>
          {t('history.leave')}
        </SheetButton>
        <SheetButton onClick={() => setLeaveTo(undefined)}>{t('history.stay')}</SheetButton>
      </Sheet>
      <Sheet open={sheet === 'delete'} onClose={() => setSheet(undefined)} title={t('history.deleteSessionConfirm')}>
        <p className="mb-4 text-[15px] text-muted">{t('history.deleteSessionNote')}</p>
        <SheetButton tone="danger" onClick={async () => { await cancelSession(session!.id!); navigate(LIST, { replace: true }) }}>
          {t('history.deleteSession')}
        </SheetButton>
        <SheetButton onClick={() => setSheet(undefined)}>{t('common.cancel')}</SheetButton>
      </Sheet>
    </Page>
  )
}

function HistoryBlock({ se, exercise, sets, prIds, unit, date, sessionId, exerciseCount, initialRows, dirtyKey, markDirty, onCreated, onRemovePending, onSessionGone }: {
  se: SessionExercise; exercise?: Exercise; sets: SetLog[]; prIds: Set<number>; unit: WeightUnit; date: string
  sessionId?: number; exerciseCount: number; initialRows?: SetDraft[]
  onCreated?: (ids: { sessionId: number; seId: number }, rest: SetDraft[]) => void
  onRemovePending?: () => void
  onSessionGone: () => void
  dirtyKey: string; markDirty: (key: string, dirty: boolean) => void
}) {
  const t = useT()
  const navigate = useNavigate()
  const isPending = !!exercise
  // Rows added here live on screen only until saved with ✓; they are never stored as drafts.
  const [newRows, setNewRows] = useState<SetDraft[]>(() => initialRows ?? (isPending ? [{ ...emptyDraft(0, 0), id: localIds-- }] : []))
  const [menu, setMenu] = useState<'menu' | 'delete'>()
  const typed = newRows.some(hasTyped)
  useEffect(() => markDirty(dirtyKey, typed), [dirtyKey, typed, markDirty])
  useEffect(() => () => markDirty(dirtyKey, false), [dirtyKey, markDirty])
  const [rowMenu, setRowMenu] = useState<Row>()
  const [confirmSet, setConfirmSet] = useState<SetLog>()
  const [note, setNote] = useState(se.note ?? '')
  useEffect(() => setNote(se.note ?? ''), [se.id])

  const rows: Row[] = [
    ...sets.map((set): Row => ({ kind: 'set', set })),
    ...newRows.map((draft): Row => ({ kind: 'new', draft }))
  ].sort((a, b) => rowOrder(a) - rowOrder(b))
  const addRow = (type: 'working' | 'warmup') => {
    const order = type === 'working'
      ? rows.reduce((m, r) => Math.max(m, rowOrder(r) + 1), 0)
      : rows.reduce((m, r) => Math.min(m, rowOrder(r)), 0) - 1
    setNewRows((list) => [...list, { ...emptyDraft(se.id ?? 0, order, type), id: localIds-- }])
  }

  let working = 0
  const labelled = rows.map((r, i) => {
    const isWorking = rowType(r) === 'working'
    const label = isWorking ? String(++working) : 'W'
    const aboveRow = rows[i - 1]
    const above = aboveRow && (aboveRow.kind === 'set' ? setToText(aboveRow.set, se, unit) : aboveRow.draft)
    return { r, label, above: above && (above.weight || above.value || above.left) ? above : undefined }
  })

  const saveNew = async (row: SetDraft) => {
    const res = await saveHistorySet({ sessionId, date, se: isPending ? undefined : se, exercise, row, unit })
    if (!res) return false
    const rest = newRows.filter((d) => d.id !== row.id)
    setNewRows(rest)
    onCreated?.(res, rest)
    return true
  }
  // Deleting the last set removes the exercise, and the last exercise removes the session.
  const cascade = (setCount: number) =>
    setCount > 1 ? '' : exerciseCount > 1 ? t('history.cascadeExercise') : t('history.cascadeSession')
  const afterDelete = (what: 'set' | 'exercise' | 'session') => { if (what === 'session') onSessionGone() }

  return (
    <section className="mb-4 rounded-xl border border-line bg-surface p-3">
      <div className="mb-1 flex items-start gap-2">
        <h2 className="min-w-0 flex-1 text-[17px] font-semibold leading-snug">{se.name}</h2>
        <button onClick={() => setMenu('menu')} aria-label={t('session.exerciseMenu')} className="-mr-1 -mt-1 flex h-11 w-11 items-center justify-center text-muted">
          <MoreHorizontal size={22} aria-hidden />
        </button>
      </div>
      <SetHeader se={se} unit={unit} />
      {labelled.map(({ r, label, above }) => (
        <SetRow
          key={r.kind === 'set' ? `s${r.set.id}` : `n${r.draft.id}`}
          se={se} row={r} label={label} above={above} unit={unit} date={date}
          pr={r.kind === 'set' && prIds.has(r.set.id!)}
          onLabel={() => setRowMenu(r)}
          onSaveNew={saveNew}
          onNewChange={(patch) => r.kind === 'new' && setNewRows((list) => list.map((d) => (d.id === r.draft.id ? { ...d, ...patch } : d)))}
        />
      ))}
      <div className="mt-2 flex gap-2">
        <button onClick={() => addRow('working')} className="min-h-[44px] flex-1 rounded-lg border border-line text-[15px]">{t('set.addSet')}</button>
        <button onClick={() => addRow('warmup')} className="min-h-[44px] flex-1 rounded-lg border border-line text-[15px] text-muted">{t('set.addWarmup')}</button>
      </div>
      {!isPending && (
        <textarea
          value={note}
          onChange={(e) => { setNote(e.target.value); void db.sessionExercises.update(se.id!, { note: e.target.value }) }}
          placeholder={t('session.note')}
          aria-label={t('session.note')}
          rows={1}
          className="mt-2 min-h-[44px] w-full resize-none rounded-lg border border-line bg-bg px-3 py-2.5 text-[16px]"
        />
      )}

      <Sheet open={menu === 'menu'} onClose={() => setMenu(undefined)} title={se.name}>
        <SheetButton onClick={() => navigate(`/weights/exercises/${se.exerciseId}/history`, { state: sessionId === undefined ? undefined : { from: `/weights/history/${sessionId}` } })}>{t('history.exercise')}</SheetButton>
        {isPending
          ? <SheetButton tone="danger" onClick={() => onRemovePending?.()}>{t('session.removeExercise')}</SheetButton>
          : <SheetButton tone="danger" onClick={() => setMenu('delete')}>{t('history.deleteExercise')}</SheetButton>}
        <SheetButton onClick={() => setMenu(undefined)}>{t('common.cancel')}</SheetButton>
      </Sheet>
      <Sheet open={menu === 'delete'} onClose={() => setMenu(undefined)} title={t('history.deleteExerciseConfirm')}>
        <p className="mb-4 text-[15px] text-muted">
          {[t('session.removeNote').replace('{n}', String(sets.length)), exerciseCount > 1 ? '' : t('history.cascadeSession')].filter(Boolean).join(' ')}
        </p>
        <SheetButton tone="danger" onClick={async () => { setMenu(undefined); afterDelete(await deleteHistoryExercise(se)) }}>
          {t('history.deleteExercise')}
        </SheetButton>
        <SheetButton onClick={() => setMenu(undefined)}>{t('common.cancel')}</SheetButton>
      </Sheet>

      <Sheet open={!!rowMenu} onClose={() => setRowMenu(undefined)} title={t('set.rowMenu')}>
        {rowMenu && (
          <>
            <SheetButton onClick={async () => {
              const type = rowType(rowMenu) === 'working' ? 'warmup' : 'working'
              if (rowMenu.kind === 'set') await setSetType(rowMenu.set, type, se.sessionId)
              else setNewRows((list) => list.map((d) => (d.id === rowMenu.draft.id ? { ...d, type } : d)))
              setRowMenu(undefined)
            }}>
              {rowType(rowMenu) === 'working' ? t('set.makeWarmup') : t('set.makeWorking')}
            </SheetButton>
            <SheetButton tone="danger" onClick={() => {
              if (rowMenu.kind === 'set') setConfirmSet(rowMenu.set)
              else setNewRows((list) => list.filter((d) => d.id !== rowMenu.draft.id))
              setRowMenu(undefined)
            }}>
              {rowMenu.kind === 'set' ? t('set.deleteSaved') : t('set.delete')}
            </SheetButton>
            <SheetButton onClick={() => setRowMenu(undefined)}>{t('common.cancel')}</SheetButton>
          </>
        )}
      </Sheet>
      <Sheet open={!!confirmSet} onClose={() => setConfirmSet(undefined)} title={t('history.deleteSetConfirm')}>
        {cascade(sets.length) && <p className="mb-4 text-[15px] text-muted">{cascade(sets.length)}</p>}
        <SheetButton tone="danger" onClick={async () => {
          const s = confirmSet!
          setConfirmSet(undefined)
          afterDelete(await deleteHistorySet(s, se.sessionId))
        }}>
          {t('set.deleteSaved')}
        </SheetButton>
        <SheetButton onClick={() => setConfirmSet(undefined)}>{t('common.cancel')}</SheetButton>
      </Sheet>
    </section>
  )
}
