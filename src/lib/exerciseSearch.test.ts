import { describe, expect, it } from 'vitest'
import seeds from '../data/exercises.json'
import type { BodyPart, Equipment, Exercise, Muscle } from '../db/types'
import { strings } from '../i18n/strings'
import { BODY_PARTS, bodyPartOf } from './exercises'
import { searchExercises, stem } from './exerciseSearch'

// The library as the app seeds it.
const library: Exercise[] = (seeds as Array<Record<string, unknown>>).map((s, i) => ({
  id: i + 1,
  name: s.name as string,
  equipment: s.equipment as Equipment,
  bodyPart: s.bodyPart as BodyPart,
  seedKey: s.key as string,
  primaryMuscles: s.primaryMuscles as Muscle[],
  secondaryMuscles: s.secondaryMuscles as Muscle[],
  leftRight: s.leftRight as boolean,
  timed: s.timed as boolean,
  bodyweight: s.bodyweight as boolean,
  isCustom: false
}))

const names = (q: string) => searchExercises(library, q).map((e) => e.name)
const has = (q: string, name: string) => expect(names(q)).toContain(name)

describe('exercise search (B2)', () => {
  it('finds words in any order', () => {
    has('cable crunch', 'Kneeling Cable Crunch')
    has('crunch cable', 'Kneeling Cable Crunch')
    has('CABLE   Crunch', 'Kneeling Cable Crunch')
  })

  it('treats bicep and biceps as the same word', () => {
    for (const q of ['bicep curl', 'biceps curl']) {
      for (const n of ['Dumbbell Curl', 'Barbell Curl', 'Cable Curl', 'Machine Biceps Curl']) has(q, n)
    }
  })

  it('treats tricep/triceps and singular/plural forms alike', () => {
    has('tricep pushdown', 'Triceps Pushdown (Bar)')
    expect(names('triceps pushdown')).toEqual(names('tricep pushdown'))
    expect(names('crunches')).toContain('Crunch')
    expect(names('crunch')).toContain('Crunch')
    expect(names('raises').length).toBeGreaterThan(0)
    expect(names('raises')).toEqual(names('raise'))
    expect(stem('crunches')).toBe('crunch')
    expect(stem('biceps')).toBe('bicep')
    expect(stem('press')).toBe('press')
  })

  it('finds abdominal exercises by "abs" and by the Thai name', () => {
    const abs = library.filter((e) => e.primaryMuscles.includes('abs'))
    expect(abs.length).toBeGreaterThan(5)
    for (const q of ['abs', 'หน้าท้อง']) {
      const found = new Set(names(q))
      for (const e of abs) expect(found.has(e.name)).toBe(true)
    }
  })

  it('finds by muscle, equipment and body part in both languages', () => {
    has('ไบเซป', 'Barbell Curl')
    has('ขา', 'Back Squat')
    has('อก', 'Barbell Bench Press')
    has('หลัง', 'Deadlift') // its primary muscle is the lower back
    has('เคเบิล', 'Kneeling Cable Crunch')
    has('dumbbell chest', 'Dumbbell Bench Press')
    has('quads', 'Leg Extension')
    has('hip thrust', 'Barbell Hip Thrust')
  })

  it('finds every exercise of a body part by the Thai name of the group', () => {
    for (const part of BODY_PARTS) {
      const thai = strings.th[`part.${part}` as const]
      const english = strings.en[`part.${part}` as const]
      for (const q of [thai, english]) {
        const found = new Set(names(q))
        const ofPart = library.filter((e) => bodyPartOf(e) === part)
        expect(ofPart.length).toBeGreaterThan(0)
        for (const e of ofPart) expect(found.has(e.name), `${q} -> ${e.name}`).toBe(true)
      }
    }
  })

  it('an empty query returns everything, alphabetically', () => {
    for (const q of ['', '   ', '--']) {
      const all = names(q)
      expect(all).toHaveLength(library.length)
      expect(all).toEqual([...all].sort((a, b) => a.localeCompare(b)))
    }
  })

  it('returns nothing when a word matches nowhere', () => {
    expect(names('cable zzzz')).toEqual([])
  })

  it('lists name matches before muscle or equipment matches', () => {
    const list = searchExercises(library, 'curl')
    const firstOther = list.findIndex((e) => !/curl/i.test(e.name))
    const lastName = list.map((e) => /curl/i.test(e.name)).lastIndexOf(true)
    expect(firstOther === -1 || firstOther > lastName).toBe(true)
    // Exact word matches in the name come alphabetically.
    const exact = list.filter((e) => /(^|[^a-z])curl([^a-z]|$)/i.test(e.name)).map((e) => e.name)
    expect(exact).toEqual([...exact].sort((a, b) => a.localeCompare(b)))
  })

  it('ranks the exact Thai group name above pieces of longer Thai words', () => {
    const list = searchExercises(library, 'หลัง')
    const firstBack = list.findIndex((e) => bodyPartOf(e) === 'back')
    const firstHamstring = list.findIndex((e) => bodyPartOf(e) === 'hamstrings' && !e.primaryMuscles.includes('lower_back'))
    expect(firstBack).toBeGreaterThanOrEqual(0)
    expect(firstHamstring === -1 || firstBack < firstHamstring).toBe(true)
  })
})

describe('bodyPartOf (B4)', () => {
  const ex = (bodyPart: BodyPart | undefined, primaryMuscles: Muscle[]) => ({ bodyPart, primaryMuscles })

  it('uses the body part that is set', () => {
    expect(bodyPartOf(ex('chest', ['lats']))).toBe('chest')
  })

  it('derives it from the first primary muscle', () => {
    const cases: [Muscle, BodyPart][] = [
      ['chest_upper', 'chest'], ['chest_lower', 'chest'], ['lats', 'back'], ['mid_back', 'back'],
      ['lower_back', 'back'], ['traps', 'back'], ['delt_front', 'shoulders'], ['delt_side', 'shoulders'],
      ['delt_rear', 'shoulders'], ['biceps', 'biceps'], ['triceps', 'triceps'], ['forearms', 'forearms'],
      ['abs', 'core'], ['obliques', 'core'], ['quads', 'quads'], ['adductors', 'quads'],
      ['hamstrings', 'hamstrings'], ['glutes', 'glutes'], ['calves', 'calves']
    ]
    for (const [muscle, part] of cases) expect(bodyPartOf(ex(undefined, [muscle, 'calves']))).toBe(part)
  })

  it('is "mine" when there is neither', () => {
    expect(bodyPartOf(ex(undefined, []))).toBe('mine')
  })
})
