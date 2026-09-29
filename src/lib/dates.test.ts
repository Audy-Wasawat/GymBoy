import { describe, expect, it } from 'vitest'
import { formatDate, isPastOrToday, localDate, parseLocalDate, startOfWeek } from './dates'

describe('localDate', () => {
  it('uses the local calendar day, never UTC', () => {
    // 23:30 local on 29 Sept must read as the 29th even at UTC+8/+13, where toISOString rolls to the 30th.
    expect(localDate(new Date(2026, 8, 29, 23, 30))).toBe('2026-09-29')
    // 00:30 local must not roll back a day at negative offsets.
    expect(localDate(new Date(2026, 8, 29, 0, 30))).toBe('2026-09-29')
  })
})

describe('startOfWeek', () => {
  it('returns the Monday of the week', () => {
    // 29 Sept 2026 is a Tuesday, so its week starts Monday the 28th.
    expect(localDate(startOfWeek(new Date(2026, 8, 29)))).toBe('2026-09-28')
    // A Sunday belongs to the week that started the previous Monday.
    expect(localDate(startOfWeek(new Date(2026, 9, 4)))).toBe('2026-09-28')
    // A Monday is its own week start.
    expect(localDate(startOfWeek(new Date(2026, 8, 28)))).toBe('2026-09-28')
  })
})

describe('parseLocalDate', () => {
  it('round-trips with localDate', () => {
    expect(localDate(parseLocalDate('2026-09-29'))).toBe('2026-09-29')
  })
})

describe('isPastOrToday', () => {
  it('accepts today and the past, rejects the future and rubbish', () => {
    expect(isPastOrToday(localDate())).toBe(true)
    expect(isPastOrToday('2000-01-01')).toBe(true)
    expect(isPastOrToday('2999-01-01')).toBe(false)
    expect(isPastOrToday('nonsense')).toBe(false)
  })
})

describe('formatDate', () => {
  it('shows a Gregorian (CE) year in Thai, not the Buddhist year', () => {
    expect(formatDate('2026-09-29', 'th')).toContain('2026')
    expect(formatDate('2026-09-29', 'en')).toContain('2026')
  })
})
