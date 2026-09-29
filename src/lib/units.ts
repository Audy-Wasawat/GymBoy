import type { WeightUnit } from '../db/types'

const LB_PER_KG = 2.20462

export const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp

export const toDisplayWeight = (kg: number, unit: WeightUnit) =>
  unit === 'kg' ? round(kg, 2) : round(kg * LB_PER_KG, 1)

export const fromDisplayWeight = (value: number, unit: WeightUnit) =>
  unit === 'kg' ? value : value / LB_PER_KG

export const formatPace = (secPerKm: number) => {
  // Round the total first, then split, so a seconds field that rounds to 60 carries into the minute.
  const total = Math.round(secPerKm)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
