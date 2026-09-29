import { describe, expect, it } from 'vitest'
import type { RunLog } from '../db/types'
import {
  avgRepPace, chartPace, distanceSinceMonday, monthlyDistances,
  paceSecPerKm, repPace, shoeDistanceKm, weeklyDistances
} from './running'

const run = (over: Partial<RunLog>): RunLog => ({ date: '2026-09-29', type: 'easy', distanceKm: 5, durationSec: 1500, ...over })

describe('paceSecPerKm', () => {
  it('is duration over distance', () => {
    expect(paceSecPerKm(5, 1500)).toBe(300)
  })
  it('is undefined without both values', () => {
    expect(paceSecPerKm(0, 1500)).toBeUndefined()
    expect(paceSecPerKm(5, 0)).toBeUndefined()
  })
})

describe('repPace', () => {
  it('uses the entered time for a distance-based plan', () => {
    // 800 m in 200 s → 250 s/km.
    expect(repPace({ reps: 6, distanceM: 800 }, { durationSec: 200 })).toBe(250)
  })
  it('uses the entered distance for a time-based plan', () => {
    // 400 m in a fixed 120 s → 300 s/km.
    expect(repPace({ reps: 6, durationSec: 120 }, { distanceM: 400 })).toBe(300)
  })
  it('is undefined when the entered side is missing', () => {
    expect(repPace({ reps: 6, distanceM: 800 }, {})).toBeUndefined()
  })
})

describe('avgRepPace', () => {
  it('averages the reps that have a pace', () => {
    expect(avgRepPace([{ rep: 1, paceSecPerKm: 240 }, { rep: 2, paceSecPerKm: 260 }, { rep: 3 }])).toBe(250)
  })
  it('is undefined with no paces', () => {
    expect(avgRepPace([{ rep: 1 }])).toBeUndefined()
    expect(avgRepPace(undefined)).toBeUndefined()
  })
})

describe('chartPace', () => {
  it('uses average rep pace for interval runs', () => {
    const r = run({ type: 'interval', repResults: [{ rep: 1, paceSecPerKm: 200 }, { rep: 2, paceSecPerKm: 220 }] })
    expect(chartPace(r)).toBe(210)
  })
  it('uses the overall pace otherwise', () => {
    expect(chartPace(run({ distanceKm: 10, durationSec: 3000 }))).toBe(300)
  })
})

describe('shoeDistanceKm', () => {
  it('sums the km of runs in one pair', () => {
    const runs = [run({ shoeId: 1, distanceKm: 5 }), run({ shoeId: 1, distanceKm: 8 }), run({ shoeId: 2, distanceKm: 3 })]
    expect(shoeDistanceKm(runs, 1)).toBe(13)
  })
})

describe('weeklyDistances', () => {
  const now = new Date(2026, 8, 29) // Tue 29 Sept 2026; its week starts Mon 28th.
  it('buckets by Monday-week, current week last', () => {
    const runs = [run({ date: '2026-09-28', distanceKm: 4 }), run({ date: '2026-09-20', distanceKm: 6 })]
    const w = weeklyDistances(runs, 3, now)
    expect(w).toHaveLength(3)
    expect(w[0].start).toBe('2026-09-14')
    expect(w[2].start).toBe('2026-09-28')
    expect(w[2].km).toBe(4) // 28 Sept is the current week
    expect(w[0].km).toBe(6) // 20 Sept is a Sunday, in the week starting Mon 14 Sept
    expect(w[1].km).toBe(0)
  })
  it('places 20 Sept in the week starting 14 Sept', () => {
    const w = weeklyDistances([run({ date: '2026-09-20', distanceKm: 6 })], 3, now)
    expect(w[0].km).toBe(6)
    expect(w[1].km).toBe(0)
  })
})

describe('monthlyDistances', () => {
  const now = new Date(2026, 8, 29)
  it('buckets by calendar month, current month last', () => {
    const runs = [run({ date: '2026-09-15', distanceKm: 10 }), run({ date: '2026-08-02', distanceKm: 7 })]
    const m = monthlyDistances(runs, 3, now)
    expect(m).toHaveLength(3)
    expect(m[0].start).toBe('2026-07-01')
    expect(m[2].start).toBe('2026-09-01')
    expect(m[2].km).toBe(10)
    expect(m[1].km).toBe(7)
  })
})

describe('distanceSinceMonday', () => {
  const now = new Date(2026, 8, 29) // week starts Mon 28th
  it('counts from the most recent Monday', () => {
    const runs = [run({ date: '2026-09-28', distanceKm: 5 }), run({ date: '2026-09-27', distanceKm: 9 })]
    expect(distanceSinceMonday(runs, now)).toBe(5)
  })
})
