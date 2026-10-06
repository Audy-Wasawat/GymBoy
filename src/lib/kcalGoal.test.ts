import { describe, expect, it } from 'vitest'
import { kcalStatus, parseGoal } from './kcalGoal'

describe('daily calorie goal with a floor and a ceiling', () => {
  it('has no status without a goal', () => expect(kcalStatus(1500)).toEqual({ state: 'none' }))
  it('counts up to the floor', () => expect(kcalStatus(1500, 1900, 2200)).toEqual({ state: 'below', toMin: 400, max: 2200 }))
  it('is in range between the two, with room left', () => expect(kcalStatus(2000, 1900, 2200)).toEqual({ state: 'in', room: 200 }))
  it('reports how far over the ceiling', () => expect(kcalStatus(2350, 1900, 2200)).toEqual({ state: 'over', over: 150 }))
  it('works with only a floor (the old single goal)', () => {
    expect(kcalStatus(1000, 1900)).toEqual({ state: 'below', toMin: 900, max: undefined })
    expect(kcalStatus(2500, 1900)).toEqual({ state: 'in', room: undefined })
  })
  it('works with only a ceiling', () => {
    expect(kcalStatus(1000, undefined, 2200)).toEqual({ state: 'in', room: 1200 })
    expect(kcalStatus(2300, undefined, 2200)).toEqual({ state: 'over', over: 100 })
  })
  it('reads typed goals', () => {
    expect(parseGoal('2200')).toBe(2200)
    expect(parseGoal(' ')).toBeUndefined()
    expect(parseGoal('abc')).toBeUndefined()
    expect(parseGoal('-5')).toBeUndefined()
  })
})
