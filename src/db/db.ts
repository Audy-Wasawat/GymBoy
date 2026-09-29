import Dexie, { type Table } from 'dexie'
import type {
  Activity, BodyEntry, Exercise, Food, FoodEntry, Program, ProgramDay, ProgramExercise,
  RunLog, RunTemplate, SessionExercise, SetDraft, SetLog, Settings, Shoe, WorkoutSession
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
