// @vitest-environment jsdom
// Renders the real exercise picker in a DOM, so "reopening gives a clean picker" is tested for real.
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, ensureSettings } from '../db/db'
import { seedExercises } from '../db/seed'
import type { Exercise } from '../db/types'
import { resetDb } from '../test/resetDb'
import { ExercisePicker } from './ExercisePicker'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
async function until(check: () => boolean, tries = 60) {
  for (let i = 0; i < tries && !check(); i++) await wait(25)
  expect(check()).toBe(true)
}

const searchBox = () => container.querySelector('input[type=search]') as HTMLInputElement | null
const chips = () => [...container.querySelectorAll('[aria-pressed]')] as HTMLButtonElement[]
const selected = () => chips().filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.textContent)
const rowNames = () => [...container.querySelectorAll('ul li button span:first-child')].map((s) => s.textContent ?? '')

async function type(value: string) {
  const input = searchBox()!
  await act(async () => {
    // React tracks the value itself, so the native setter is used to make the change visible to it.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const click = (el: Element) => act(async () => { (el as HTMLElement).click() })

function show(open: boolean, onPick: (e: Exercise) => void = () => {}, onClose: () => void = () => {}) {
  return act(async () => { root.render(createElement(ExercisePicker, { open, onPick, onClose })) })
}

beforeEach(async () => {
  await resetDb()
  await ensureSettings()
  await db.settings.update('app', { language: 'en' })
  await seedExercises()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

describe('the exercise picker in a DOM (B1)', () => {
  it('starts with no text and no filters', async () => {
    await show(true)
    await until(() => rowNames().length > 50)
    expect(searchBox()!.value).toBe('')
    expect(selected()).toHaveLength(2) // "all parts" and "all equipment"
  })

  it('searching narrows the list, and reopening the picker gives a clean one', async () => {
    await show(true)
    await until(() => rowNames().length > 50)
    const all = rowNames().length

    await type('cable crunch')
    await until(() => rowNames().length < all)
    expect(rowNames().some((n) => n === 'Kneeling Cable Crunch')).toBe(true)
    await click(chips().find((c) => c.textContent === 'Cable')!)
    expect(selected()).toContain('Cable')

    await show(false)
    expect(container.querySelector('[role=dialog]')).toBeNull()

    await show(true)
    await until(() => rowNames().length > 50)
    expect(searchBox()!.value).toBe('')
    expect(selected()).not.toContain('Cable')
    expect(selected()).toHaveLength(2)
    expect(rowNames().length).toBeGreaterThanOrEqual(all)
  })

  it('a pick clears the search and filters even when the parent keeps the picker open', async () => {
    const picked: string[] = []
    await show(true, (e) => picked.push(e.name))
    await until(() => rowNames().length > 50)
    await type('cable crunch')
    await until(() => rowNames().includes('Kneeling Cable Crunch'))
    await click([...container.querySelectorAll('ul li button')].find((b) => b.textContent?.startsWith('Kneeling Cable Crunch'))!)
    expect(picked).toEqual(['Kneeling Cable Crunch'])
    expect(searchBox()!.value).toBe('')
    expect(selected()).toHaveLength(2)
  })

  it('offers "create new exercise" first while searching, and when nothing matches', async () => {
    await show(true)
    await until(() => rowNames().length > 50)
    expect(container.textContent).not.toMatch(/Create new exercise|สร้างท่าใหม่/)
    await type('zzzzzz')
    await until(() => rowNames().length === 1)
    expect(rowNames()[0]).toMatch(/Create new exercise|สร้างท่าใหม่/)
    expect(container.querySelector('ul li')?.className).toContain('sticky')
    await type('curl')
    await until(() => rowNames().length > 5)
    expect(rowNames()[0]).toMatch(/Create new exercise|สร้างท่าใหม่/)
  })

  it('creating from the picker saves the exercise and picks it', async () => {
    const picked: Exercise[] = []
    await show(true, (e) => picked.push(e))
    await until(() => rowNames().length > 50)
    await type('My Special Move')
    await until(() => rowNames().length === 1)
    await click(container.querySelector('ul li button')!)
    const name = container.querySelector('#ex-name') as HTMLInputElement
    expect(name.value).toBe('My Special Move')
    const save = [...container.querySelectorAll('button')].find((b) => /Save and use this exercise|บันทึกและเลือกท่านี้/.test(b.textContent ?? ''))!
    await click(save)
    await until(() => picked.length === 1)
    expect(picked[0].name).toBe('My Special Move')
    expect((await db.exercises.where('name').equals('My Special Move').count())).toBe(1)
  })

  it('moves focus into the dialog, closes on Escape, keeps Tab inside and gives focus back', async () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const onClose = vi.fn()
    await show(true, () => {}, onClose)
    await until(() => rowNames().length > 50)
    const dialog = container.querySelector('[role=dialog]')!
    expect(dialog.contains(document.activeElement)).toBe(true)

    // Tab from the last control wraps to the first one; Shift+Tab from the first wraps to the last.
    const items = [...dialog.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select,textarea')]
    items[items.length - 1].focus()
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })) })
    expect(document.activeElement).toBe(items[0])
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })) })
    expect(document.activeElement).toBe(items[items.length - 1])

    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(onClose).toHaveBeenCalledOnce()

    await show(false)
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})
