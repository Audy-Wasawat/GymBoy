import { describe, expect, it } from 'vitest'
import { fitDimensions, BODY_PHOTO_MAX, FOOD_PHOTO_MAX } from './photos'

describe('fitDimensions', () => {
  it('scales landscape image so longest side == maxSide', () => {
    const { w, h } = fitDimensions(1600, 900, 800)
    expect(w).toBe(800)
    expect(h).toBe(450)
  })
  it('scales portrait image so longest side == maxSide', () => {
    const { w, h } = fitDimensions(900, 1600, 800)
    expect(w).toBe(450)
    expect(h).toBe(800)
  })
  it('does not enlarge smaller images', () => {
    const { w, h } = fitDimensions(400, 300, 800)
    expect(w).toBe(400)
    expect(h).toBe(300)
  })
  it('square image scales correctly', () => {
    const { w, h } = fitDimensions(1000, 1000, 480)
    expect(w).toBe(480)
    expect(h).toBe(480)
  })
  it('uses correct max values for body and food', () => {
    expect(BODY_PHOTO_MAX).toBe(800)
    expect(FOOD_PHOTO_MAX).toBe(480)
  })
})
