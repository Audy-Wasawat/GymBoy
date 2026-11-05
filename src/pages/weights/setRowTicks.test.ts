// @vitest-environment jsdom
// The F (to failure) and good-form ticks must survive pressing ✓, even when typed before the ticks.
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useLiveQuery } from 'dexie-react-hooks'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, ensureSettings } from '../../db/db'
import { emptyDraft } from '../../db/sessions'
import type { SessionExercise } from '../../db/types'
import { resetDb } from '../../test/resetDb'
import { SetRow } from './SetRow'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
async function until(check: () => boolean | Promise<boolean>, tries = 80) {
  for (let i = 0; i < tries && !(await check()); i++) await wait(25)
  expect(await check()).toBe(true)
}
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const click = (el: Element) => act(async () => { (el as HTMLElement).click() })

let se: SessionExercise

/** Renders the row the way the session screen does: from the live draft in the database. */
function LiveRow({ draftId }: { draftId: number }) {
  const draft = useLiveQuery(() => db.setDrafts.get(draftId), [draftId])
  if (!draft) return null
  return createElement(SetRow, { se, row: { kind: 'draft', draft }, label: '1', unit: 'kg', date: '2026-11-05', onLabel: () => {} })
}

beforeEach(async () => {
  await resetDb()
  await ensureSettings()
  const sessionId = await db.sessions.add({ date: '2026-11-05', bodyParts: [], startedAt: 1 })
  se = {
    sessionId, exerciseId: 1, order: 0, name: 'Bench Press', equipment: 'barbell',
    leftRight: false, bodyweight: false, timed: false, targetSets: 3, repMin: 6, repMax: 8, restSec: 90
  }
  se.id = await db.sessionExercises.add(se)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('ticks on a set row', () => {
  it('F and good form ticked after typing are kept when the set is saved', async () => {
    const draftId = await db.setDrafts.add(emptyDraft(se.id!, 0))
    await act(async () => { root.render(createElement(LiveRow, { draftId })) })
    await until(() => container.querySelectorAll('input').length === 2)
    const [weight, reps] = [...container.querySelectorAll('input')]
    await type(weight, '60')
    await type(reps, '8')
    const failure = [...container.querySelectorAll('button')].find((b) => b.textContent === 'F')!
    const form = container.querySelector('button[aria-label="ฟอร์มดี"], button[aria-label="Good form"]')!
    await click(failure)
    await click(form)
    await until(async () => !!(await db.setDrafts.get(draftId))?.goodForm)
    const save = [...container.querySelectorAll('button')].at(-1)!
    await click(save)
    await until(async () => (await db.sets.count()) === 1)
    const [set] = await db.sets.toArray()
    expect(set).toMatchObject({ weightKg: 60, reps: 8, toFailure: true, goodForm: true })
  })

  it('ticks pressed right before ✓ are not lost', async () => {
    const draftId = await db.setDrafts.add({ ...emptyDraft(se.id!, 0), weight: '60', value: '8' })
    await act(async () => { root.render(createElement(LiveRow, { draftId })) })
    await until(() => container.querySelectorAll('input').length === 2)
    const failure = [...container.querySelectorAll('button')].find((b) => b.textContent === 'F')!
    const save = [...container.querySelectorAll('button')].at(-1)!
    // No wait between the two taps.
    await act(async () => { failure.click(); save.click() })
    await until(async () => (await db.sets.count()) === 1)
    expect((await db.sets.toArray())[0].toFailure).toBe(true)
  })
})
