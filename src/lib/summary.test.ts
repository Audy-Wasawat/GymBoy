import { describe, expect, it } from 'vitest'
import { monthStart, monthEnd, addMonths, mondayOf, weeksInMonth, yearMonth } from './summary'

describe('monthStart / monthEnd', () => {
  it('returns correct month bounds', () => {
    expect(monthStart(2026, 1)).toBe('2026-01-01')
    expect(monthEnd(2026, 1)).toBe('2026-01-31')
    expect(monthEnd(2026, 2)).toBe('2026-02-28')
    expect(monthEnd(2024, 2)).toBe('2024-02-29') // leap year
  })
})

describe('addMonths', () => {
  it('increments and decrements correctly', () => {
    expect(addMonths(2026, 1, 1)).toEqual({ year: 2026, month: 2 })
    expect(addMonths(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
    expect(addMonths(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
  })
})

describe('mondayOf', () => {
  it('returns the Monday of the given week', () => {
    expect(mondayOf('2026-09-29')).toBe('2026-09-28') // Tuesday → previous Monday
    expect(mondayOf('2026-09-28')).toBe('2026-09-28') // Monday stays
    expect(mondayOf('2026-10-04')).toBe('2026-09-28') // Sunday → previous Monday
  })
})

describe('yearMonth', () => {
  it('extracts year and month', () => {
    expect(yearMonth('2026-09-15')).toEqual({ year: 2026, month: 9 })
  })
})

describe('weeksInMonth', () => {
  it('returns all Monday dates starting from or before the 1st', () => {
    const weeks = weeksInMonth(2026, 9) // September 2026
    expect(weeks.length).toBeGreaterThan(0)
    for (const w of weeks) {
      const d = new Date(w + 'T00:00')
      expect(d.getDay()).toBe(1) // Monday
    }
    expect(weeks[0] <= '2026-09-01').toBe(true) // first Monday is before or on Sep 1
    expect(weeks[weeks.length - 1] >= '2026-09-21').toBe(true) // last Monday in Sep
  })
})
