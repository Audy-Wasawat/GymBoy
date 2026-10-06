/**
 * Where a day's calories sit against the daily goal: a floor ("eat at least"), an optional ceiling
 * ("try not to go over"), or both. Either end may be missing.
 */
export type KcalStatus =
  | { state: 'none' }
  | { state: 'below'; toMin: number; max?: number }
  | { state: 'in'; room?: number }
  | { state: 'over'; over: number }

export function kcalStatus(kcal: number, min?: number, max?: number): KcalStatus {
  if (!min && !max) return { state: 'none' }
  if (max && kcal > max) return { state: 'over', over: Math.round(kcal - max) }
  if (min && kcal < min) return { state: 'below', toMin: Math.round(min - kcal), max }
  return { state: 'in', room: max ? Math.round(max - kcal) : undefined }
}

/** A goal number typed in settings: a positive whole number, or nothing. */
export function parseGoal(text: string): number | undefined {
  const n = Number(text.trim())
  return text.trim() && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined
}
