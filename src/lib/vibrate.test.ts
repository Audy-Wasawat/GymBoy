import { afterEach, describe, expect, it, vi } from 'vitest'
import { canVibrate, REST_DONE_PATTERN, vibrateRestDone } from './vibrate'

afterEach(() => vi.unstubAllGlobals())

describe('vibration at the end of a rest', () => {
  it('buzzes with the pattern where the browser can', () => {
    const vibrate = vi.fn().mockReturnValue(true)
    vi.stubGlobal('navigator', { vibrate })
    expect(canVibrate()).toBe(true)
    expect(vibrateRestDone()).toBe(true)
    expect(vibrate).toHaveBeenCalledWith(REST_DONE_PATTERN)
  })

  it('does nothing when it is turned off', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { vibrate })
    expect(vibrateRestDone(false)).toBe(false)
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('does nothing and does not fail where vibration is missing (iPhone)', () => {
    vi.stubGlobal('navigator', {})
    expect(canVibrate()).toBe(false)
    expect(vibrateRestDone()).toBe(false)
  })

  it('does not fail when the browser refuses', () => {
    vi.stubGlobal('navigator', { vibrate: () => { throw new Error('blocked') } })
    expect(vibrateRestDone()).toBe(false)
    vi.stubGlobal('navigator', { vibrate: () => false })
    expect(vibrateRestDone()).toBe(false)
  })

  it('the pattern is a few short buzzes ending in a long one', () => {
    expect(REST_DONE_PATTERN.length % 2).toBe(1)
    expect(REST_DONE_PATTERN[REST_DONE_PATTERN.length - 1]).toBeGreaterThan(REST_DONE_PATTERN[0])
    expect(REST_DONE_PATTERN.reduce((a, b) => a + b, 0)).toBeLessThan(2000)
  })
})
