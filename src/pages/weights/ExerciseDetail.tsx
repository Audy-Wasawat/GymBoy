import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Copy, LineChart } from 'lucide-react'
import { BodyModel } from '../../components/BodyModel'
import { BodyModelPicker } from '../../components/BodyModelPicker'
import { MuscleList } from '../../components/Muscles'
import { Page, Section } from '../../components/Page'
import { db } from '../../db/db'
import type { Exercise } from '../../db/types'
import { useT } from '../../i18n/useT'
import { DetailFields, LoggingFields } from './ExerciseFields'

const BACK = '/weights/exercises'

export function ExerciseDetail() {
  const t = useT()
  const navigate = useNavigate()
  const id = Number(useParams().id)
  // null = loaded but missing; undefined = still loading.
  const ex = useLiveQuery(async () => (await db.exercises.get(id)) ?? null, [id])
  const [editingMuscles, setEditingMuscles] = useState(false)
  const [name, setName] = useState('')
  useEffect(() => { if (ex) setName(ex.name) }, [ex?.id, ex?.name])

  if (ex === undefined) return null
  if (ex === null) return <Page title={t('ex.notFound')} back={BACK}>{null}</Page>

  // Edits change the library entry only; sessions keep the values they copied when logged.
  const update = (patch: Partial<Exercise>) => db.exercises.update(id, patch)

  const duplicate = async () => {
    const { id: _id, seedKey: _seedKey, ...rest } = ex
    const newId = await db.exercises.add({ ...rest, name: `${ex.name} ${t('ex.copySuffix')}`, isCustom: true })
    navigate(`/weights/exercises/${newId}`, { replace: true })
  }

  return (
    <Page title={ex.name} back={BACK}>
      <p className="-mt-2 mb-4 text-[15px] text-muted">
        {[t(`equip.${ex.equipment}`), ex.isCustom && t('ex.custom')].filter(Boolean).join(' · ')}
      </p>

      <section className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-muted">{t('ex.muscles')}</h2>
          <button onClick={() => setEditingMuscles(!editingMuscles)} className="min-h-[44px] px-2 text-[15px] font-semibold text-weights">
            {editingMuscles ? t('ex.doneEditing') : t('ex.editMuscles')}
          </button>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          {editingMuscles ? (
            <BodyModelPicker
              primary={ex.primaryMuscles}
              secondary={ex.secondaryMuscles}
              onChange={(primaryMuscles, secondaryMuscles) => update({ primaryMuscles, secondaryMuscles })}
            />
          ) : (
            <>
              <BodyModel primary={ex.primaryMuscles} secondary={ex.secondaryMuscles} height={240} className="mx-auto mb-4 block" />
              <MuscleList primary={ex.primaryMuscles} secondary={ex.secondaryMuscles} />
            </>
          )}
        </div>
      </section>

      <LoggingFields
        leftRight={ex.leftRight}
        timed={ex.timed}
        onLeftRight={(leftRight) => update({ leftRight })}
        onTimed={(timed) => update({ timed })}
        showNote
      />

      {ex.isCustom && (
        <DetailFields
          name={name}
          equipment={ex.equipment}
          bodyPart={ex.bodyPart}
          onName={setName}
          onNameBlur={() => { if (name.trim()) update({ name: name.trim() }); else setName(ex.name) }}
          onEquipment={(equipment) => update({ equipment, bodyweight: equipment === 'bodyweight' })}
          onBodyPart={(bodyPart) => update({ bodyPart })}
        />
      )}

      <Section>
        <Link to={`/weights/exercises/${id}/history`} className="flex min-h-[52px] w-full items-center gap-3 border-b border-line px-4">
          <LineChart size={20} className="text-weights" aria-hidden />
          <span className="flex-1 text-[16px]">{t('history.exercise')}</span>
          <ChevronRight size={18} className="text-muted" aria-hidden />
        </Link>
        <button onClick={duplicate} className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left">
          <Copy size={20} className="text-muted" aria-hidden />
          <span className="flex-1 text-[16px]">{t('ex.duplicate')}</span>
        </button>
      </Section>
    </Page>
  )
}
