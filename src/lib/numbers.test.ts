import { describe, expect, it } from 'vitest'
import { formatDuration, parseCount, parseDecimal, parseDuration } from './numbers'

describe('parseDecimal', () => {
  it('accepts a comma as the decimal mark', () => {
    expect(parseDecimal('1,5')).toBe(1.5)
    expect(parseDecimal('2.25')).toBe(2.25)
  })
  it('rejects rubbish and empty input', () => {
    expect(parseDecimal('')).toBeUndefined()
    expect(parseDecimal('abc')).toBeUndefined()
  })
})

describe('parseDuration / formatDuration', () => {
  it('reads plain seconds and mm:ss', () => {
    expect(parseDuration('45')).toBe(45)
    expect(parseDuration('1:30')).toBe(90)
  })
  it('formats seconds and minutes', () => {
    expect(formatDuration(45)).toBe('45')
    expect(formatDuration(90)).toBe('1:30')
  })
  it('rounds counts', () => {
    expect(parseCount('8,4')).toBe(8)
  })
  it('rejects a seconds part above 59', () => {
    expect(parseDuration('3:75')).toBeUndefined()
    expect(parseDuration('1:60')).toBeUndefined()
    expect(parseDuration('1:59')).toBe(119)
  })
})
