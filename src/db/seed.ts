import seeds from '../data/exercises.json'
import { db } from './db'
import type { BodyPart, Equipment, Exercise, Muscle } from './types'

interface Seed {
  key: string; name: string; equipment: string; bodyPart: string; image?: string
  primaryMuscles: string[]; secondaryMuscles: string[]; leftRight: boolean; timed: boolean; bodyweight: boolean
}

/**
 * Adds seeded exercises that are not in the database yet, matched by seedKey.
 * Existing rows are never touched, so the owner's edits to a seeded exercise survive app updates.
 */
export async function seedExercises() {
  await db.transaction('rw', db.exercises, async () => {
    const have = new Set((await db.exercises.orderBy('seedKey').uniqueKeys()) as string[])
    const missing: Exercise[] = (seeds as Seed[])
      .filter((s) => !have.has(s.key))
      .map((s) => ({
        name: s.name,
        equipment: s.equipment as Equipment,
        bodyPart: s.bodyPart as BodyPart,
        seedKey: s.key,
        image: s.image,
        primaryMuscles: s.primaryMuscles as Muscle[],
        secondaryMuscles: s.secondaryMuscles as Muscle[],
        leftRight: s.leftRight,
        bodyweight: s.bodyweight,
        timed: s.timed,
        isCustom: false
      }))
    if (missing.length) await db.exercises.bulkAdd(missing)
  })
}
