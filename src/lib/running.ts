import type { IntervalPlan, IntervalRepResult, RunLog, RunType } from '../db/types'
import { localDate, startOfWeek } from './dates'

/** Average pace in seconds per km, or undefined when distance or time is missing. */
export function paceSecPerKm(distanceKm: number, durationSec: number): number | undefined {
  if (!(distanceKm > 0) || !(durationSec > 0)) return undefined
  return durationSec / distanceKm
}

/** Pace of one interval rep from the plan's fixed side and the entered side. */
export function repPace(plan: IntervalPlan, result: Pick<IntervalRepResult, 'durationSec' | 'distanceM'>): number | undefined {
  if (plan.distanceM && plan.distanceM > 0) {
    // Distance is planned; the rep time is entered.
    return result.durationSec && result.durationSec > 0 ? paceSecPerKm(plan.distanceM / 1000, result.durationSec) : undefined
  }
  if (plan.durationSec && plan.durationSec > 0) {
    // Time is planned; the rep distance is entered.
    return result.distanceM && result.distanceM > 0 ? paceSecPerKm(result.distanceM / 1000, plan.durationSec) : undefined
  }
  return undefined
}

/** Mean of the reps that have a pace, or undefined when none do. */
export function avgRepPace(reps: IntervalRepResult[] | undefined): number | undefined {
  const paces = (reps ?? []).map((r) => r.paceSecPerKm).filter((p): p is number => p !== undefined && p > 0)
  if (!paces.length) return undefined
  return paces.reduce((s, p) => s + p, 0) / paces.length
}

/**
 * The pace a run contributes to the pace-over-time chart: its average rep pace for interval runs
 * (the plan/actual detail lives in history), otherwise its overall average pace.
 */
export function chartPace(run: RunLog): number | undefined {
  if (run.type === 'interval') return avgRepPace(run.repResults)
  return paceSecPerKm(run.distanceKm, run.durationSec)
}

/** Total km run in a pair of shoes. */
export const shoeDistanceKm = (runs: RunLog[], shoeId: number) =>
  runs.filter((r) => r.shoeId === shoeId).reduce((s, r) => s + r.distanceKm, 0)

export interface DistanceBucket { start: string; label: string; km: number }

/** Distance summed over the last n Monday-weeks, oldest first; the current week is last. */
export function weeklyDistances(runs: RunLog[], n: number, now = new Date()): DistanceBucket[] {
  const buckets: DistanceBucket[] = []
  const thisMonday = startOfWeek(now)
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(thisMonday)
    start.setDate(start.getDate() - i * 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    const startStr = localDate(start)
    const endStr = localDate(end)
    const km = runs.filter((r) => r.date >= startStr && r.date < endStr).reduce((s, r) => s + r.distanceKm, 0)
    buckets.push({ start: startStr, label: `${start.getDate()}/${start.getMonth() + 1}`, km })
  }
  return buckets
}

/** Distance summed over the last n calendar months, oldest first; the current month is last. */
export function monthlyDistances(runs: RunLog[], n: number, now = new Date()): DistanceBucket[] {
  const buckets: DistanceBucket[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth()
    const start = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const nextD = new Date(y, m + 1, 1)
    const end = localDate(nextD)
    const km = runs.filter((r) => r.date >= start && r.date < end).reduce((s, r) => s + r.distanceKm, 0)
    buckets.push({ start, label: `${m + 1}/${String(y).slice(2)}`, km })
  }
  return buckets
}

export const RUN_TYPES: RunType[] = ['easy', 'lsd', 'tempo', 'interval']

/** Distance since the most recent Monday, for the week progress on Today. */
export function distanceSinceMonday(runs: RunLog[], now = new Date()) {
  const monday = localDate(startOfWeek(now))
  return runs.filter((r) => r.date >= monday).reduce((s, r) => s + r.distanceKm, 0)
}
