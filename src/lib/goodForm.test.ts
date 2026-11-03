import { describe, expect, it } from 'vitest'
import { weightHint } from './progress'
import type { SessionExercise, SetLog } from '../db/types'

const se: SessionExercise = {
  id: 1, sessionId: 1, exerciseId: 1, order: 0, name: 'Bench Press', equipment: 'barbell',
  leftRight: false, bodyweight: false, timed: false, targetSets: 3, repMin: 6, repMax: 8, restSec: 90
}
const set = (p: Partial<SetLog>): SetLog => ({
  sessionExerciseId: 1, setNumber: 0, type: 'working', exerciseId: 1, date: '2026-11-01', toFailure: false, ...p
})

describe('the add-weight hint needs good form on every set', () => {
  const full = (form: (boolean | undefined)[]) => form.map((goodForm, i) => set({ setNumber: i, weightKg: 60, reps: 8, goodForm }))

  it('shows when every working set hit the top reps with good form', () => {
    expect(weightHint({ se, sets: full([true, true, true]) }, [])).toMatchObject({ top: 8, weightKg: 60 })
  })

  it('stays hidden when one set was not ticked as good form', () => {
    expect(weightHint({ se, sets: full([true, undefined, true]) }, [])).toBeUndefined()
    expect(weightHint({ se, sets: full([true, false, true]) }, [])).toBeUndefined()
  })

  it('stays hidden when the form was good but the reps fell short', () => {
    const sets = [set({ weightKg: 60, reps: 8, goodForm: true }), set({ weightKg: 60, reps: 7, goodForm: true }), set({ weightKg: 60, reps: 8, goodForm: true })]
    expect(weightHint({ se, sets }, [])).toBeUndefined()
  })

  it('warm-ups do not need a form tick', () => {
    const sets = [set({ type: 'warmup', weightKg: 40, reps: 10 }), ...full([true, true, true])]
    expect(weightHint({ se, sets }, [])).toMatchObject({ top: 8 })
  })
})
