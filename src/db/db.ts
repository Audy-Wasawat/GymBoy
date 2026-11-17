import Dexie, { type Table } from 'dexie'
import type {
  Activity, BodyEntry, Exercise, Food, FoodEntry, Program, ProgramDay, ProgramExercise,
  RestorePoint, StoredPhoto, RunLog, RunTemplate, SessionExercise, SetDraft, SetLog, Settings, Shoe, WorkoutSession
} from './types'

export class GymboyDB extends Dexie {
  exercises!: Table<Exercise, number>
  programs!: Table<Program, number>
  programDays!: Table<ProgramDay, number>
  programExercises!: Table<ProgramExercise, number>
  sessions!: Table<WorkoutSession, number>
  sessionExercises!: Table<SessionExercise, number>
  sets!: Table<SetLog, number>
  setDrafts!: Table<SetDraft, number>
  runs!: Table<RunLog, number>
  runTemplates!: Table<RunTemplate, number>
  shoes!: Table<Shoe, number>
  activities!: Table<Activity, number>
  foods!: Table<Food, number>
  foodEntries!: Table<FoodEntry, number>
  bodyEntries!: Table<BodyEntry, number>
  settings!: Table<Settings, string>
  restorePoints!: Table<RestorePoint, string>
  photos!: Table<StoredPhoto, string>

  constructor() {
    super('gymboy')
    // Dates are local 'YYYY-MM-DD' strings so day boundaries follow the phone's clock.
    this.version(1).stores({
      exercises: '++id, nameEn, nameTh, equipment, isCustom',
      programs: '++id, isActive',
      programDays: '++id, programId, order',
      programExercises: '++id, dayId, exerciseId, order',
      sessions: '++id, date, programId',
      sessionExercises: '++id, sessionId, exerciseId',
      sets: '++id, sessionExerciseId, type',
      runs: '++id, date, type, shoeId',
      runTemplates: '++id, name',
      shoes: '++id, retired',
      activities: '++id, date, sport',
      foods: '++id, name',
      foodEntries: '++id, date, foodId',
      bodyEntries: '++id, date',
      settings: 'id'
    })
    // v2 (phase 2): single exercise name, seed key, body part; sets carry exerciseId and date.
    // IndexedDB cannot index booleans, so isCustom, isActive and retired are dropped and read with .filter().
    this.version(2).stores({
      exercises: '++id, name, equipment, bodyPart, &seedKey',
      programs: '++id',
      shoes: '++id',
      setDrafts: '++id, sessionExerciseId',
      sessions: '++id, date, programId, startedAt',
      sets: '++id, sessionExerciseId, exerciseId, date, type, [exerciseId+date]'
    }).upgrade(async (tx) => {
      await tx.table('exercises').toCollection().modify((e) => {
        e.name ??= e.nameEn ?? e.nameTh ?? ''
        delete e.nameEn
        delete e.nameTh
        e.timed ??= false
      })
      await tx.table('sessions').toCollection().modify((s) => { s.startedAt ??= 0 })
    })
    // v3: a body entry holds several photos (front, side, back...) instead of one.
    this.version(3).stores({}).upgrade(async (tx) => {
      await tx.table('bodyEntries').toCollection().modify((e) => {
        if (e.photo instanceof Blob) e.photos = [{ blob: e.photo, pose: 'front' }]
        delete e.photo
      })
    })
    // v4: activity effort moves from a 1-5 to a 1-10 scale.
    this.version(4).stores({}).upgrade(async (tx) => {
      await tx.table('activities').toCollection().modify((a) => {
        if (typeof a.effort === 'number') a.effort = Math.min(10, Math.max(1, Math.round(a.effort * 2)))
      })
    })
    // v5: the copy of the data taken just before a restore, so the restore can be undone.
    this.version(5).stores({ restorePoints: 'id' })
    // v6: food photos are stored once in `photos` (keyed by content) and rows point to them. Moving
    // the old per-row copies needs the photo bytes, which cannot be read inside an upgrade, so
    // `migrateFoodPhotos` does it after the database opens; until then the old field still shows.
    this.version(6).stores({ photos: 'key' })
  }
}

export const db = new GymboyDB()

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  language: 'th',
  weightUnit: 'kg',
  defaultRestSec: 90,
  goals: {}
}

/** Creates the settings row on first launch; never overwrites an existing one. */
export async function ensureSettings() {
  const existing = await db.settings.get('app')
  if (!existing) await db.settings.put(DEFAULT_SETTINGS)
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>) {
  await db.settings.update('app', patch)
}
