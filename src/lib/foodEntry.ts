import { parseDecimal } from './numbers'

/** What the value fields of the food entry screen hold: per-portion kcal and protein, and the portion. */
export interface EntryFields { kcal: string; protein: string; portion: string }

const two = (n: number) => String(Math.round(n * 100) / 100)

/**
 * The fields to show when an entry is opened for editing. An entry stores the FINAL kcal and protein
 * (already times the portion), so the fields show the per-portion values; showing the stored ones
 * would multiply by the portion a second time on save.
 */
export function fieldsFromEntry(e: { kcal: number; proteinG: number; portion: number }): EntryFields {
  const per = e.portion > 0 ? e.portion : 1
  return { kcal: two(e.kcal / per), protein: two(e.proteinG / per), portion: String(e.portion) }
}

export const sameFields = (a: EntryFields, b: EntryFields) =>
  a.kcal === b.kcal && a.protein === b.protein && a.portion === b.portion

/** Portion, per-portion values and the final kcal (whole) and protein (1 decimal) of typed fields; empty or bad numbers read as 0 (portion 1). */
export function finalValues(f: EntryFields) {
  const p = parseDecimal(f.portion)
  const portion = p !== undefined && p > 0 ? p : 1
  const baseKcal = parseDecimal(f.kcal) ?? 0
  const baseProtein = parseDecimal(f.protein) ?? 0
  return {
    portion, baseKcal, baseProtein,
    kcal: Math.round(baseKcal * portion),
    proteinG: Math.round(baseProtein * portion * 10) / 10
  }
}
