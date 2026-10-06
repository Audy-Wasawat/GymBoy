import { afterEach, describe, expect, it, vi } from 'vitest'

class FakeCtx {
  static made: FakeCtx[] = []
  state: string = 'running'
  currentTime = 0
  destination = {}
  constructor() { FakeCtx.made.push(this) }
  resume = vi.fn(async () => {})
  close = vi.fn(async () => { this.state = 'closed' })
  createBuffer() { return {} }
  createBufferSource() { return { connect() {}, start() {}, buffer: null } }
  createOscillator() { return { type: '', frequency: { value: 0 }, connect: (n: unknown) => n, start() {}, stop() {} } }
  createGain() {
    const g = { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n: unknown) => n }
    return g
  }
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); FakeCtx.made = [] })

async function load() {
  vi.stubGlobal('window', { AudioContext: FakeCtx })
  return import('./sound')
}

describe('rest timer sound', () => {
  it('replaces a context iOS left interrupted, so later alarms still play', async () => {
    const { unlockAudio, playRestDone } = await load()
    unlockAudio()
    expect(FakeCtx.made).toHaveLength(1)
    FakeCtx.made[0].state = 'interrupted' // the app went to the background
    unlockAudio() // next tap
    expect(FakeCtx.made).toHaveLength(2)
    expect(FakeCtx.made[0].close).toHaveBeenCalled()
    expect(await playRestDone()).toBe(true)
  })

  it('keeps a running context', async () => {
    const { unlockAudio } = await load()
    unlockAudio()
    unlockAudio()
    expect(FakeCtx.made).toHaveLength(1)
  })

  it('does not throw away a context that is still starting, even with several taps', async () => {
    const { unlockAudio } = await load()
    unlockAudio()
    FakeCtx.made[0].state = 'suspended' // iOS: a new context starts suspended until resume() lands
    unlockAudio() // touchend
    unlockAudio() // click on the same tap
    expect(FakeCtx.made).toHaveLength(1)
    expect(FakeCtx.made[0].close).not.toHaveBeenCalled()
  })

  it('replaces a context that stays stopped after a resume', async () => {
    vi.useFakeTimers()
    const { unlockAudio } = await load()
    unlockAudio()
    FakeCtx.made[0].state = 'suspended'
    unlockAudio() // asks for resume
    vi.advanceTimersByTime(1000)
    unlockAudio() // still suspended a second later
    expect(FakeCtx.made).toHaveLength(2)
    vi.useRealTimers()
  })

  it('the settings test plays once the context runs', async () => {
    const { previewRestDone } = await load()
    expect(await previewRestDone()).toBe(true)
  })

  it('stays silent, without throwing, when the context cannot run', async () => {
    const { unlockAudio, playRestDone } = await load()
    unlockAudio()
    FakeCtx.made[0].state = 'interrupted'
    expect(await playRestDone()).toBe(false)
  })
})
