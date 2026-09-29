import { describe, expect, it } from 'vitest'
import { formatPace, fromDisplayWeight, toDisplayWeight } from './units'

describe('formatPace', () => {
  it('formats seconds per km as m:ss', () => {
    expect(formatPace(300)).toBe('5:00')
    expect(formatPace(250)).toBe('4:10')
  })
  it('carries a rounded-up seconds field into the minute (never ":60")', () => {
    expect(formatPace(59.6)).toBe('1:00')
    expect(formatPace(299.7)).toBe('5:00')
    expect(formatPace(119.8)).toBe('2:00')
  })
})

describe('weight units', () => {
  it('round-trips kg through a lb display within display precision', () => {
    const kg = 60
    const lb = toDisplayWeight(kg, 'lb')
    // The lb value is shown to 1 dp, so the round-trip is exact only to display precision.
    expect(fromDisplayWeight(lb, 'lb')).toBeCloseTo(60, 1)
  })
  it('keeps kg unchanged', () => {
    expect(toDisplayWeight(42.5, 'kg')).toBe(42.5)
    expect(fromDisplayWeight(42.5, 'kg')).toBe(42.5)
  })
})
