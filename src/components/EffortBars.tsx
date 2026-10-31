import { useRef } from 'react'
import { useT } from '../i18n/useT'
import type { StringKey } from '../i18n/strings'

export const EFFORT_MAX = 10
/** Five boxes, each worth two effort points: a half-filled box is the odd value, a full one the even. */
const BOXES = EFFORT_MAX / 2

/** Apple Watch style bands: 1-3 easy, 4-6 moderate, 7-8 hard, 9-10 all out. */
export function effortLabelKey(n: number): StringKey {
  return n <= 3 ? 'act.effortEasy' : n <= 6 ? 'act.effortModerate' : n <= 8 ? 'act.effortHard' : 'act.effortAllOut'
}

/** The colour of a rating follows its band: green, yellow, orange, red. */
export function effortTone(n: number): { bg: string; text: string } {
  return n <= 3 ? { bg: 'bg-food', text: 'text-food' }
    : n <= 6 ? { bg: 'bg-other', text: 'text-other' }
    : n <= 8 ? { bg: 'bg-effort-hard', text: 'text-effort-hard' }
    : { bg: 'bg-weights', text: 'text-weights' }
}

/** Box heights rise step by step, like a phone's signal meter. */
const heightPct = (i: number) => 28 + (72 * i) / (BOXES - 1)

/** How much of box i (0-4) a rating fills: 0, 0.5 or 1. */
const fillOf = (i: number, value: number) => Math.max(0, Math.min(1, (value - i * 2) / 2))

function Box({ fill, bg, empty, rounded }: { fill: number; bg: string; empty: string; rounded: string }) {
  return (
    <span className={`relative block h-full w-full overflow-hidden ${rounded} ${empty}`}>
      {fill > 0 && <span className={`absolute inset-y-0 left-0 ${bg}`} style={{ width: `${fill * 100}%` }} />}
    </span>
  )
}

/** A small read-only effort meter for lists: five rising boxes filled up to the rating. */
export function EffortMeter({ value, className = '' }: { value: number; className?: string }) {
  const { bg } = effortTone(value)
  return (
    <span className={`inline-flex h-4 shrink-0 items-end gap-[2px] ${className}`} aria-hidden>
      {Array.from({ length: BOXES }, (_, i) => (
        <span key={i} className="flex w-[6px] items-end" style={{ height: `${heightPct(i)}%` }}>
          <Box fill={fillOf(i, value)} bg={bg} empty="bg-line" rounded="rounded-[1.5px]" />
        </span>
      ))}
    </span>
  )
}

/**
 * Effort picker: five rising boxes worth two points each. Tapping the left half of a box gives the
 * odd value, the right half the even one; a finger can also slide across. Works as a slider for
 * screen readers and the keyboard (arrow keys). `undefined` means not rated.
 */
export function EffortPicker({ value, onChange }: { value?: number; onChange: (v: number | undefined) => void }) {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  const tone = value ? effortTone(value) : undefined

  function pick(clientX: number) {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const i = Math.floor(((clientX - r.left) / r.width) * EFFORT_MAX)
    onChange(Math.min(EFFORT_MAX, Math.max(1, i + 1)))
  }

  function onKey(e: React.KeyboardEvent) {
    const cur = value ?? 0
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(EFFORT_MAX, cur + 1)) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(cur <= 1 ? undefined : cur - 1) }
  }

  return (
    <div>
      <div className="mb-2 flex min-h-[44px] items-center justify-between gap-3">
        <div className="min-w-0">
          {value && tone ? (
            <span className="flex items-baseline gap-2">
              <span className={`text-[28px] font-bold leading-none ${tone.text}`}>{value}</span>
              <span className="text-[15px] text-muted">/ {EFFORT_MAX}</span>
              <span className={`truncate text-[15px] font-semibold ${tone.text}`}>{t(effortLabelKey(value))}</span>
            </span>
          ) : (
            <span className="text-[15px] text-muted">{t('act.effortNone')}</span>
          )}
        </div>
        {value !== undefined && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="min-h-[44px] shrink-0 rounded-lg px-3 text-[14px] font-semibold text-muted"
          >
            {t('act.effortClear')}
          </button>
        )}
      </div>
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label={t('act.effort')}
        aria-valuemin={1}
        aria-valuemax={EFFORT_MAX}
        aria-valuenow={value}
        aria-valuetext={value ? `${value} / ${EFFORT_MAX} ${t(effortLabelKey(value))}` : t('act.effortNone')}
        onKeyDown={onKey}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); pick(e.clientX) }}
        onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e.clientX) }}
        className="flex h-16 touch-none select-none items-end gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-other"
      >
        {Array.from({ length: BOXES }, (_, i) => (
          <span key={i} className="flex h-full flex-1 items-end">
            <span className="block w-full" style={{ height: `${heightPct(i)}%` }}>
              <Box fill={value ? fillOf(i, value) : 0} bg={tone?.bg ?? ''} empty="bg-raised" rounded="rounded-[6px]" />
            </span>
          </span>
        ))}
      </div>
      <div className="mt-1 flex gap-2 text-[12px] text-muted" aria-hidden>
        {Array.from({ length: BOXES }, (_, i) => (
          <span key={i} className="flex-1 text-center">{i * 2 + 1}–{i * 2 + 2}</span>
        ))}
      </div>
    </div>
  )
}
