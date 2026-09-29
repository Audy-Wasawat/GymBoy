export type Lang = 'th' | 'en'
export type WeightUnit = 'kg' | 'lb'
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'other'
export type RunType = 'easy' | 'lsd' | 'tempo' | 'interval'
export type SetType = 'warmup' | 'working'

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
  nameTh: string
  nameEn: string
  equipment: Equipment
  /** Path to the bundled image; custom exercises have none. */
  image?: string
  primaryMuscles: Muscle[]
  secondaryMuscles: Muscle[]
  leftRight: boolean
  bodyweight: boolean
  isCustom: boolean
}

export interface Program { id?: number; name: string; isActive: boolean; createdAt: number }
export interface ProgramDay { id?: number; programId: number; name: string; bodyParts: string[]; order: number }
export interface ProgramExercise {
  id?: number; dayId: number; exerciseId: number; order: number
  targetSets: number; repMin: number; repMax: number; restSec: number
}

export interface WorkoutSession {
  id?: number; date: string; programId?: number; dayName?: string; bodyParts: string[]
}
export interface SessionExercise { id?: number; sessionId: number; exerciseId: number; order: number; note?: string }
export interface SetLog {
  id?: number; sessionExerciseId: number; setNumber: number; type: SetType
  /** Always stored in kg; empty for bodyweight-only sets. */
  weightKg?: number
  reps?: number; repsLeft?: number; repsRight?: number
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
