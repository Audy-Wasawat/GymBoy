import { parseCount } from '../lib/numbers'
import { useT } from '../i18n/useT'

export const hmsToSec = (h: string, m: string, s: string) =>
  (parseCount(h) ?? 0) * 3600 + (parseCount(m) ?? 0) * 60 + (parseCount(s) ?? 0)

export const secToHms = (sec: number) => ({
  h: sec >= 3600 ? String(Math.floor(sec / 3600)) : '',
  m: String(Math.floor((sec % 3600) / 60)),
  s: String(sec % 60)
})

/** Hours : minutes : seconds boxes, used by the run and other-activity editors. */
export function DurationBoxes({ h, m, s, onH, onM, onS }: {
  h: string; m: string; s: string
  onH: (v: string) => void; onM: (v: string) => void; onS: (v: string) => void
}) {
  const t = useT()
  return (
    <div className="mt-1 flex items-start gap-2">
      <DurationBox value={h} onChange={onH} label={t('run.hours')} />
      <span className="flex min-h-[48px] items-center text-muted" aria-hidden>:</span>
      <DurationBox value={m} onChange={onM} label={t('run.minutes')} />
      <span className="flex min-h-[48px] items-center text-muted" aria-hidden>:</span>
      <DurationBox value={s} onChange={onS} label={t('run.seconds')} />
    </div>
  )
}

function DurationBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        placeholder="0"
        aria-label={label}
        className="min-h-[48px] w-full min-w-0 rounded-lg border border-line bg-bg px-2 text-center text-[16px]"
      />
      <span className="text-[12px] text-muted">{label}</span>
    </label>
  )
}

/** "1 hr 05 min", "45 min" or "12 min 30 sec" style text for a stored duration. */
export function formatHms(sec: number, t: ReturnType<typeof useT>) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const parts: string[] = []
  if (h) parts.push(`${h} ${t('run.hours')}`)
  if (m || (!h && !s)) parts.push(`${m} ${t('run.minutes')}`)
  if (s) parts.push(`${s} ${t('run.seconds')}`)
  return parts.join(' ')
}
