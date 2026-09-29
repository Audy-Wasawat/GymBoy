/** Parses typed numbers; ',' is accepted as the decimal mark. Returns undefined for empty or invalid input. */
export function parseDecimal(text: string): number | undefined {
  const t = text.trim().replace(',', '.')
  if (!t || !/^\d*\.?\d*$/.test(t)) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

export function parseCount(text: string): number | undefined {
  const n = parseDecimal(text)
  return n === undefined ? undefined : Math.round(n)
}

/** Accepts plain seconds ("45") or minutes:seconds ("1:30"); the seconds part must be 0-59. */
export function parseDuration(text: string): number | undefined {
  const t = text.trim()
  const m = /^(\d+):(\d{1,2})$/.exec(t)
  if (m) {
    const secs = Number(m[2])
    if (secs > 59) return undefined
    return Number(m[1]) * 60 + secs
  }
  return parseCount(t)
}

/** "45" under a minute, "1:30" from a minute up. */
export function formatDuration(sec: number): string {
  if (sec < 60) return String(sec)
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}
