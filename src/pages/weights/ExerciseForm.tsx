import { useRef, useState } from 'react'
import { BodyModelPicker } from '../../components/BodyModelPicker'
import { Sheet, SheetButton } from '../../components/Sheet'
import { findExerciseByName, type NewExercise } from '../../db/exercises'
import type { BodyPart, Equipment, Exercise, Muscle } from '../../db/types'
import { useT } from '../../i18n/useT'
import { DetailFields, LoggingFields } from './ExerciseFields'

/**
 * The form for a new custom exercise, shared by the New exercise screen and by "create in the
 * picker": name, equipment, body part (optional), left/right and timed switches, and the primary
 * and secondary muscles chosen on the body model. A name that already exists (ignoring case) only
 * warns; the owner can use the existing exercise or create the new one anyway.
 */
export function ExerciseForm({ initialName = '', saveLabel, onSave, onUseExisting }: {
  initialName?: string
  saveLabel: string
  onSave: (values: NewExercise) => void | Promise<void>
  onUseExisting: (existing: Exercise) => void
}) {
  const t = useT()
  const [name, setName] = useState(initialName)
  const [equipment, setEquipment] = useState<Equipment>('barbell')
  const [bodyPart, setBodyPart] = useState<BodyPart>()
  const [leftRight, setLeftRight] = useState(false)
  const [timed, setTimed] = useState(false)
  const [primary, setPrimary] = useState<Muscle[]>([])
  const [secondary, setSecondary] = useState<Muscle[]>([])
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [duplicate, setDuplicate] = useState<Exercise>()

  const values = (): NewExercise => ({
    name: name.trim(), equipment, bodyPart, primaryMuscles: primary, secondaryMuscles: secondary, leftRight, timed
  })
  // A ref, not only state: two taps in the same moment both see the old state.
  const working = useRef(false)
  const run = async (job: () => Promise<void>) => {
    if (working.current) return
    working.current = true
    setBusy(true)
    try { await job() } finally { working.current = false; setBusy(false) }
  }
  const create = () => run(async () => { await onSave(values()) })
  const save = async () => {
    if (!name.trim()) { setError(true); return }
    await run(async () => {
      const existing = await findExerciseByName(name)
      if (existing) setDuplicate(existing)
      else await onSave(values())
    })
  }

  return (
    <>
      <DetailFields
        name={name}
        equipment={equipment}
        bodyPart={bodyPart}
        onName={(v) => { setName(v); setError(false) }}
        onEquipment={setEquipment}
        onBodyPart={setBodyPart}
      />
      {error && <p role="alert" className="-mt-3 mb-5 px-1 text-[14px] text-weights">{t('ex.nameRequired')}</p>}

      <LoggingFields leftRight={leftRight} timed={timed} onLeftRight={setLeftRight} onTimed={setTimed} />

      <section className="mb-5">
        <h2 className="mb-2 text-[15px] font-semibold text-muted">{t('ex.muscles')}</h2>
        <div className="rounded-xl border border-line bg-surface p-4">
          <BodyModelPicker primary={primary} secondary={secondary} onChange={(p, s) => { setPrimary(p); setSecondary(s) }} />
        </div>
      </section>

      <button
        onClick={save}
        disabled={busy}
        className="min-h-[52px] w-full rounded-xl bg-weights text-[17px] font-semibold text-white disabled:opacity-50"
      >
        {saveLabel}
      </button>

      <Sheet open={!!duplicate} onClose={() => setDuplicate(undefined)} title={t('ex.dupTitle')}>
        <p className="mb-4 text-[15px] text-muted">{t('ex.dupBody').replace('{name}', duplicate?.name ?? name.trim())}</p>
        <SheetButton tone="primary" onClick={() => { const e = duplicate!; setDuplicate(undefined); onUseExisting(e) }}>
          {t('ex.dupUse')}
        </SheetButton>
        <SheetButton onClick={() => { setDuplicate(undefined); void create() }}>{t('ex.dupCreate')}</SheetButton>
        <SheetButton onClick={() => setDuplicate(undefined)}>{t('ex.dupBack')}</SheetButton>
      </Sheet>
    </>
  )
}
