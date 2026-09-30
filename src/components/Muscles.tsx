import type { Muscle } from '../db/types'
import { useT } from '../i18n/useT'
import { MUSCLES } from '../lib/exercises'

// Primary muscles are drawn dark and secondary lighter, matching the body model to come in phase 8.
const PRIMARY = 'border-weights bg-weights text-white font-semibold'
const SECONDARY = 'border-weights/40 bg-weights/15 text-ink'
const NONE = 'border-line bg-surface text-muted'

export function MuscleList({ primary, secondary }: { primary: Muscle[]; secondary: Muscle[] }) {
  const t = useT()
  if (primary.length + secondary.length === 0) return <p className="text-[15px] text-muted">{t('ex.noMuscles')}</p>
  return (
    <div className="flex flex-col gap-3">
      {[{ label: t('ex.primary'), list: primary, cls: PRIMARY }, { label: t('ex.secondary'), list: secondary, cls: SECONDARY }]
        .filter((g) => g.list.length > 0)
        .map((g) => (
          <div key={g.label}>
            <div className="mb-1.5 text-[13px] text-muted">{g.label}</div>
            <div className="flex flex-wrap gap-1.5">
              {g.list.map((m) => (
                <span key={m} className={`rounded-full border px-3 py-1 text-[14px] ${g.cls}`}>{t(`muscle.${m}`)}</span>
              ))}
            </div>
          </div>
        ))}
    </div>
  )
}

/** Compact primary-then-secondary chips for list rows. */
export function MuscleChips({ primary, secondary }: { primary: Muscle[]; secondary: Muscle[] }) {
  const t = useT()
  if (primary.length + secondary.length === 0) return null
  return (
    <span className="flex flex-wrap gap-1">
      {primary.map((m) => <span key={m} className={`rounded-full border px-2 py-px text-[12px] ${PRIMARY}`}>{t(`muscle.${m}`)}</span>)}
      {secondary.map((m) => <span key={m} className={`rounded-full border px-2 py-px text-[12px] ${SECONDARY}`}>{t(`muscle.${m}`)}</span>)}
    </span>
  )
}

/** Chip-based muscle picker used until the body model arrives. Each tap cycles none → primary → secondary. */
export function MusclePicker({ primary, secondary, onChange }: {
  primary: Muscle[]; secondary: Muscle[]; onChange: (primary: Muscle[], secondary: Muscle[]) => void
}) {
  const t = useT()
  const cycle = (m: Muscle) => {
    if (primary.includes(m)) onChange(primary.filter((x) => x !== m), [...secondary, m])
    else if (secondary.includes(m)) onChange(primary, secondary.filter((x) => x !== m))
    else onChange([...primary, m], secondary)
  }
  return (
    <div>
      <p className="mb-2 text-[13px] text-muted">{t('ex.pickerHint')}</p>
      <div className="flex flex-wrap gap-2">
        {MUSCLES.map((m) => {
          const state = primary.includes(m) ? 'primary' : secondary.includes(m) ? 'secondary' : 'none'
          const cls = state === 'primary' ? PRIMARY : state === 'secondary' ? SECONDARY : NONE
          return (
            <button
              key={m}
              onClick={() => cycle(m)}
              aria-label={`${t(`muscle.${m}`)}: ${state === 'primary' ? t('ex.primary') : state === 'secondary' ? t('ex.secondary') : '-'}`}
              aria-pressed={state !== 'none'}
              className={`min-h-[44px] rounded-full border px-3.5 text-[15px] ${cls}`}
            >
              {/* A mark as well as a colour, so the state is not carried by colour alone. */}
              {state !== 'none' && <span aria-hidden className="mr-1">{state === 'primary' ? '●' : '◐'}</span>}
              {t(`muscle.${m}`)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
