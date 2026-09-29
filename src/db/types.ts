export type Lang = 'th' | 'en'
export type WeightUnit = 'kg' | 'lb'
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'other'
export type RunType = 'easy' | 'lsd' | 'tempo' | 'interval'
export type SetType = 'warmup' | 'working'
export type BodyPart =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'forearms'
  | 'core' | 'quads' | 'hamstrings' | 'glutes' | 'calves'

/** Muscle region ids used by the body model (front and back). */
export type Muscle =
  | 'chest_upper' | 'chest_lower'
  | 'delt_front' | 'delt_side' | 'delt_rear'
  | 'biceps' | 'triceps' | 'forearms'
  | 'abs' | 'obliques'
  | 'traps' | 'lats' | 'mid_back' | 'lower_back'
  | 'glutes' | 'quads' | 'hamstrings' | 'adductors' | 'calves'

export interface Exercise {
  id?: number
  name: string
  equipment: Equipment
  bodyPart?: BodyPart
  /** Stable key of a seeded exercise, used to add new seeds without duplicating; empty for custom ones. */
  seedKey?: string
  /** Path to the bundled image; custom exercises have none. */
  image?: string
  primaryMuscles: Muscle[]
  secondaryMuscles: Muscle[]
  leftRight: boolean
  bodyweight: boolean
  /** Sets are logged as a duration in seconds instead of reps. */
  timed: boolean
  isCustom: boolean
}

export interface Program { id?: number; name: string; isActive: boolean; createdAt: number }
export interface ProgramDay { id?: number; programId: number; name: string; bodyParts: string[]; order: number }
export interface ProgramExercise {
  id?: number; dayId: number; exerciseId: number; order: number
  /** For timed exercises repMin/repMax hold the target range in seconds. */
  targetSets: number; repMin: number; repMax: number; restSec: number
}

export interface WorkoutSession {
  id?: number; date: string; programId?: number; dayName?: string; bodyParts: string[]
  startedAt: number
  /** Set when the session is finished; at most one session is open at a time. */
  finishedAt?: number
}
/** Copies the exercise and program values at the time of logging so later edits never change history. */
export interface SessionExercise {
  id?: number; sessionId: number; exerciseId: number; order: number; note?: string
  name: string; equipment: Equipment
  leftRight: boolean; bodyweight: boolean; timed: boolean
  targetSets?: number; repMin?: number; repMax?: number; restSec?: number
}
export interface SetLog {
  id?: number; sessionExerciseId: number; setNumber: number; type: SetType
  /** Copied from the session so history and PR queries need no joins. */
  exerciseId: number; date: string
  /** Always stored in kg; empty for bodyweight-only sets. */
  weightKg?: number
  reps?: number; repsLeft?: number; repsRight?: number
  /** Used instead of reps for timed exercises. */
  durationSec?: number; durationLeftSec?: number; durationRightSec?: number
  toFailure: boolean
}

export interface IntervalPlan { reps: number; distanceM?: number; durationSec?: number; targetPaceSecPerKm?: number; restSec?: number }
export interface IntervalRepResult { rep: number; durationSec?: number; paceSecPerKm?: number }
export interface RunLog {
  id?: number; date: string; type: RunType; distanceKm: number; durationSec: number
  shoeId?: number; note?: string; plan?: IntervalPlan; repResults?: IntervalRepResult[]
}
export interface RunTemplate { id?: number; name: string; type: RunType; plan: IntervalPlan }
export interface Shoe { id?: number; name: string; retired: boolean }

export interface Activity { id?: number; date: string; sport: string; minutes: number; effort?: number; note?: string }

export interface Food { id?: number; name: string; kcal: number; proteinG: number; photo?: Blob }
export interface FoodEntry {
  id?: number; date: string; time: number; foodId?: number; name: string
  portion: number; kcal: number; proteinG: number
}

export interface BodyEntry { id?: number; date: string; weightKg: number; photo?: Blob }

export interface Goals { kcal?: number; proteinG?: number; weeklyDays?: number }
export interface Settings {
  id: 'app'
  language: Lang
  weightUnit: WeightUnit
  defaultRestSec: number
  goals: Goals
  lastBackupAt?: number
}
