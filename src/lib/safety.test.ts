import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { confirmWordMatches, createAIExport, downloadBlob, shareOrDownload } from './backup'
import { gridCellLabel } from './gridLabel'
import { listPace, chartPace } from './running'
import { strings, type StringKey } from '../i18n/strings'
import { db } from '../db/db'
import type { RunLog } from '../db/types'
import { resetDb } from '../test/resetDb'

describe('delete confirmation word (A6)', () => {
  it('ignores surrounding spaces and letter case', () => {
    expect(confirmWordMatches('  delete ', 'DELETE')).toBe(true)
    expect(confirmWordMatches('Delete', 'DELETE')).toBe(true)
    expect(confirmWordMatches(' ลบ ', 'ลบ')).toBe(true)
  })
  it('rejects other words and empty input', () => {
    expect(confirmWordMatches('DELET', 'DELETE')).toBe(false)
    expect(confirmWordMatches('DEL ETE', 'DELETE')).toBe(false)
    expect(confirmWordMatches('', 'DELETE')).toBe(false)
    expect(confirmWordMatches('anything', '')).toBe(false)
  })
})

describe('shareOrDownload fallback (A6)', () => {
  const clicks: string[] = []
  beforeEach(() => {
    clicks.length = 0
    vi.stubGlobal('document', {
      createElement: () => ({ click() { clicks.push(this.download) }, href: '', download: '' }),
      body: { appendChild() {}, removeChild() {} }
    })
  })
  afterEach(() => vi.unstubAllGlobals())
  const blob = () => new Blob(['{}'], { type: 'application/json' })

  it('shares when the share sheet works', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share, canShare: () => true })
    expect(await shareOrDownload(blob(), 'a.json')).toBe(true)
    expect(share).toHaveBeenCalledOnce()
    expect(clicks).toEqual([])
  })

  it('falls back to a download when share throws NotAllowedError', async () => {
    vi.stubGlobal('navigator', {
      share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' })),
      canShare: () => true
    })
    expect(await shareOrDownload(blob(), 'a.json')).toBe(true)
    expect(clicks).toEqual(['a.json'])
  })

  it('falls back to a download on any other error', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new TypeError('boom')), canShare: () => true })
    expect(await shareOrDownload(blob(), 'b.json')).toBe(true)
    expect(clicks).toEqual(['b.json'])
  })

  it('does not download when the owner dismissed the share sheet', async () => {
    vi.stubGlobal('navigator', {
      share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })),
      canShare: () => true
    })
    expect(await shareOrDownload(blob(), 'c.json')).toBe(false)
    expect(clicks).toEqual([])
  })

  it('downloads when sharing files is unsupported', async () => {
    vi.stubGlobal('navigator', {})
    expect(await shareOrDownload(blob(), 'd.json')).toBe(true)
    expect(clicks).toEqual(['d.json'])
    expect(typeof downloadBlob).toBe('function')
  })
})

describe('interval run pace on the list (A3)', () => {
  const run: RunLog = {
    date: '2026-09-29', type: 'interval', distanceKm: 6, durationSec: 2400,
    repResults: [{ rep: 1, durationSec: 200, paceSecPerKm: 250 }, { rep: 2, durationSec: 190, paceSecPerKm: 237 }]
  }
  it('shows the overall average pace, not the fast reps', () => {
    expect(listPace(run)).toBe(400)
    expect(chartPace(run)).not.toBe(listPace(run))
  })
  it('is the same measure for other run types', () => {
    expect(listPace({ ...run, type: 'easy', repResults: undefined })).toBe(400)
  })
})

describe('two-language labels (A5)', () => {
  const tFor = (lang: 'th' | 'en') => (key: StringKey) => strings[lang][key]

  it('grid cells use the app language and a formatted date', () => {
    expect(gridCellLabel('2026-09-29', 'weights', 'en', tFor('en'))).toBe('29 Sept 2026: Weights')
    expect(gridCellLabel('2026-09-29', 'both', 'th', tFor('th'))).toBe('29 ก.ย. 2026: เวท, วิ่ง')
    expect(gridCellLabel('2026-09-29', 'none', 'th', tFor('th'))).toContain('ยังไม่มีบันทึก')
    expect(gridCellLabel('2026-09-29', 'other', 'en', tFor('en'))).toContain('Other activities')
  })

  it('has no raw ISO date in a label', () => {
    for (const lang of ['th', 'en'] as const) {
      expect(gridCellLabel('2026-09-29', 'running', lang, tFor(lang))).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    }
  })

  it('month navigation and Back labels exist in both languages', () => {
    for (const key of ['sum.prevMonth', 'sum.nextMonth', 'common.back'] as const) {
      expect(strings.th[key]).toBeTruthy()
      expect(strings.en[key]).toBeTruthy()
      expect(strings.th[key]).not.toBe(strings.en[key])
    }
  })

  it('every string key has both a Thai and an English text', () => {
    const th = Object.keys(strings.th)
    const en = Object.keys(strings.en)
    expect(en.sort()).toEqual(th.sort())
    for (const k of th) {
      expect((strings.th as Record<string, string>)[k]).toBeTruthy()
      expect((strings.en as Record<string, string>)[k]).toBeTruthy()
    }
  })
})

describe('AI export weights (A4)', () => {
  beforeEach(resetDb)

  it('includes warm-ups, setNumber and order, in a deterministic order', async () => {
    const sid = await db.sessions.add({ date: '2026-09-29', bodyParts: [], startedAt: 1, finishedAt: 2 })
    const mk = (order: number, name: string) => db.sessionExercises.add({
      sessionId: sid, exerciseId: order + 1, order, name, equipment: 'barbell', leftRight: false, bodyweight: false, timed: false
    })
    // Inserted out of order on purpose.
    const b = await mk(1, 'Row')
    const a = await mk(0, 'Bench')
    const add = (seId: number, setNumber: number, type: 'working' | 'warmup', weightKg: number) =>
      db.sets.add({ sessionExerciseId: seId, setNumber, type, exerciseId: 1, date: '2026-09-29', weightKg, reps: 5, toFailure: false })
    await add(a, 1, 'working', 60)
    await add(a, 0, 'warmup', 40)
    await add(a, 2, 'working', 62.5)
    await add(b, 0, 'working', 50)

    const out = JSON.parse(await (await createAIExport({ from: '2026-09-01', to: '2026-09-30', categories: new Set(['weights']) })).text())
    const ex = out.weights[0].exercises
    expect(ex.map((e: { name: string; order: number }) => [e.order, e.name])).toEqual([[0, 'Bench'], [1, 'Row']])
    expect(ex[0].sets.map((s: { setNumber: number; type: string }) => [s.setNumber, s.type])).toEqual([[0, 'warmup'], [1, 'working'], [2, 'working']])
    expect(ex[0].sets[0].weightKg).toBe(40)
  })

  it('keeps left/right durations', async () => {
    const sid = await db.sessions.add({ date: '2026-09-29', bodyParts: [], startedAt: 1, finishedAt: 2 })
    const se = await db.sessionExercises.add({
      sessionId: sid, exerciseId: 1, order: 0, name: 'Side Plank', equipment: 'bodyweight', leftRight: true, bodyweight: true, timed: true
    })
    await db.sets.add({ sessionExerciseId: se, setNumber: 0, type: 'working', exerciseId: 1, date: '2026-09-29', durationLeftSec: 40, durationRightSec: 35, toFailure: false })
    const out = JSON.parse(await (await createAIExport({ from: '2026-09-29', to: '2026-09-29', categories: new Set(['weights']) })).text())
    expect(out.weights[0].exercises[0].sets[0]).toMatchObject({ durationLeftSec: 40, durationRightSec: 35 })
  })
})
