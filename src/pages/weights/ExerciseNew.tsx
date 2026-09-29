import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MusclePicker } from '../../components/Muscles'
import { Page } from '../../components/Page'
import { db } from '../../db/db'
import type { BodyPart, Equipment, Muscle } from '../../db/types'
import { useT } from '../../i18n/useT'
import { DetailFields, LoggingFields } from './ExerciseFields'

export function ExerciseNew() {
  const t = useT()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [equipment, setEquipment] = useState<Equipment>('barbell')
  const [bodyPart, setBodyPart] = useState<BodyPart>()
  const [leftRight, setLeftRight] = useState(false)
  const [timed, setTimed] = useState(false)
  const [primary, setPrimary] = useState<Muscle[]>([])
  const [secondary, setSecondary] = useState<Muscle[]>([])
  const [error, setError] = useState(false)

  const save = async () => {
    if (!name.trim()) { setError(true); return }
    const id = await db.exercises.add({
      name: name.trim(), equipment, bodyPart,
      primaryMuscles: primary, secondaryMuscles: secondary,
      leftRight, timed, bodyweight: equipment === 'bodyweight', isCustom: true
    })
    navigate(`/weights/exercises/${id}`, { replace: true })
  }

  return (
    <Page title={t('ex.newTitle')} back="/weights/exercises">
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
          <MusclePicker primary={primary} secondary={secondary} onChange={(p, s) => { setPrimary(p); setSecondary(s) }} />
        </div>
      </section>

      <button onClick={save} className="min-h-[52px] w-full rounded-xl bg-weights text-[17px] font-semibold text-white">
        {t('ex.save')}
      </button>
    </Page>
  )
}
