import { db, ensureSettings } from '../db/db'
import { seedExercises } from '../db/seed'
import { recomputeAllBodyParts } from '../db/sessions'
import { localDate, parseLocalDate } from './dates'
import { paceSecPerKm as calcPace } from './running'

const SCHEMA_VERSION = 3
const APP_VERSION = '0.1.0'
const FORMAT = 'gymboy-backup'

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  // In pieces, so a large photo does not overflow the argument limit of fromCharCode.
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(binary)}`
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  const bytes = atob(b64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

/** A stored photo from a backup: a data URL becomes a Blob again; anything else (missing, or a Blob that JSON turned into {}) is dropped. */
const photoFromBackup = (photo: unknown): Blob | undefined => {
  if (typeof photo !== 'string' || !photo.startsWith('data:')) return undefined
  try { return dataUrlToBlob(photo) } catch { return undefined } // damaged base64: lose that photo, not the whole restore
}

/** A row from a backup with its photo restored, or without the field when there is none. */
function restorePhoto(row: Record<string, unknown>): Record<string, unknown> {
  const { photo, ...rest } = row
  const blob = photoFromBackup(photo)
  return blob ? { ...rest, photo: blob } : rest
}

const POSES = ['front', 'side', 'back', 'other']

/**
 * A body entry from a backup with its photos restored. Schema v3 files hold `photos: [{ pose, photo }]`;
 * older files hold one `photo`, which becomes a front photo. Damaged photos are dropped.
 */
function restoreBodyPhotos(row: Record<string, unknown>): Record<string, unknown> {
  const { photo, photos, ...rest } = row
  const list: { blob: Blob; pose: string }[] = []
  if (Array.isArray(photos)) {
    for (const p of photos) {
      if (!isRow(p)) continue
      const blob = photoFromBackup(p.photo)
      if (blob) list.push({ blob, pose: POSES.includes(p.pose as string) ? (p.pose as string) : 'other' })
    }
  } else {
    const blob = photoFromBackup(photo)
    if (blob) list.push({ blob, pose: 'front' })
  }
  return list.length ? { ...rest, photos: list } : rest
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
  ] = await db.transaction('r', db.tables, () => Promise.all([
    db.exercises.toArray(), db.programs.toArray(), db.programDays.toArray(), db.programExercises.toArray(),
    db.sessions.toArray(), db.sessionExercises.toArray(), db.sets.toArray(), db.setDrafts.toArray(),
    db.runs.toArray(), db.runTemplates.toArray(), db.shoes.toArray(),
    db.activities.toArray(), db.settings.toArray(),
    db.foods.toArray(), db.foodEntries.toArray(), db.bodyEntries.toArray()
  ]))

  // Serialise photos to data URLs
  const foodsWithPhotos = await Promise.all(foods.map(async (f) => ({
    ...f, photo: f.photo ? await blobToDataUrl(f.photo) : undefined
  })))
  const bodyWithPhotos = await Promise.all(bodyEntries.map(async (e) => ({
    ...e,
    photos: e.photos?.length
      ? await Promise.all(e.photos.map(async (p) => ({ pose: p.pose, photo: await blobToDataUrl(p.blob) })))
      : undefined
  })))
  // Food entries keep their own photo; a Blob would be written as {} by JSON.stringify.
  const foodEntriesWithPhotos = await Promise.all(foodEntries.map(async (e) => ({
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
    foodEntries: foodEntriesWithPhotos,
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

const isRow = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const present = (v: unknown) => v !== undefined && v !== null
const DATE_TEXT = /^\d{4}-\d{2}-\d{2}$/

/** Fields a row may hold, checked only when present: a date text, or numbers. A wrong type is refused. */
const FIELD_RULES: Record<string, { date?: string[]; numbers?: string[] }> = {
  sessions: { date: ['date'], numbers: ['startedAt', 'finishedAt', 'restEndsAt', 'restTotalSec'] },
  sets: {
    date: ['date'],
    numbers: ['exerciseId', 'sessionExerciseId', 'setNumber', 'weightKg', 'reps', 'repsLeft', 'repsRight', 'durationSec', 'durationLeftSec', 'durationRightSec']
  },
  runs: { date: ['date'], numbers: ['distanceKm', 'durationSec', 'avgHr', 'maxHr'] },
  activities: { date: ['date'], numbers: ['minutes', 'effort'] },
  foodEntries: { date: ['date'], numbers: ['time', 'kcal', 'proteinG', 'portion'] },
  bodyEntries: { date: ['date'], numbers: ['weightKg'] },
  foods: { numbers: ['kcal', 'proteinG'] },
  shoes: { numbers: ['startKm'] }
}

/** More fields with a fixed type, checked when present: text, whole lists of text, and numbers that must exist. */
const STRING_FIELDS: Record<string, string[]> = {
  exercises: ['name'], sessionExercises: ['name'], programs: ['name'], programDays: ['name'], shoes: ['name'],
  runTemplates: ['name'], foods: ['name'], foodEntries: ['name'], activities: ['sport']
}
const LIST_FIELDS: Record<string, string[]> = { exercises: ['primaryMuscles', 'secondaryMuscles'] }
const EXTRA_NUMBERS: Record<string, string[]> = {
  sessionExercises: ['sessionId', 'exerciseId', 'order'],
  programExercises: ['dayId', 'exerciseId', 'order', 'targetSets', 'repMin', 'repMax', 'restSec'],
  programDays: ['programId', 'order'],
  runs: ['shoeId']
}
/** Numbers a row cannot do without: missing or null is refused, not just a wrong type. */
const REQUIRED_NUMBERS: Record<string, string[]> = {
  runs: ['distanceKm', 'durationSec'], foods: ['kcal', 'proteinG'], foodEntries: ['kcal', 'proteinG', 'portion'],
  bodyEntries: ['weightKg'], activities: ['minutes']
}

/** Refuses a backup whose rows or values have the wrong type, before anything is written. */
function validateBackupValues(obj: Record<string, unknown>) {
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
  for (const [table, fields] of Object.entries(STRING_FIELDS)) {
    for (const row of obj[table] as Record<string, unknown>[]) {
      for (const f of fields) if (present(row[f]) && typeof row[f] !== 'string') throw new Error(`invalid ${table}.${f}`)
    }
  }
  for (const [table, fields] of Object.entries(LIST_FIELDS)) {
    for (const row of obj[table] as Record<string, unknown>[]) {
      for (const f of fields) {
        if (present(row[f]) && !(Array.isArray(row[f]) && (row[f] as unknown[]).every((x) => typeof x === 'string'))) throw new Error(`invalid ${table}.${f}`)
      }
    }
  }
  for (const [table, fields] of Object.entries(EXTRA_NUMBERS)) {
    for (const row of obj[table] as Record<string, unknown>[]) {
      for (const f of fields) if (present(row[f]) && !num(row[f])) throw new Error(`invalid ${table}.${f}`)
    }
  }
  for (const [table, fields] of Object.entries(REQUIRED_NUMBERS)) {
    for (const row of obj[table] as Record<string, unknown>[]) {
      for (const f of fields) if (!num(row[f])) throw new Error(`invalid ${table}.${f}`)
    }
  }
  for (const key of REQUIRED_TABLES) {
    for (const row of obj[key] as unknown[]) if (!isRow(row)) throw new Error(`invalid row in ${key}`)
  }
  for (const [table, rule] of Object.entries(FIELD_RULES)) {
    for (const row of obj[table] as Record<string, unknown>[]) {
      for (const f of rule.date ?? []) {
        if (present(row[f]) && !(typeof row[f] === 'string' && DATE_TEXT.test(row[f] as string))) throw new Error(`invalid ${table}.${f}`)
      }
      for (const f of rule.numbers ?? []) {
        if (present(row[f]) && !(typeof row[f] === 'number' && Number.isFinite(row[f]))) throw new Error(`invalid ${table}.${f}`)
      }
    }
  }
  for (const s of obj.settings as Record<string, unknown>[]) {
    if (present(s.goals) && !isRow(s.goals)) throw new Error('invalid settings.goals')
    if (present(s.language) && s.language !== 'th' && s.language !== 'en') throw new Error('invalid settings.language')
    if (present(s.weightUnit) && s.weightUnit !== 'kg' && s.weightUnit !== 'lb') throw new Error('invalid settings.weightUnit')
    if (present(s.defaultRestSec) && !(typeof s.defaultRestSec === 'number' && Number.isFinite(s.defaultRestSec))) throw new Error('invalid settings.defaultRestSec')
  }
}

/** Parses a backup file and returns counts without committing anything. */
export async function parseBackup(file: File): Promise<{ counts: BackupCounts; data: Record<string, unknown[]> }> {
  const text = await file.text()
  const obj = JSON.parse(text)
  if (obj.format !== FORMAT) throw new Error('invalid format')
  if (typeof obj.schemaVersion !== 'number' || obj.schemaVersion < 1 || obj.schemaVersion > SCHEMA_VERSION) throw new Error('schema too new')
  for (const key of REQUIRED_TABLES) {
    if (!Array.isArray(obj[key])) throw new Error(`invalid format: missing ${key}`)
  }
  validateBackupValues(obj)
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
  const foods = (data.foods as Array<Record<string, unknown>>).map(restorePhoto)
  const foodEntries = (data.foodEntries as Array<Record<string, unknown>>).map(restorePhoto)
  const bodyEntries = (data.bodyEntries as Array<Record<string, unknown>>).map(restoreBodyPhotos)

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
      db.foodEntries.bulkAdd(foodEntries as never[]),
      db.bodyEntries.bulkAdd(bodyEntries as never[]),
      db.settings.bulkAdd(data.settings as never[])
    ])
  })

  // An older backup may hold a smaller library (or none): add what is missing now, not at the next launch.
  await seedExercises()
  await recomputeAllBodyParts()
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
    sessions.sort((a, b) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt || a.id! - b.id!)
    const sessionIds = sessions.map((s) => s.id!)
    const sessionExercises = await db.sessionExercises.where('sessionId').anyOf(sessionIds).toArray()
    const [sets, exercises] = await Promise.all([
      db.sets.where('sessionExerciseId').anyOf(sessionExercises.map((se) => se.id!)).toArray(),
      db.exercises.toArray()
    ])
    const exMap = new Map(exercises.map((e) => [e.id!, e]))
    // Warm-up sets are included (the type field tells them apart). Exercises and sets are written in
    // the order they were done, so the file is the same every time it is exported.
    result.weights = sessions.map((s) => ({
      id: s.id, date: s.date, dayName: s.dayName,
      exercises: sessionExercises
        .filter((se) => se.sessionId === s.id)
        .sort((a, b) => a.order - b.order || a.id! - b.id!)
        .map((se) => {
          const ex = exMap.get(se.exerciseId)
          return {
            order: se.order, name: se.name, equipment: se.equipment,
            muscles: ex ? { primary: ex.primaryMuscles, secondary: ex.secondaryMuscles } : undefined,
            note: se.note,
            sets: sets
              .filter((set) => set.sessionExerciseId === se.id)
              .sort((a, b) => a.setNumber - b.setNumber || a.id! - b.id!)
              .map((set) => ({
                setNumber: set.setNumber, type: set.type, weightKg: set.weightKg, reps: set.reps,
                repsLeft: set.repsLeft, repsRight: set.repsRight,
                durationSec: set.durationSec, durationLeftSec: set.durationLeftSec, durationRightSec: set.durationRightSec,
                toFailure: set.toFailure
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
    const entries = (await db.foodEntries.where('date').between(from, to, true, true).toArray())
      .sort((a, b) => a.time - b.time || a.id! - b.id!)
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

/** Saves a blob through a temporary download link. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

/**
 * Shares a file through the share sheet, or downloads it. Returns false only when the owner
 * dismissed the share sheet (AbortError). Any other share failure (for example NotAllowedError
 * on iOS when the tap has expired) falls back to the download, so a backup is never lost.
 */
export async function shareOrDownload(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type })
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return true
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return false
    }
  }
  downloadBlob(blob, filename)
  return true
}

/** True when the typed confirmation matches the word, ignoring surrounding spaces and letter case. */
export function confirmWordMatches(typed: string, word: string): boolean {
  const norm = (s: string) => s.normalize('NFC').trim().toLowerCase()
  return norm(word) !== '' && norm(typed) === norm(word)
}

export function backupFilename(): string {
  return `gymboy-backup-${localDate()}.json`
}

export function aiExportFilename(from: string, to: string): string {
  return `gymboy-export-${from}-${to}.json`
}
