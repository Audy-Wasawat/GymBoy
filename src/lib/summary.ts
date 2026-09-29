import { localDate, parseLocalDate, startOfWeek } from './dates'

/** Returns the first day of a month as 'YYYY-MM-01'. */
export function monthStart(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

/** Returns the last day of a month as 'YYYY-MM-DD'. */
export function monthEnd(year: number, month: number): string {
  const d = new Date(year, month, 0) // day 0 of next month = last day of this month
  return localDate(d)
}

/** Returns { year, month } from a 'YYYY-MM-DD' string. */
export function yearMonth(s: string): { year: number; month: number } {
  const [y, m] = s.split('-').map(Number)
  return { year: y, month: m }
}

/** Adds months to { year, month }, clamping correctly. */
export function addMonths(y: number, m: number, n: number): { year: number; month: number } {
  const d = new Date(y, m - 1 + n, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

/** Monday of the week containing the given 'YYYY-MM-DD' string. */
export function mondayOf(dateStr: string): string {
  const d = parseLocalDate(dateStr)
  return localDate(startOfWeek(d))
}

/** All Monday dates in a given month range (from startOfWeek(firstDay) to last day). */
export function weeksInMonth(year: number, month: number): string[] {
  const start = monthStart(year, month)
  const end = monthEnd(year, month)
  const mondays: string[] = []
  let d = parseLocalDate(mondayOf(start))
  while (localDate(d) <= end) {
    mondays.push(localDate(d))
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)
  }
  return mondays
}
