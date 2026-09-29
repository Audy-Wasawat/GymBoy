import { useState } from 'react'
import { Check, CopyPlus } from 'lucide-react'
import { db } from '../../db/db'
import { readSetValues, saveDraft, setToText } from '../../db/sessions'
import type { SessionExercise, SetDraft, SetLog, WeightUnit } from '../../db/types'
import { useT } from '../../i18n/useT'
import { formatDuration, parseDecimal } from '../../lib/numbers'
import { unlockAudio } from '../../lib/sound'
import { fromDisplayWeight, toDisplayWeight } from '../../lib/units'

export type Row = { kind: 'draft'; draft: SetDraft } | { kind: 'set'; set: SetLog }
export const rowOrder = (r: Row) => (r.kind === 'draft' ? r.draft.order : r.set.setNumber)
export const rowType = (r: Row) => (r.kind === 'draft' ? r.draft.type : r.set.type)

type Text = { weight: string; value: string; left: string; right: string }

/** Grid columns shared by the header and the rows; left/right exercises get two value inputs. */
export const rowGrid = (lr: boolean) =>
  lr ? 'grid-cols-[28px_48px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_32px_44px]'
    : 'grid-cols-[32px_56px_minmax(0,1fr)_minmax(0,1fr)_36px_44px]'

/** Short text for a set, e.g. "60×8", "60×8/7" or "+10×0:45". */
export function setSummary(s: SetLog, se: SessionExercise, unit: WeightUnit) {
  const v = (x?: number) => (x === undefined ? '–' : se.timed ? formatDuration(x) : String(x))
  const val = se.leftRight
    ? `${v(se.timed ? s.durationLeftSec : s.repsLeft)}/${v(se.timed ? s.durationRightSec : s.repsRight)}`
    : v(se.timed ? s.durationSec : s.reps)
  if (s.weightKg === undefined) return se.timed ? val : `×${val}`
  const w = toDisplayWeight(s.weightKg, unit)
  return `${se.bodyweight || se.timed ? '+' : ''}${w}×${val}`
}

export function SetRow({ se, row, label, prev, above, unit, date, onLabel, onSaved }: {
  se: SessionExercise; row: Row; label: string; prev?: SetLog; above?: Text; unit: WeightUnit; date: string
  onLabel: () => void; onSaved: (row: SetDraft) => void
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
  const failure = row.kind === 'draft' ? row.draft.toFailure : row.set.toFailure

  // Drafts are written on every keystroke so nothing is lost if iOS closes the app.
  // Saved sets are updated whenever the edited values are complete.
  const change = (patch: Partial<Text>) => {
    const next = { ...text, ...patch }
    setText(next)
    setError(false)
    if (row.kind === 'draft') void db.setDrafts.update(row.draft.id!, 'weight' in patch ? { ...patch, unit } : patch)
    else {
      const values = readSetValues(next, se, unit)
      if (values) void db.sets.update(row.set.id!, values)
    }
  }
  const toggleFailure = () => {
    if (row.kind === 'draft') void db.setDrafts.update(row.draft.id!, { toFailure: !failure })
    else void db.sets.update(row.set.id!, { toFailure: !failure })
  }
  const confirm = async () => {
    if (row.kind !== 'draft') return
    // Must run inside the tap itself for iOS to allow sound later.
    unlockAudio()
    const draft = { ...row.draft, ...text, unit }
    if (await saveDraft(draft, se, unit, date)) onSaved(draft)
    else setError(true)
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
        aria-label={`${t('set.rowMenu')} ${label}`}
        className={`flex h-11 items-center justify-center rounded-md text-[15px] font-semibold ${rowType(row) === 'warmup' ? 'text-muted' : ''}`}
      >
        {label}
      </button>
      <button
        onClick={() => canCopy && change(copyFrom!)}
        disabled={!canCopy}
        aria-label={prev ? `${t('set.copyPrev')} ${setSummary(prev, se, unit)}` : t('set.copyAbove')}
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
