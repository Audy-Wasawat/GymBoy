import Dexie, { type Table } from 'dexie'
import type {
  Activity, BodyEntry, Exercise, Food, FoodEntry, Program, ProgramDay, ProgramExercise,
  RunLog, RunTemplate, SessionExercise, SetLog, Settings, Shoe, WorkoutSession
} from './types'

export class GymboyDB extends Dexie {
  exercises!: Table<Exercise, number>
  programs!: Table<Program, number>
  programDays!: Table<ProgramDay, number>
  programExercises!: Table<ProgramExercise, number>
  sessions!: Table<WorkoutSession, number>
  sessionExercises!: Table<SessionExercise, number>
  sets!: Table<SetLog, number>
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
