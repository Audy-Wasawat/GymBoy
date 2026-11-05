// @vitest-environment jsdom
// Rest bar: quick repeated ±15 taps all count, −15 never ends the rest, and the chime plays only once.
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useLiveQuery } from 'dexie-react-hooks'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, ensureSettings } from '../../db/db'
import { resetDb } from '../../test/resetDb'

const sound = vi.hoisted(() => ({ playRestDone: vi.fn(async () => true), playCountdownTick: vi.fn(async () => {}) }))
vi.mock('../../lib/sound', () => sound)
const { RestBar } = await import('./RestBar')

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root
let sessionId: number
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
const btn = (text: string) => [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!
const left = async () => ((await db.sessions.get(sessionId))!.restEndsAt! - Date.now()) / 1000

function Live() {
  const session = useLiveQuery(() => db.sessions.get(sessionId), [])
  return session ? createElement(RestBar, { session }) : null
}

beforeEach(async () => {
  await resetDb()
  await ensureSettings()
  sound.playRestDone.mockClear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function start(sec: number) {
  sessionId = await db.sessions.add({ date: '2026-11-05', bodyParts: [], startedAt: 1, restEndsAt: Date.now() + sec * 1000, restTotalSec: sec })
  await act(async () => { root.render(createElement(Live)) })
  for (let i = 0; i < 40 && !container.querySelector('button'); i++) await wait(25)
}

describe('rest bar', () => {
  it('two quick +15 taps add 30 s', async () => {
    await start(60)
    await act(async () => { btn('+15').click(); btn('+15').click() })
    await wait(100)
    expect(await left()).toBeGreaterThan(88)
    expect((await db.sessions.get(sessionId))!.restTotalSec).toBe(90)
  })

  it('−15 with less than 15 s left stops at 1 s instead of ending the rest', async () => {
    await start(10)
    await act(async () => { btn('−15').click() })
    await wait(100)
    const l = await left()
    expect(l).toBeGreaterThan(0)
    expect(l).toBeLessThanOrEqual(1)
  })

  it('chimes once when the rest is over and not again while the bar stays up', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      await start(1)
      await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
      expect(sound.playRestDone).toHaveBeenCalledTimes(1)
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
      expect(sound.playRestDone).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
