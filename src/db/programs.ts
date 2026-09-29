import type { Table } from 'dexie'
import { db } from './db'
import type { BodyPart, Exercise } from './types'
import { BODY_PARTS, bodyPartOf } from '../lib/exercises'

/** Defaults when an exercise is added to a program day; every value can be edited per exercise. */
export const DAY_DEFAULTS = { sets: 2, repMin: 6, repMax: 8, timedMin: 30, timedMax: 60 }

/** Order for a row appended after the existing ones (rows may have gaps after deletes). */
export const nextOrder = (rows: { order: number }[]) => rows.reduce((m, r) => Math.max(m, r.order + 1), 0)

// Booleans cannot be indexed, so the active program is found with a filter (there are only a few).
export const getActiveProgram = () => db.programs.filter((p) => p.isActive).first()

export async function createProgram(name: string) {
  return db.transaction('rw', db.programs, async () => {
    const hasActive = !!(await getActiveProgram())
    return db.programs.add({ name, isActive: !hasActive, createdAt: Date.now() })
  })
}

export async function setActiveProgram(id: number) {
  await db.transaction('rw', db.programs, async () => {
    await db.programs.filter((p) => p.isActive && p.id !== id).modify({ isActive: false })
    await db.programs.update(id, { isActive: true })
  })
}

/** Removes the program, its days and their exercises. Sessions keep their own copies, so history is untouched. */
export async function deleteProgram(id: number) {
  await db.transaction('rw', db.programs, db.programDays, db.programExercises, async () => {
    const dayIds = (await db.programDays.where('programId').equals(id).primaryKeys()) as number[]
    await db.programExercises.where('dayId').anyOf(dayIds).delete()
    await db.programDays.bulkDelete(dayIds)
    await db.programs.delete(id)
  })
}

export async function addDay(programId: number, name: string) {
  const order = nextOrder(await db.programDays.where('programId').equals(programId).toArray())
  return db.programDays.add({ programId, name, bodyParts: [], order })
}

export async function deleteDay(dayId: number) {
  await db.transaction('rw', db.programDays, db.programExercises, async () => {
    await db.programExercises.where('dayId').equals(dayId).delete()
    await db.programDays.delete(dayId)
  })
}

export async function addDayExercise(dayId: number, ex: Exercise, restSec: number) {
  const order = nextOrder(await db.programExercises.where('dayId').equals(dayId).toArray())
  return db.programExercises.add({
    dayId, exerciseId: ex.id!, order,
    targetSets: DAY_DEFAULTS.sets,
    repMin: ex.timed ? DAY_DEFAULTS.timedMin : DAY_DEFAULTS.repMin,
    repMax: ex.timed ? DAY_DEFAULTS.timedMax : DAY_DEFAULTS.repMax,
    restSec
  })
}

/** Body parts of a program day, worked out from its exercises. */
export async function dayBodyParts(dayId: number): Promise<BodyPart[]> {
  const rows = await db.programExercises.where('dayId').equals(dayId).toArray()
  const exs = await db.exercises.bulkGet(rows.map((r) => r.exerciseId))
  const parts = new Set(exs.map((e) => (e ? bodyPartOf(e) : undefined)))
  return BODY_PARTS.filter((p) => parts.has(p))
}

/** Swaps a row with its neighbour and renumbers the list, so orders stay 0..n-1. */
export async function moveRow<T extends { id?: number; order: number }>(
  table: Table<T, number>, rows: T[], id: number, dir: -1 | 1
) {
  const sorted = [...rows].sort((a, b) => a.order - b.order)
  const i = sorted.findIndex((r) => r.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= sorted.length) return
  ;[sorted[i], sorted[j]] = [sorted[j], sorted[i]]
  await db.transaction('rw', table, async () => {
    for (let k = 0; k < sorted.length; k++) {
      if (sorted[k].order !== k) await table.update(sorted[k].id!, { order: k } as never)
    }
  })
}
