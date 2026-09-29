import { db, ensureSettings } from '../db/db'
import { seedExercises } from '../db/seed'
import { localDate, parseLocalDate } from './dates'
import { paceSecPerKm as calcPace } from './running'

const SCHEMA_VERSION = 2
const APP_VERSION = '0.1.0'
const FORMAT = 'gymboy-backup'

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  const bytes = atob(b64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

export interface BackupCounts {
  sessions: number
  runs: number
  foodEntries: number
  activities: number
  bodyEntries: number
}

/** Creates a full backup JSON blob (photos serialised as data URLs). */
export async function createBackup(): Promise<Blob> {
  const [
    exercises, programs, programDays, programExercises,
    sessions, sessionExercises, sets, setDrafts,
    runs, runTemplates, shoes,
    activities, settings,
    foods, foodEntries, bodyEntries
  ] = await Promise.all([
    db.exercises.toArray(), db.programs.toArray(), db.programDays.toArray(), db.programExercises.toArray(),
    db.sessions.toArray(), db.sessionExercises.toArray(), db.sets.toArray(), db.setDrafts.toArray(),
    db.runs.toArray(), db.runTemplates.toArray(), db.shoes.toArray(),
    db.activities.toArray(), db.settings.toArray(),
    db.foods.toArray(), db.foodEntries.toArray(), db.bodyEntries.toArray()
  ])

  // Serialise photos to data URLs
  const foodsWithPhotos = await Promise.all(foods.map(async (f) => ({
    ...f, photo: f.photo ? await blobToDataUrl(f.photo) : undefined
  })))
  const bodyWithPhotos = await Promise.all(bodyEntries.map(async (e) => ({
    ...e, photo: e.photo ? await blobToDataUrl(e.photo) : undefined
  })))

  const payload = {
    format: FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    version: APP_VERSION,
    exercises, programs, programDays, programExercises,
    sessions, sessionExercises, sets, setDrafts,
    runs, runTemplates, shoes,
    activities,
    foods: foodsWithPhotos,
    foodEntries,
    bodyEntries: bodyWithPhotos,
    settings
  }

  return new Blob([JSON.stringify(payload)], { type: 'application/json' })
}

const REQUIRED_TABLES = [
  'exercises', 'programs', 'programDays', 'programExercises',
  'sessions', 'sessionExercises', 'sets', 'setDrafts',
  'runs', 'runTemplates', 'shoes',
  'activities', 'foods', 'foodEntries', 'bodyEntries', 'settings'
]

/** Parses a backup file and returns counts without committing anything. */
export async function parseBackup(file: File): Promise<{ counts: BackupCounts; data: Record<string, unknown[]> }> {
  const text = await file.text()
  const obj = JSON.parse(text)
  if (obj.format !== FORMAT) throw new Error('invalid format')
  if (typeof obj.schemaVersion !== 'number' || obj.schemaVersion < 1 || obj.schemaVersion > SCHEMA_VERSION) throw new Error('schema too new')
  for (const key of REQUIRED_TABLES) {
    if (!Array.isArray(obj[key])) throw new Error(`invalid format: missing ${key}`)
  }
  const counts: BackupCounts = {
    sessions: (obj.sessions as unknown[]).length,
    runs: (obj.runs as unknown[]).length,
    foodEntries: (obj.foodEntries as unknown[]).length,
    activities: (obj.activities as unknown[]).length,
    bodyEntries: (obj.bodyEntries as unknown[]).length
  }
  return { counts, data: obj as Record<string, unknown[]> }
}

/** Replaces all data with the backup contents in one transaction. */
export async function restoreBackup(data: Record<string, unknown[]>): Promise<void> {
  // Migrate v1 exercises (nameEn/nameTh → name) if needed
  const schemaVersion = (data as Record<string, unknown>).schemaVersion as number
  const exercises = (data.exercises as Array<Record<string, unknown>>).map((e) =>
    schemaVersion < 2 ? { ...e, name: (e.nameEn ?? e.nameTh ?? '') as string, timed: false } : e
  )

  // Convert photo data URLs back to Blobs
  const foods = (data.foods as Array<Record<string, unknown>>).map((f) => ({
    ...f,
    photo: f.photo ? dataUrlToBlob(f.photo as string) : undefined
  }))
  const bodyEntries = (data.bodyEntries as Array<Record<string, unknown>>).map((e) => ({
    ...e,
    photo: e.photo ? dataUrlToBlob(e.photo as string) : undefined
  }))

  await db.transaction('rw', [
    db.exercises, db.programs, db.programDays, db.programExercises,
    db.sessions, db.sessionExercises, db.sets, db.setDrafts,
    db.runs, db.runTemplates, db.shoes,
    db.activities, db.foods, db.foodEntries, db.bodyEntries, db.settings
  ], async () => {
    await Promise.all([
      db.exercises.clear(), db.programs.clear(), db.programDays.clear(), db.programExercises.clear(),
      db.sessions.clear(), db.sessionExercises.clear(), db.sets.clear(), db.setDrafts.clear(),
      db.runs.clear(), db.runTemplates.clear(), db.shoes.clear(),
      db.activities.clear(), db.foods.clear(), db.foodEntries.clear(), db.bodyEntries.clear(), db.settings.clear()
    ])
    await Promise.all([
      db.exercises.bulkAdd(exercises as never[]),
      db.programs.bulkAdd(data.programs as never[]),
      db.programDays.bulkAdd(data.programDays as never[]),
      db.programExercises.bulkAdd(data.programExercises as never[]),
      db.sessions.bulkAdd(data.sessions as never[]),
      db.sessionExercises.bulkAdd(data.sessionExercises as never[]),
      db.sets.bulkAdd(data.sets as never[]),
      db.setDrafts.bulkAdd(data.setDrafts as never[]),
      db.runs.bulkAdd(data.runs as never[]),
      db.runTemplates.bulkAdd(data.runTemplates as never[]),
      db.shoes.bulkAdd(data.shoes as never[]),
      db.activities.bulkAdd(data.activities as never[]),
      db.foods.bulkAdd(foods as never[]),
      db.foodEntries.bulkAdd(data.foodEntries as never[]),
      db.bodyEntries.bulkAdd(bodyEntries as never[]),
      db.settings.bulkAdd(data.settings as never[])
    ])
  })

  // Re-seed exercises if none were in the backup
  const count = await db.exercises.count()
  if (count === 0) await seedExercises()
  await ensureSettings()
}

// ─── AI Export ────────────────────────────────────────────────────────────────

export type AICategory = 'weights' | 'running' | 'activities' | 'food' | 'body'

export interface AIExportOptions {
  from: string
  to: string
  categories: Set<AICategory>
}

export function aiPeriodPreset(preset: 'month' | '2weeks'): { from: string; to: string } {
  const today = localDate()
  if (preset === '2weeks') {
    const d = parseLocalDate(today)
    d.setDate(d.getDate() - 13)
    return { from: localDate(d), to: today }
  }
  // this month
  const d = parseLocalDate(today)
  return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, to: today }
}

export async function createAIExport(opts: AIExportOptions): Promise<Blob> {
  const { from, to, categories } = opts
  const result: Record<string, unknown> = {
    meta: {
      exportedAt: new Date().toISOString(),
      period: { from, to },
      units: { weight: 'kg', distance: 'km', duration: 'sec', energy: 'kcal', protein: 'g' },
      weeksStartOn: 'Monday',
      notes: 'pace is sec/km; run duration is sec; set duration is sec; dates are local YYYY-MM-DD'
    }
  }

  if (categories.has('weights')) {
    const sessions = await db.sessions.where('date').between(from, to, true, true).filter((s) => s.finishedAt != null).toArray()
    const sessionIds = sessions.map((s) => s.id!)
    const [sessionExercises, sets, exercises] = await Promise.all([
      db.sessionExercises.where('sessionId').anyOf(sessionIds).toArray(),
      db.sets.where('date').between(from, to, true, true).filter((s) => s.type === 'working').toArray(),
      db.exercises.toArray()
    ])
    const exMap = new Map(exercises.map((e) => [e.id!, e]))
    result.weights = sessions.map((s) => ({
      id: s.id, date: s.date, dayName: s.dayName,
      exercises: sessionExercises.filter((se) => se.sessionId === s.id).map((se) => {
        const ex = exMap.get(se.exerciseId)
        return {
          name: se.name, equipment: se.equipment,
          muscles: ex ? { primary: ex.primaryMuscles, secondary: ex.secondaryMuscles } : undefined,
          sets: sets.filter((set) => set.sessionExerciseId === se.id).map((set) => ({
            type: set.type, weightKg: set.weightKg, reps: set.reps,
            repsLeft: set.repsLeft, repsRight: set.repsRight,
            durationSec: set.durationSec, toFailure: set.toFailure
          }))
        }
      })
    }))
  }

  if (categories.has('running')) {
    const runs = await db.runs.where('date').between(from, to, true, true).toArray()
    const shoes = await db.shoes.toArray()
    const shoeMap = new Map(shoes.map((s) => [s.id!, s.name]))
    result.running = runs.map((r) => ({
      id: r.id, date: r.date, type: r.type,
      distanceKm: r.distanceKm, durationSec: r.durationSec,
      paceSecPerKm: calcPace(r.distanceKm, r.durationSec) ?? null,
      shoe: r.shoeId ? shoeMap.get(r.shoeId) : undefined,
      avgHr: r.avgHr, maxHr: r.maxHr, surface: r.surface,
      note: r.note, plan: r.plan, repResults: r.repResults
    }))
  }

  if (categories.has('activities')) {
    result.other_activities = await db.activities.where('date').between(from, to, true, true).toArray()
  }

  if (categories.has('food')) {
    const entries = await db.foodEntries.where('date').between(from, to, true, true).toArray()
    const settings = await db.settings.get('app')
    const byDay = new Map<string, { entries: typeof entries; kcal: number; proteinG: number }>()
    for (const e of entries) {
      const d = byDay.get(e.date) ?? { entries: [], kcal: 0, proteinG: 0 }
      d.entries.push(e)
      d.kcal += e.kcal
      d.proteinG += e.proteinG
      byDay.set(e.date, d)
    }
    result.food = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({
      date, totalKcal: d.kcal, totalProteinG: d.proteinG,
      goals: settings?.goals,
      entries: d.entries.map((e) => ({ name: e.name, kcal: e.kcal, proteinG: e.proteinG, portion: e.portion }))
    }))
  }

  if (categories.has('body')) {
    const entries = await db.bodyEntries.where('date').between(from, to, true, true).sortBy('date')
    result.body_weight = entries.map((e) => ({ date: e.date, weightKg: e.weightKg }))
  }

  return new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
}

// ─── Data deletion ────────────────────────────────────────────────────────────

export type DeleteCategory = 'weights' | 'runs' | 'food' | 'activities' | 'body'

export interface DeleteCounts {
  sessions: number; sets: number; runs: number
  foodEntries: number; activities: number; bodyEntries: number
}

export async function getDeleteCounts(cats: Set<DeleteCategory>): Promise<DeleteCounts> {
  const counts: DeleteCounts = { sessions: 0, sets: 0, runs: 0, foodEntries: 0, activities: 0, bodyEntries: 0 }
  if (cats.has('weights')) {
    counts.sessions = await db.sessions.count()
    counts.sets = await db.sets.count()
  }
  if (cats.has('runs')) counts.runs = await db.runs.count()
  if (cats.has('food')) counts.foodEntries = await db.foodEntries.count()
  if (cats.has('activities')) counts.activities = await db.activities.count()
  if (cats.has('body')) counts.bodyEntries = await db.bodyEntries.count()
  return counts
}

/** Deletes only history rows for the chosen categories. Library data is untouched. */
export async function clearHistory(cats: Set<DeleteCategory>): Promise<void> {
  await db.transaction('rw', [
    db.sessions, db.sessionExercises, db.sets, db.setDrafts,
    db.runs, db.foodEntries, db.activities, db.bodyEntries
  ], async () => {
    if (cats.has('weights')) {
      await db.sets.clear()
      await db.setDrafts.clear()
      await db.sessionExercises.clear()
      await db.sessions.clear()
    }
    if (cats.has('runs')) await db.runs.clear()
    if (cats.has('food')) await db.foodEntries.clear()
    if (cats.has('activities')) await db.activities.clear()
    if (cats.has('body')) await db.bodyEntries.clear()
  })
}

/** Wipes every table and re-seeds exercises. Like a fresh install. */
export async function eraseEverything(): Promise<void> {
  await db.transaction('rw', [
    db.exercises, db.programs, db.programDays, db.programExercises,
    db.sessions, db.sessionExercises, db.sets, db.setDrafts,
    db.runs, db.runTemplates, db.shoes,
    db.activities, db.foods, db.foodEntries, db.bodyEntries, db.settings
  ], async () => {
    await Promise.all([
      db.exercises.clear(), db.programs.clear(), db.programDays.clear(), db.programExercises.clear(),
      db.sessions.clear(), db.sessionExercises.clear(), db.sets.clear(), db.setDrafts.clear(),
      db.runs.clear(), db.runTemplates.clear(), db.shoes.clear(),
      db.activities.clear(), db.foods.clear(), db.foodEntries.clear(), db.bodyEntries.clear(),
      db.settings.clear()
    ])
  })
  await seedExercises()
  await ensureSettings()
}

/** Shares or downloads a file. Returns true when the share or download succeeded. */
export async function shareOrDownload(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return true
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return false
      throw e
    }
  }
  // Fallback: download link
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
  return true
}

export function backupFilename(): string {
  return `gymboy-backup-${localDate()}.json`
}

export function aiExportFilename(from: string, to: string): string {
  return `gymboy-export-${from}-${to}.json`
}
