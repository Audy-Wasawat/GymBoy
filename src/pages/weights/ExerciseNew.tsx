import { useNavigate } from 'react-router-dom'
import { Page } from '../../components/Page'
import { createExercise } from '../../db/exercises'
import { useT } from '../../i18n/useT'
import { ExerciseForm } from './ExerciseForm'

export function ExerciseNew() {
  const t = useT()
  const navigate = useNavigate()
  return (
    <Page title={t('ex.newTitle')} back="/weights/exercises">
      <ExerciseForm
        saveLabel={t('ex.save')}
        onSave={async (values) => {
          const ex = await createExercise(values)
          navigate(`/weights/exercises/${ex.id}`, { replace: true })
        }}
        onUseExisting={(ex) => navigate(`/weights/exercises/${ex.id}`, { replace: true })}
      />
    </Page>
  )
}
