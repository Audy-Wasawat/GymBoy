/** Local date as 'YYYY-MM-DD'. */
export const localDate = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday of the week containing d (weeks start on Monday). */
export const startOfWeek = (d = new Date()) => {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7))
  return copy
}

/**
 * 'YYYY-MM-DD' to a local Date at midnight. Never use new Date('YYYY-MM-DD') or toISOString():
 * both work in UTC, which shifts the day for UTC+7/+8.
 */
export const parseLocalDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * e.g. "29 ก.ย. 2026" / "29 Sept 2026", or without the year for short labels.
 * Thai uses the Gregorian calendar so years are always CE (th-TH alone would give BE, 2569).
 */
export const formatDate = (s: string, lang: 'th' | 'en', withYear = true) =>
  parseLocalDate(s).toLocaleDateString(lang === 'th' ? 'th-TH-u-ca-gregory' : 'en-GB', {
    day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {})
  })

/** True for a valid 'YYYY-MM-DD' that is not after today. */
export const isPastOrToday = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && s <= localDate()
