// Importing a backup without replacing what the phone already holds. Rows from the file that the
// phone does not have yet are added (with new ids, and links between them rewired); rows it already
// has are skipped, so importing the same file twice changes nothing. The phone's settings, goals
// and anything edited on the phone win over the file.

import { db } from '../db/db'
import { prunePhotos } from '../db/photoStore'
import { recomputeAllBodyParts } from '../db/sessions'
import { seedExercises } from '../db/seed'
import type {
  Activity, BodyEntry, Exercise, Food, FoodEntry, Program, ProgramDay, ProgramExercise, RunLog, RunTemplate,
  SessionExercise, SetDraft, SetLog, Shoe, WorkoutSession
} from '../db/types'
import { prepareBackup } from './backup'

export interface MergeResult {
  added: { sessions: number; runs: number; foodEntries: number; activities: number; bodyEntries: number }
  /** Rows the phone already had (same day and values), left as they are. */
  skipped: number
  photosLost: number
}

type Row = Record<string, unknown>
const num = (v: unknown) => (typeof v === 'number' ? v : undefined)
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase()
/** Drops the id so the row gets a fresh one on this phone. */
const fresh = <T>(r: Row): T => { const { id: _id, ...rest } = r; return rest as T }

// What makes two rows "the same record" when they come from different phones.
const sessionKey = (s: { date?: unknown; startedAt?: unknown }) => `${s.date}|${s.startedAt ?? ''}`
const runKey = (r: { date?: unknown; distanceKm?: unknown; durationSec?: unknown }) => `${r.date}|${r.distanceKm}|${r.durationSec}`
const activityKey = (a: { date?: unknown; sport?: unknown; minutes?: unknown; durationSec?: unknown }) =>
  `${a.date}|${norm(a.sport)}|${a.durationSec ?? (num(a.minutes) ?? 0) * 60}`
const foodEntryKey = (e: { date?: unknown; time?: unknown; name?: unknown }) => `${e.date}|${e.time}|${norm(e.name)}`
const bodyKey = (b: { date?: unknown; weightKg?: unknown }) => `${b.date}|${b.weightKg}`

export async function mergeBackup(data: Record<string, unknown[]>): Promise<MergeResult> {
  const prepared = await prepareBackup(data)
  const t = prepared.tables
  const added = { sessions: 0, runs: 0, foodEntries: 0, activities: 0, bodyEntries: 0 }
  let skipped = 0

  await db.transaction('rw', [
    db.exercises, db.programs, db.programDays, db.programExercises,
    db.sessions, db.sessionExercises, db.sets, db.setDrafts,
    db.runs, db.runTemplates, db.shoes,
    db.activities, db.foods, db.foodEntries, db.bodyEntries, db.photos
  ], async () => {
    // Photos: the store is keyed by content, so adding is the same as merging.
    await db.photos.bulkPut(prepared.photos)

    // Exercises: seeded ones match by seed key, custom ones by name and equipment.
    const exercises = await db.exercises.toArray()
    const bySeed = new Map(exercises.filter((e) => e.seedKey).map((e) => [e.seedKey!, e.id!]))
    const byName = new Map(exercises.map((e) => [`${norm(e.name)}|${e.equipment}`, e.id!]))
    const exId = new Map<number, number>()
    for (const e of t.exercises) {
      const id = num(e.id)
      if (id === undefined) continue
      const match = (typeof e.seedKey === 'string' && bySeed.get(e.seedKey)) || byName.get(`${norm(e.name)}|${e.equipment}`)
      if (match) { exId.set(id, match); continue }
      const newId = await db.exercises.add(fresh<Exercise>(e))
      byName.set(`${norm(e.name)}|${e.equipment}`, newId)
      exId.set(id, newId)
    }
    const mapEx = (id: unknown) => exId.get(num(id) ?? -1) ?? num(id)!

    // Shoes and interval templates by name.
    const shoeByName = new Map((await db.shoes.toArray()).map((s) => [norm(s.name), s.id!]))
    const shoeId = new Map<number, number>()
    for (const s of t.shoes) {
      const id = num(s.id)
      if (id === undefined) continue
      shoeId.set(id, shoeByName.get(norm(s.name)) ?? await db.shoes.add(fresh<Shoe>(s)))
    }
    const templateNames = new Set((await db.runTemplates.toArray()).map((x) => norm(x.name)))
    for (const x of t.runTemplates) if (!templateNames.has(norm(x.name))) await db.runTemplates.add(fresh<RunTemplate>(x))

    // Library foods by name (the phone's version wins).
    const foodByName = new Map((await db.foods.toArray()).map((f) => [norm(f.name), f.id!]))
    const foodId = new Map<number, number>()
    for (const f of t.foods) {
      const id = num(f.id)
      if (id === undefined) continue
      const match = foodByName.get(norm(f.name))
      const newId = match ?? await db.foods.add(fresh<Food>(f))
      foodByName.set(norm(f.name), newId)
      foodId.set(id, newId)
    }

    // Programs by name: one the phone already has is kept as it is. Imported ones are never made
    // active over the phone's active program.
    const programs = await db.programs.toArray()
    const programNames = new Set(programs.map((p) => norm(p.name)))
    const hasActive = programs.some((p) => p.isActive)
    const programId = new Map<number, number>()
    for (const p of t.programs) {
      const id = num(p.id)
      if (id === undefined || programNames.has(norm(p.name))) continue
      programId.set(id, await db.programs.add({ ...fresh<Program>(p), isActive: hasActive ? false : !!p.isActive }))
    }
    const dayId = new Map<number, number>()
    for (const d of t.programDays) {
      const pid = programId.get(num(d.programId) ?? -1)
      if (pid === undefined) continue
      dayId.set(num(d.id)!, await db.programDays.add({ ...fresh<ProgramDay>(d), programId: pid }))
    }
    for (const pe of t.programExercises) {
      const did = dayId.get(num(pe.dayId) ?? -1)
      if (did === undefined) continue
      await db.programExercises.add({ ...fresh<ProgramExercise>(pe), dayId: did, exerciseId: mapEx(pe.exerciseId) })
    }

    // Workout sessions: the same session is the same day and start time.
    const sessions = await db.sessions.toArray()
    const knownSessions = new Set(sessions.map(sessionKey))
    let phoneHasOpen = sessions.some((s) => !s.finishedAt)
    const sessionId = new Map<number, number>()
    const openImported = new Set<number>()
    for (const s of t.sessions) {
      const id = num(s.id)
      if (id === undefined) continue
      if (knownSessions.has(sessionKey(s))) { skipped++; continue }
      const row = { ...fresh<WorkoutSession>(s), restEndsAt: undefined, restTotalSec: undefined }
      if (!row.finishedAt) {
        // Only one session can be open: a second one comes in finished.
        if (phoneHasOpen) row.finishedAt = row.startedAt || Date.now()
        else { phoneHasOpen = true; openImported.add(id) }
      }
      if (row.programId !== undefined) row.programId = programId.get(row.programId) ?? row.programId
      sessionId.set(id, await db.sessions.add(row))
      added.sessions++
    }
    const seId = new Map<number, number>()
    for (const se of t.sessionExercises) {
      const sid = sessionId.get(num(se.sessionId) ?? -1)
      if (sid === undefined) continue
      seId.set(num(se.id)!, await db.sessionExercises.add({ ...fresh<SessionExercise>(se), sessionId: sid, exerciseId: mapEx(se.exerciseId) }))
    }
    for (const set of t.sets) {
      const sid = seId.get(num(set.sessionExerciseId) ?? -1)
      if (sid === undefined) continue
      await db.sets.add({ ...fresh<SetLog>(set), sessionExerciseId: sid, exerciseId: mapEx(set.exerciseId) })
    }
    // Typed-but-unsaved rows only come along with the session that stays open.
    const openSe = new Set(t.sessionExercises.filter((se) => openImported.has(num(se.sessionId) ?? -1)).map((se) => num(se.id)))
    for (const d of t.setDrafts) {
      const sid = seId.get(num(d.sessionExerciseId) ?? -1)
      if (sid === undefined || !openSe.has(num(d.sessionExerciseId))) continue
      await db.setDrafts.add({ ...fresh<SetDraft>(d), sessionExerciseId: sid })
    }

    // Runs, activities, food entries and weigh-ins: the same record has the same day and values.
    const runKeys = new Set((await db.runs.toArray()).map(runKey))
    for (const r of t.runs) {
      if (runKeys.has(runKey(r))) { skipped++; continue }
      const row = fresh<RunLog>(r)
      if (row.shoeId !== undefined) row.shoeId = shoeId.get(row.shoeId)
      await db.runs.add(row)
      runKeys.add(runKey(r))
      added.runs++
    }
    const actKeys = new Set((await db.activities.toArray()).map(activityKey))
    for (const a of t.activities) {
      if (actKeys.has(activityKey(a))) { skipped++; continue }
      await db.activities.add(fresh<Activity>(a))
      actKeys.add(activityKey(a))
      added.activities++
    }
    const entryKeys = new Set((await db.foodEntries.toArray()).map(foodEntryKey))
    for (const e of t.foodEntries) {
      if (entryKeys.has(foodEntryKey(e))) { skipped++; continue }
      const row = fresh<FoodEntry>(e)
      if (row.foodId !== undefined) row.foodId = foodId.get(row.foodId)
      await db.foodEntries.add(row)
      entryKeys.add(foodEntryKey(e))
      added.foodEntries++
    }
    const bodyKeys = new Set((await db.bodyEntries.toArray()).map(bodyKey))
    for (const b of t.bodyEntries) {
      if (bodyKeys.has(bodyKey(b))) { skipped++; continue }
      await db.bodyEntries.add(fresh<BodyEntry>(b))
      bodyKeys.add(bodyKey(b))
      added.bodyEntries++
    }
  })

  await prunePhotos()
  await seedExercises()
  await recomputeAllBodyParts()
  return { added, skipped, photosLost: prepared.photosLost }
}
