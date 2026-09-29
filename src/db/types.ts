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
  id?: number; date: string; programId?: number; dayName?: string
  /** Body parts of the exercises that have saved working sets, worked out automatically. */
  bodyParts: BodyPart[]
  startedAt: number
  /** Set when the session is finished; at most one session is open at a time. */
  finishedAt?: number
  /** Rest timer: stores the end time, not a countdown, so it survives the screen locking. */
  restEndsAt?: number; restTotalSec?: number
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

/**
 * A set row typed in but not saved with ✓ yet. Kept in its own table so iOS closing the app
 * never loses it, and so it can never count as a logged set. Values are the raw typed text.
 */
export interface SetDraft {
  id?: number; sessionExerciseId: number; order: number; type: SetType
  weight: string
  /** Unit the weight was typed in, so changing the setting mid-session cannot misread it. */
  unit?: WeightUnit
  /** Reps, or a duration for timed exercises; left/right are used by left/right exercises. */
  value: string; left: string; right: string
  toFailure: boolean
}

export type Surface = 'treadmill' | 'outdoor'
/** A rep is planned either by distance (distanceM) or by time (durationSec), never both. */
export interface IntervalPlan { reps: number; distanceM?: number; durationSec?: number; targetPaceSecPerKm?: number; restSec?: number }
/**
 * One rep's actual result. For a distance-based plan the rep time (durationSec) is entered;
 * for a time-based plan the rep distance (distanceM) is entered. paceSecPerKm is calculated and
 * stored so history, charts and the AI export need no recomputation.
 */
export interface IntervalRepResult { rep: number; durationSec?: number; distanceM?: number; paceSecPerKm?: number }
export interface RunLog {
  id?: number; date: string; type: RunType; distanceKm: number; durationSec: number
  shoeId?: number; note?: string; plan?: IntervalPlan; repResults?: IntervalRepResult[]
  /** Optional whole beats per minute, 30-250. */
  avgHr?: number; maxHr?: number
  surface?: Surface
}
export interface RunTemplate { id?: number; name: string; type: RunType; plan: IntervalPlan }
export interface Shoe {
  id?: number; name: string; retired: boolean
  /** Distance run in this pair before using the app, in km (0 or more, 2 decimals). Missing means 0. */
  startKm?: number
}

export interface Activity { id?: number; date: string; sport: string; minutes: number; effort?: number; note?: string }

export interface Food { id?: number; name: string; kcal: number; proteinG: number; photo?: Blob }
export interface FoodEntry {
  id?: number; date: string; time: number; foodId?: number; name: string
  portion: number; kcal: number; proteinG: number
  /** A snapshot taken with the entry, like its kcal and protein: library edits never change it. */
  photo?: Blob
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
