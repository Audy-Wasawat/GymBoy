import type { Exercise } from '../db/types'
import { strings, type StringKey } from '../i18n/strings'
import { bodyPartOf } from './exercises'

/**
 * Exercise search. The query is split into words and every word must match some word of the
 * exercise text, in any order, as a prefix or as a contained piece. The text is the name plus the
 * equipment, the body part and the primary muscles, in English and in Thai whatever the app
 * language is. bicep/biceps and singular/plural forms count as the same word.
 */

/** Extra words people type for a label, added to the label's own English and Thai text. */
const ALIASES: Partial<Record<StringKey, string[]>> = {
  'part.chest': ['pec', 'pecs', 'pectoral', 'หน้าอก'],
  'part.back': ['lat', 'lats', 'trap', 'traps'],
  'part.shoulders': ['delt', 'delts', 'deltoid', 'shoulder'],
  'part.biceps': ['ไบเซป', 'ไบเซ็ป', 'ไบเซพ', 'arm', 'arms', 'แขน'],
  'part.triceps': ['ไตรเซป', 'ไตรเซ็ป', 'ไตรเซพ', 'arm', 'arms', 'แขน'],
  'part.forearms': ['forearm', 'wrist', 'grip', 'arm', 'arms', 'แขน', 'ข้อมือ'],
  'part.core': ['abs', 'abdominal', 'abdominals', 'ท้อง', 'หน้าท้อง', 'ซิกแพค'],
  'part.quads': ['quad', 'quadricep', 'quadriceps', 'thigh', 'leg', 'legs', 'ขา'],
  'part.hamstrings': ['hamstring', 'thigh', 'leg', 'legs', 'ขา', 'แฮมสตริง'],
  'part.glutes': ['glute', 'butt', 'hip', 'hips', 'สะโพก', 'leg', 'legs', 'ขา'],
  'part.calves': ['calf', 'leg', 'legs', 'ขา'],
  'muscle.chest_upper': ['chest', 'pec', 'หน้าอก'],
  'muscle.chest_lower': ['chest', 'pec', 'หน้าอก'],
  'muscle.delt_front': ['delt', 'shoulder', 'ไหล่'],
  'muscle.delt_side': ['delt', 'shoulder', 'ไหล่'],
  'muscle.delt_rear': ['delt', 'shoulder', 'ไหล่'],
  'muscle.biceps': ['ไบเซป', 'ไบเซ็ป', 'ไบเซพ', 'arm', 'แขน'],
  'muscle.triceps': ['ไตรเซป', 'ไตรเซ็ป', 'ไตรเซพ', 'arm', 'แขน'],
  'muscle.forearms': ['forearm', 'arm', 'แขน'],
  'muscle.abs': ['ab', 'abdominal', 'abdominals', 'core', 'ท้อง', 'ซิกแพค'],
  'muscle.obliques': ['oblique', 'core', 'abs', 'ท้อง'],
  'muscle.traps': ['trap', 'trapezius', 'back'],
  'muscle.lats': ['lat', 'back', 'หลัง'],
  'muscle.mid_back': ['back', 'rhomboid'],
  'muscle.lower_back': ['back', 'lumbar', 'หลัง'],
  'muscle.glutes': ['glute', 'butt', 'hip', 'สะโพก', 'leg', 'ขา'],
  'muscle.quads': ['quad', 'quadricep', 'quadriceps', 'thigh', 'leg', 'ขา'],
  'muscle.hamstrings': ['hamstring', 'thigh', 'leg', 'ขา', 'แฮมสตริง'],
  'muscle.adductors': ['adductor', 'inner', 'thigh', 'leg', 'ขา'],
  'muscle.calves': ['calf', 'leg', 'ขา']
}

const norm = (s: string) => s.normalize('NFC').toLowerCase()

/** Words of a text; letters, marks (Thai vowels and tones) and digits are kept together. */
export function tokenize(text: string): string[] {
  return norm(text).split(/[^\p{L}\p{N}\p{M}]+/u).filter(Boolean)
}

/** Singular form of an English word: biceps -> bicep, crunches -> crunch, raises -> raise. */
export function stem(w: string): string {
  if (!/^[a-z]+$/.test(w)) return w
  if (/(ches|shes|sses|xes|zes)$/.test(w)) return w.slice(0, -2)
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  return w
}

/** The word itself and, when it is long enough to be safe, its singular form. */
const variants = (w: string) => {
  const s = stem(w)
  return s !== w && s.length >= 3 ? [w, s] : [w]
}

const labels = (key: StringKey) => [strings.th[key], strings.en[key], ...(ALIASES[key] ?? [])]

interface Text { name: string[][]; other: string[][] }
const cache = new WeakMap<Exercise, Text>()

function textOf(e: Exercise): Text {
  let t = cache.get(e)
  if (!t) {
    const part = bodyPartOf(e)
    const otherWords = [
      ...labels(`equip.${e.equipment}` as StringKey),
      ...labels(`part.${part}` as StringKey),
      ...e.primaryMuscles.flatMap((m) => labels(`muscle.${m}` as StringKey))
    ].flatMap(tokenize)
    t = {
      name: tokenize(e.name).map(variants),
      other: otherWords.map(variants)
    }
    cache.set(e, t)
  }
  return t
}

// 0 exact, 1 prefix, 2 contained
function strength(qv: string[], wv: string[]): number | undefined {
  let best: number | undefined
  for (const q of qv) {
    for (const w of wv) {
      const s = w === q ? 0 : w.startsWith(q) ? 1 : w.includes(q) ? 2 : undefined
      if (s !== undefined && (best === undefined || s < best)) best = s
    }
  }
  return best
}

/** Score of one query word against an exercise (lower is better), or undefined for no match. */
function wordScore(q: string[], t: Text): number | undefined {
  let best: number | undefined
  for (const w of t.name) {
    const s = strength(q, w)
    if (s !== undefined && (best === undefined || s < best)) best = s // name matches: 0..2
  }
  if (best !== undefined) return best
  for (const w of t.other) {
    const s = strength(q, w)
    if (s !== undefined && (best === undefined || s + 3 < best)) best = s + 3 // muscles, equipment, body part: 3..5
  }
  return best
}

/** Exercises matching the query, best first: name matches, then muscles or equipment, then A to Z. */
export function searchExercises(exercises: Exercise[], query: string): Exercise[] {
  const words = tokenize(query).map(variants)
  const byName = (a: Exercise, b: Exercise) => a.name.localeCompare(b.name) || (a.id ?? 0) - (b.id ?? 0)
  if (words.length === 0) return [...exercises].sort(byName)
  const scored: { e: Exercise; score: number }[] = []
  for (const e of exercises) {
    const t = textOf(e)
    let score = 0
    let ok = true
    for (const q of words) {
      const s = wordScore(q, t)
      if (s === undefined) { ok = false; break }
      score += s
    }
    if (ok) scored.push({ e, score })
  }
  scored.sort((a, b) => a.score - b.score || byName(a.e, b.e))
  return scored.map((x) => x.e)
}
