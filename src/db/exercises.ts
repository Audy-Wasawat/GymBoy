import { db } from './db'
import type { BodyPart, Equipment, Exercise, Muscle } from './types'

export interface NewExercise {
  name: string
  equipment: Equipment
  bodyPart?: BodyPart
  primaryMuscles: Muscle[]
  secondaryMuscles: Muscle[]
  leftRight: boolean
  timed: boolean
}

/** Trimmed, with runs of spaces made single. */
export const tidyName = (name: string) => name.normalize('NFC').trim().replace(/\s+/g, ' ')

/** Creates a custom exercise (no photo, no seed key) and returns it with its id. */
export async function createExercise(v: NewExercise): Promise<Exercise> {
  const exercise: Exercise = {
    name: tidyName(v.name), equipment: v.equipment, bodyPart: v.bodyPart,
    primaryMuscles: v.primaryMuscles, secondaryMuscles: v.secondaryMuscles,
    leftRight: v.leftRight, timed: v.timed, bodyweight: v.equipment === 'bodyweight', isCustom: true
  }
  const id = await db.exercises.add(exercise)
  return { ...exercise, id }
}

/** An exercise with this name, ignoring case and surrounding spaces. */
export async function findExerciseByName(name: string): Promise<Exercise | undefined> {
  const key = tidyName(name).toLowerCase()
  if (!key) return undefined
  return db.exercises.filter((e) => tidyName(e.name).toLowerCase() === key).first()
}
