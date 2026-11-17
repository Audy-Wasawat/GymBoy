import { db, ensureSettings } from '../db/db'
import { migrateFoodPhotos, photoKeyOf, prunePhotos } from '../db/photoStore'
import type { StoredPhoto } from '../db/types'
import { seedExercises } from '../db/seed'
import { recomputeAllBodyParts } from '../db/sessions'
import { localDate, parseLocalDate } from './dates'
import { paceSecPerKm as calcPace } from './running'

// v5: food photos are written once each in `photoStore`; foods and food entries point to them by key.
const SCHEMA_VERSION = 5
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
  /** Photos inside the file; 0 for a file made without photos. */
  photos: number
  /** When the file was made (ISO text), if it says. */
  exportedAt?: string
  /** True when the file was made without photos. */
  photosExcluded: boolean
}

/** How many photos the phone holds and how many bytes they take, for the backup screen. */
export async function photoStats(): Promise<{ count: number; bytes: number }> {
  const [stored, body] = await Promise.all([db.photos.toArray(), db.bodyEntries.toArray()])
  const blobs = [...stored.map((p) => p.blob), ...body.flatMap((e) => (e.photos ?? []).map((p) => p.blob))]
    .filter((b): b is Blob => b instanceof Blob)
  return { count: blobs.length, bytes: blobs.reduce((s, b) => s + b.size, 0) }
}

export interface BackupOptions {
  /** Without photos the file is small enough to make often; photos already on a phone survive restoring it there. */
  photos: boolean
}

/**
 * Creates a backup JSON blob (photos, when included, as data URLs). The file is assembled from many
 * small pieces instead of one giant string, so a large photo collection needs far less memory.
 */
export async function createBackup({ photos }: BackupOptions = { photos: true }): Promise<Blob> {
  // Food photos still in the old per-row layout are moved to the store first, so each is written once.
  await migrateFoodPhotos()
  await prunePhotos()
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
  const stored = photos ? await db.photos.toArray() : []

  // Foods and entries carry only their photo key; the pictures go once each into photoStore.
  // (A Blob would be written as {} by JSON.stringify, so photos become data URLs or are left out.)
  const keyOnly = async <T extends { photo?: Blob }>(row: T) => {
    const { photo: _old, ...rest } = row
    return rest
  }
  const bodyRow = async (e: (typeof bodyEntries)[number]) => {
    const { photos: list, ...rest } = e
    return photos && list?.length
      ? { ...rest, photos: await Promise.all(list.map(async (p) => ({ pose: p.pose, photo: await blobToDataUrl(p.blob) }))) }
      : rest
  }

  const parts: BlobPart[] = [JSON.stringify({
    format: FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    version: APP_VERSION,
    photos: photos ? 'included' : 'excluded',
    settings
  }).slice(0, -1)]
  const table = async <T>(name: string, rows: T[], map?: (row: T) => Promise<unknown>) => {
    parts.push(`,${JSON.stringify(name)}:[`)
    for (let i = 0; i < rows.length; i++) {
      // One row at a time: only this row's photos are held as text before they go into the file.
      parts.push((i ? ',' : '') + JSON.stringify(map ? await map(rows[i]) : rows[i]))
    }
    parts.push(']')
  }
  await table('exercises', exercises)
  await table('programs', programs)
  await table('programDays', programDays)
  await table('programExercises', programExercises)
  await table('sessions', sessions)
  await table('sessionExercises', sessionExercises)
  await table('sets', sets)
  await table('setDrafts', setDrafts)
  await table('runs', runs)
  await table('runTemplates', runTemplates)
  await table('shoes', shoes)
  await table('activities', activities)
  await table('foods', foods, keyOnly)
  await table('foodEntries', foodEntries, keyOnly)
  await table('bodyEntries', bodyEntries, bodyRow)
  await table('photoStore', stored, async (p: StoredPhoto) => ({ key: p.key, photo: await blobToDataUrl(p.blob) }))
  parts.push('}')
  return new Blob(parts, { type: 'application/json' })
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
  activities: { date: ['date'], numbers: ['minutes', 'durationSec', 'effort'] },
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

const isPhotoText = (v: unknown) => typeof v === 'string' && v.startsWith('data:')
function countPhotos(obj: Record<string, unknown>): number {
  const rows = (k: string) => (Array.isArray(obj[k]) ? obj[k] : []) as Record<string, unknown>[]
  return rows('photoStore').filter((r) => isRow(r) && isPhotoText(r.photo)).length +
    rows('foods').filter((r) => isPhotoText(r.photo)).length +
    rows('foodEntries').filter((r) => isPhotoText(r.photo)).length +
    rows('bodyEntries').reduce((n, r) => n + (Array.isArray(r.photos)
      ? (r.photos as unknown[]).filter((p) => isRow(p) && isPhotoText(p.photo)).length
      : isPhotoText(r.photo) ? 1 : 0), 0)
}

/** The file was made by a newer version of the app: update this one first (close and reopen it). */
export class BackupTooNewError extends Error {
  constructor() { super('schema too new') }
}

/** Parses a backup file and returns counts without committing anything. */
export async function parseBackup(file: File): Promise<{ counts: BackupCounts; data: Record<string, unknown[]> }> {
  const text = await file.text()
  const obj = JSON.parse(text)
  if (obj.format !== FORMAT) throw new Error('invalid format')
  if (typeof obj.schemaVersion !== 'number' || obj.schemaVersion < 1) throw new Error('invalid format')
  if (obj.schemaVersion > SCHEMA_VERSION) throw new BackupTooNewError()
  for (const key of REQUIRED_TABLES) {
    if (!Array.isArray(obj[key])) throw new Error(`invalid format: missing ${key}`)
  }
  validateBackupValues(obj)
  const counts: BackupCounts = {
    sessions: (obj.sessions as unknown[]).length,
    runs: (obj.runs as unknown[]).length,
    foodEntries: (obj.foodEntries as unknown[]).length,
    activities: (obj.activities as unknown[]).length,
    bodyEntries: (obj.bodyEntries as unknown[]).length,
    photos: countPhotos(obj),
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : undefined,
    photosExcluded: obj.photos === 'excluded'
  }
  return { counts, data: obj as Record<string, unknown[]> }
}

type Rows = Record<string, unknown>[]

/** A parsed backup brought up to the current layout, with photos decoded, ready to write. */
export interface PreparedBackup {
  tables: Record<string, Rows>
  /** Food photos, once each, keyed by content. */
  photos: StoredPhoto[]
  photosExcluded: boolean
  photosLost: number
}

/**
 * Brings a parsed backup of any version up to the current layout: v1 exercise names, the 1-10
 * effort scale, and food photos moved into the photo store (old files copied a photo into every
 * row; identical copies become one stored photo). Photo bytes are read here, before any database
 * transaction, since a transaction cannot wait for them.
 */
export async function prepareBackup(data: Record<string, unknown[]>): Promise<PreparedBackup> {
  const raw = data as Record<string, unknown>
  const schemaVersion = raw.schemaVersion as number
  const rows = (k: string) => ((Array.isArray(raw[k]) ? raw[k] : []) as Rows)

  const exercises = rows('exercises').map((e) =>
    schemaVersion < 2 ? { ...e, name: (e.nameEn ?? e.nameTh ?? '') as string, timed: false } : e
  )
  // Before schema v4 activity effort was 1-5; it is 1-10 now.
  const activities = rows('activities').map((a) =>
    schemaVersion < 4 && typeof a.effort === 'number' ? { ...a, effort: Math.min(10, Math.max(1, Math.round(a.effort * 2))) } : a
  )

  const store = new Map<string, Blob>()
  let lost = 0
  const keep = async (blob: Blob) => { const key = await photoKeyOf(blob); store.set(key, blob); return key }

  // v5+ files: the photo store. Keys are worked out again from the bytes, so a file can never
  // attach a picture to the wrong key.
  const fileKey = new Map<string, string>()
  for (const p of rows('photoStore')) {
    if (!isRow(p)) continue
    const blob = photoFromBackup(p.photo)
    if (blob) fileKey.set(String(p.key), await keep(blob))
    else lost++
  }
  // Rows: point at the store; old files' per-row copies are moved into it.
  const foodRow = async (r: Record<string, unknown>) => {
    const { photo, photoKey, ...rest } = r
    if (photo !== undefined) {
      const blob = photoFromBackup(photo)
      if (blob) return { ...rest, photoKey: await keep(blob) }
      if (isPhotoText(photo)) lost++
      return rest
    }
    if (typeof photoKey === 'string') {
      const key = fileKey.get(photoKey) ?? photoKey // a data-only file keeps the key: the phone may hold the photo
      return { ...rest, photoKey: key }
    }
    return rest
  }
  const foods = await Promise.all(rows('foods').map(foodRow))
  const foodEntries = await Promise.all(rows('foodEntries').map(foodRow))

  const bodyEntries = rows('bodyEntries').map(restoreBodyPhotos)
  const bodyInFile = rows('bodyEntries').reduce((n, r) => n + (Array.isArray(r.photos)
    ? (r.photos as unknown[]).filter((p) => isRow(p) && isPhotoText(p.photo)).length
    : isPhotoText(r.photo) ? 1 : 0), 0)
  lost += Math.max(0, bodyInFile - bodyEntries.reduce((n, r) => n + ((r.photos as unknown[] | undefined)?.length ?? 0), 0))

  const tables: Record<string, Rows> = {}
  for (const k of REQUIRED_TABLES) tables[k] = rows(k)
  Object.assign(tables, { exercises, activities, foods, foodEntries, bodyEntries })
  return {
    tables,
    photos: [...store].map(([key, blob]) => ({ key, blob })),
    photosExcluded: raw.photos === 'excluded',
    photosLost: lost
  }
}

/** Replaces all data with the backup contents in one transaction. Resolves to how many photos in the file were damaged and left out. */
export async function restoreBackup(data: Record<string, unknown[]>): Promise<{ photosLost: number }> {
  const prepared = await prepareBackup(data)
  const { tables: t, photosExcluded, photosLost } = prepared
  let bodyEntries = t.bodyEntries

  // A file made without photos keeps the photos this phone already has: food photos stay in the
  // store (rows find them by key), and body photos stay on the matching entry (same id and date).
  if (photosExcluded) {
    const oldBody = await db.bodyEntries.toArray()
    const body = new Map(oldBody.filter((e) => e.photos?.length).map((e) => [`${e.id}|${e.date}`, e.photos]))
    bodyEntries = bodyEntries.map((r) => { const p = body.get(`${r.id}|${r.date}`); return p ? { ...r, photos: p } : r })
  }

  await db.transaction('rw', [
    db.exercises, db.programs, db.programDays, db.programExercises,
    db.sessions, db.sessionExercises, db.sets, db.setDrafts,
    db.runs, db.runTemplates, db.shoes,
    db.activities, db.foods, db.foodEntries, db.bodyEntries, db.settings, db.photos
  ], async () => {
    if (!photosExcluded) await db.photos.clear()
    await db.photos.bulkPut(prepared.photos)
    await Promise.all([
      db.exercises.clear(), db.programs.clear(), db.programDays.clear(), db.programExercises.clear(),
      db.sessions.clear(), db.sessionExercises.clear(), db.sets.clear(), db.setDrafts.clear(),
      db.runs.clear(), db.runTemplates.clear(), db.shoes.clear(),
      db.activities.clear(), db.foods.clear(), db.foodEntries.clear(), db.bodyEntries.clear(), db.settings.clear()
    ])
    await Promise.all([
      db.exercises.bulkAdd(t.exercises as never[]),
      db.programs.bulkAdd(t.programs as never[]),
      db.programDays.bulkAdd(t.programDays as never[]),
      db.programExercises.bulkAdd(t.programExercises as never[]),
      db.sessions.bulkAdd(t.sessions as never[]),
      db.sessionExercises.bulkAdd(t.sessionExercises as never[]),
      db.sets.bulkAdd(t.sets as never[]),
      db.setDrafts.bulkAdd(t.setDrafts as never[]),
      db.runs.bulkAdd(t.runs as never[]),
      db.runTemplates.bulkAdd(t.runTemplates as never[]),
      db.shoes.bulkAdd(t.shoes as never[]),
      db.activities.bulkAdd(t.activities as never[]),
      db.foods.bulkAdd(t.foods as never[]),
      db.foodEntries.bulkAdd(t.foodEntries as never[]),
      db.bodyEntries.bulkAdd(bodyEntries as never[]),
      db.settings.bulkAdd(t.settings as never[])
    ])
  })

  // An older backup may hold a smaller library (or none): add what is missing now, not at the next launch.
  await prunePhotos()
  await seedExercises()
  await recomputeAllBodyParts()
  await ensureSettings()
  return { photosLost }
}

// ─── Undoing a restore ────────────────────────────────────────────────────────

/** True when the phone holds any logged history worth keeping a copy of. */
async function hasHistory(): Promise<boolean> {
  const counts = await Promise.all([
    db.sessions.count(), db.runs.count(), db.foodEntries.count(), db.activities.count(), db.bodyEntries.count(), db.foods.count()
  ])
  return counts.some((n) => n > 0)
}

/**
 * Keeps a full copy (photos included) of what the phone holds now, so the import that follows can be
 * undone from the backup screen. Only the latest copy is kept; a phone with no history keeps none.
 */
export async function keepRestorePoint(): Promise<void> {
  if (!(await hasHistory())) return
  const blob = await createBackup({ photos: true })
  await db.restorePoints.put({ id: 'before-restore', createdAt: Date.now(), blob })
}

/** Replaces everything with a backup, keeping the undo copy first. */
export async function restoreWithUndo(data: Record<string, unknown[]>): Promise<{ photosLost: number }> {
  await keepRestorePoint()
  return restoreBackup(data)
}

/** Puts back the data from before the last restore (and keeps today's data as the new undo copy). */
export async function undoRestore(): Promise<boolean> {
  const point = await db.restorePoints.get('before-restore')
  if (!point) return false
  const { data } = await parseBackup(new File([point.blob], 'restore-point.json', { type: 'application/json' }))
  await restoreWithUndo(data)
  return true
}

export const deleteRestorePoint = () => db.restorePoints.delete('before-restore')

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
                toFailure: set.toFailure, goodForm: set.goodForm ?? false
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
  })  // Food photos no entry or library food points to any more go too.
  await prunePhotos()
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
  // The copy kept for undoing a restore holds the same data, so it goes too, and so do stored photos.
  await db.restorePoints.clear()
  await db.photos.clear()
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

/** Date and time in the name, so several backups on one day never share a name. */
export function backupFilename(photos = true, now = new Date()): string {
  const hm = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  return `gymboy-backup-${localDate(now)}-${hm}${photos ? '' : '-no-photos'}.json`
}

export function aiExportFilename(from: string, to: string): string {
  return `gymboy-export-${from}-${to}.json`
}
