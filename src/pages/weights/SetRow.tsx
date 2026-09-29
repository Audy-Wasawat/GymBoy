import { useState } from 'react'
import { Check, CopyPlus } from 'lucide-react'
import { db } from '../../db/db'
import { readSetValues, saveDraft, setToText } from '../../db/sessions'
import type { SessionExercise, SetDraft, SetLog, WeightUnit } from '../../db/types'
import { useT } from '../../i18n/useT'
import { parseDecimal } from '../../lib/numbers'
import { setSummary } from '../../lib/setFormat'
import { unlockAudio } from '../../lib/sound'
import { fromDisplayWeight, toDisplayWeight } from '../../lib/units'

/**
 * A row is a saved set, a draft stored in the database (live sessions), or a new row kept only on
 * screen (history editing, where drafts must never be left behind in a finished session).
 */
export type Row = { kind: 'draft' | 'new'; draft: SetDraft } | { kind: 'set'; set: SetLog }
export const rowOrder = (r: Row) => (r.kind === 'set' ? r.set.setNumber : r.draft.order)
export const rowType = (r: Row) => (r.kind === 'set' ? r.set.type : r.draft.type)

type Text = { weight: string; value: string; left: string; right: string }

/** Grid columns shared by the header and the rows; left/right exercises get two value inputs. */
export const rowGrid = (lr: boolean) =>
  lr ? 'grid-cols-[28px_48px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_32px_44px]'
    : 'grid-cols-[32px_56px_minmax(0,1fr)_minmax(0,1fr)_36px_44px]'

export function SetRow({ se, row, label, prev, above, unit, date, pr, onLabel, onSaved, onSaveNew, onNewChange }: {
  se: SessionExercise; row: Row; label: string; prev?: SetLog; above?: Text; unit: WeightUnit; date: string
  /** This saved set beat every earlier working set of the exercise. */
  pr?: boolean
  onLabel: () => void; onSaved?: (row: SetDraft) => void
  /** Saves a 'new' row; resolves false when the row is incomplete. */
  onSaveNew?: (row: SetDraft) => Promise<boolean>
  /** Keeps the parent's copy of a 'new' row in step with what is typed. */
  onNewChange?: (patch: Partial<SetDraft>) => void
}) {
  const t = useT()
  const [text, setText] = useState<Text>(() => {
    if (row.kind === 'set') return setToText(row.set, se, unit)
    // A draft typed in the other unit is shown (and from now on kept) in the current one.
    const d = row.draft
    const w = parseDecimal(d.weight)
    if (d.unit && d.unit !== unit && w !== undefined) {
      const weight = String(toDisplayWeight(fromDisplayWeight(w, d.unit), unit))
      void db.setDrafts.update(d.id!, { weight, unit })
      return { ...d, weight }
    }
    return d
  })
  const [error, setError] = useState(false)
  const saved = row.kind === 'set'
  const [newFailure, setNewFailure] = useState(row.kind === 'new' && row.draft.toFailure)
  const failure = row.kind === 'set' ? row.set.toFailure : row.kind === 'draft' ? row.draft.toFailure : newFailure

  // Drafts are written on every keystroke so nothing is lost if iOS closes the app.
  // Saved sets are updated whenever the edited values are complete.
  const change = (patch: Partial<Text>) => {
    const next = { ...text, ...patch }
    setText(next)
    setError(false)
    if (row.kind === 'draft') void db.setDrafts.update(row.draft.id!, 'weight' in patch ? { ...patch, unit } : patch)
    else if (row.kind === 'new') onNewChange?.(patch)
    else if (row.kind === 'set') {
      const values = readSetValues(next, se, unit)
      if (values) void db.sets.update(row.set.id!, values)
    }
  }
  const toggleFailure = () => {
    if (row.kind === 'draft') void db.setDrafts.update(row.draft.id!, { toFailure: !failure })
    else if (row.kind === 'set') void db.sets.update(row.set.id!, { toFailure: !failure })
    else { setNewFailure(!failure); onNewChange?.({ toFailure: !failure }) }
  }
  const [confirming, setConfirming] = useState(false)
  const confirm = async () => {
    if (row.kind === 'set') return
    if (confirming) return
    setConfirming(true)
    try {
      if (row.kind === 'new') {
        if (!(await onSaveNew?.({ ...row.draft, ...text, toFailure: newFailure, unit }))) setError(true)
        return
      }
      // Must run inside the tap itself for iOS to allow sound later.
      unlockAudio()
      const draft = { ...row.draft, ...text, unit }
      if (await saveDraft(draft, se, unit, date)) onSaved?.(draft)
      else setError(true)
    } finally {
      setConfirming(false)
    }
  }
  const copyFrom = prev ? setToText(prev, se, unit) : above
  const canCopy = !saved && !!copyFrom

  const input = (key: keyof Text, placeholder: string, label: string) => (
    <input
      value={text[key]}
      onChange={(e) => change({ [key]: e.target.value })}
      inputMode="decimal"
      enterKeyHint="done"
      placeholder={placeholder}
      aria-label={label}
      className={`min-h-[44px] w-full min-w-0 rounded-lg border bg-bg px-1 text-center text-[16px] ${
        error ? 'border-weights' : 'border-line'
      }`}
    />
  )
  const valueHint = se.timed ? t('set.sec') : t('set.reps')
  const weightHint = se.bodyweight || se.timed ? `+${unit}` : unit

  return (
    <div className={`grid items-center gap-1 rounded-lg py-1 ${rowGrid(se.leftRight)} ${saved ? 'bg-weights/10' : ''}`}>
      <button
        onClick={onLabel}
        aria-label={`${t('set.rowMenu')} ${label}${pr ? ` · ${t('pr.badge')}` : ''}`}
        className={`flex h-11 flex-col items-center justify-center rounded-md text-[15px] font-semibold leading-none ${rowType(row) === 'warmup' ? 'text-muted' : ''}`}
      >
        {label}
        {pr && <span className="mt-0.5 rounded bg-weights px-1 text-[9px] font-bold leading-[14px] text-white">PR</span>}
      </button>
      <button
        onClick={() => canCopy && change(copyFrom!)}
        disabled={!canCopy}
        aria-label={prev ? `${t('set.copyPrev')} ${setSummary(prev, se, unit)}` : canCopy ? t('set.copyAbove') : undefined}
        aria-hidden={!prev && !canCopy}
        className="flex h-11 min-w-0 items-center justify-center rounded-md text-[12px] leading-tight text-muted disabled:opacity-100"
      >
        {prev ? <span className="truncate">{setSummary(prev, se, unit)}</span> : canCopy ? <CopyPlus size={16} aria-hidden /> : '–'}
      </button>
      {input('weight', weightHint, t('set.weight'))}
      {se.leftRight ? (
        <>
          {input('left', t('set.left'), `${valueHint} ${t('set.left')}`)}
          {input('right', t('set.right'), `${valueHint} ${t('set.right')}`)}
        </>
      ) : (
        input('value', valueHint, valueHint)
      )}
      <button
        onClick={toggleFailure}
        aria-pressed={failure}
        aria-label={t('set.failure')}
        className={`flex h-11 items-center justify-center rounded-md text-[14px] ${failure ? 'bg-weights/15 font-semibold text-weights' : 'text-muted'}`}
      >
        F
      </button>
      <button
        onClick={confirm}
        aria-label={saved ? t('set.saved') : t('set.save')}
        className={`flex h-11 w-11 items-center justify-center rounded-lg ${saved ? 'bg-weights text-white' : 'border border-line text-muted'}`}
      >
        <Check size={20} aria-hidden />
      </button>
    </div>
  )
}

/** Column titles above the set rows. */
export function SetHeader({ se, unit }: { se: SessionExercise; unit: WeightUnit }) {
  const t = useT()
  return (
    <div className={`grid gap-1 pb-1 text-center text-[12px] text-muted ${rowGrid(se.leftRight)}`}>
      <span>{t('set.set')}</span>
      <span>{t('set.prev')}</span>
      <span>{se.bodyweight || se.timed ? `+${unit}` : unit}</span>
      {se.leftRight ? (
        <><span>{t('set.left')}</span><span>{t('set.right')}</span></>
      ) : (
        <span>{se.timed ? t('set.sec') : t('set.reps')}</span>
      )}
      <span>F</span>
      <span />
    </div>
  )
}
