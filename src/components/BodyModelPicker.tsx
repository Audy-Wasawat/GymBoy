import { useState } from 'react'
import type { Muscle } from '../db/types'
import { useT } from '../i18n/useT'
import { MusclePicker } from './Muscles'
import { BACK as BACK_SHAPES, FRONT as FRONT_SHAPES, HEAD, SILHOUETTE, type Shape } from './bodyShapes'

function fillClass(m: Muscle, primary: Muscle[], secondary: Muscle[], isClickable: boolean): string {
  const base = primary.includes(m) ? 'fill-weights' : secondary.includes(m) ? 'fill-weights/40' : 'fill-muted/25'
  return isClickable ? `${base} cursor-pointer` : base
}

interface InteractiveFigureProps {
  shapes: Partial<Record<Muscle, Shape[]>>
  primary: Muscle[]
  secondary: Muscle[]
  onTap: (m: Muscle) => void
  dx: number
}

function InteractiveFigure({ shapes, primary, secondary, onTap, dx }: InteractiveFigureProps) {
  // Each region is drawn, then drawn again on top as an invisible shape with a wide stroke: the
  // muscles are thin (calves are 3 units wide), so this widens the area that answers a tap.
  const regions = Object.entries(shapes) as [Muscle, Shape[]][]
  const hit = { fill: 'transparent', stroke: 'transparent', strokeWidth: 9, pointerEvents: 'all' as const, className: 'cursor-pointer' }
  const half = (
    <>
      <path d={SILHOUETTE} className="fill-muted/15" stroke="none" />
      {regions.map(([m, shps]) => {
        const cls = fillClass(m, primary, secondary, false)
        return shps.map((s, i) => {
          const key = `${m}${i}`
          if ('d' in s) return <path key={key} d={s.d} className={cls} />
          const [cx, cy, rx, ry, rot] = s.ellipse
          return <ellipse key={key} cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(${rot} ${cx} ${cy})`} className={cls} />
        })
      })}
      {regions.map(([m, shps]) => shps.map((s, i) => {
        const key = `hit-${m}${i}`
        if ('d' in s) return <path key={key} d={s.d} {...hit} onClick={() => onTap(m)} />
        const [cx, cy, rx, ry, rot] = s.ellipse
        return <ellipse key={key} cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(${rot} ${cx} ${cy})`} {...hit} onClick={() => onTap(m)} />
      }))}
    </>
  )
  return (
    <g transform={`translate(${dx} 0)`} className="stroke-surface" strokeWidth={0.6} strokeLinejoin="round">
      <ellipse cx={HEAD.cx} cy={HEAD.cy} rx={HEAD.rx} ry={HEAD.ry} className="fill-muted/15" stroke="none" />
      {half}
      <g transform="translate(100 0) scale(-1 1)">{half}</g>
    </g>
  )
}

/**
 * Interactive body model + chip fallback for muscle editing.
 * Tapping a region cycles: none → primary → secondary → none.
 * The chip picker below stays for accessibility.
 */
export function BodyModelPicker({ primary, secondary, onChange }: {
  primary: Muscle[]
  secondary: Muscle[]
  onChange: (primary: Muscle[], secondary: Muscle[]) => void
}) {
  const t = useT()
  const [view, setView] = useState<'front' | 'back'>('front')

  function cycle(m: Muscle) {
    if (primary.includes(m)) {
      onChange(primary.filter((x) => x !== m), [...secondary, m])
    } else if (secondary.includes(m)) {
      onChange(primary, secondary.filter((x) => x !== m))
    } else {
      onChange([...primary, m], secondary)
    }
  }

  const shapes = view === 'front' ? FRONT_SHAPES : BACK_SHAPES

  return (
    <div>
      {/* front/back toggle */}
      <div className="mb-3 flex gap-2">
        {(['front', 'back'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            aria-pressed={view === v}
            className={`min-h-[44px] flex-1 rounded-xl px-4 text-[14px] font-semibold ${view === v ? 'bg-weights text-white' : 'bg-raised text-muted'}`}
          >
            {v === 'front' ? t('body.front') : t('body.back')}
          </button>
        ))}
      </div>

      {/* clickable body model */}
      <div className="mb-3 flex justify-center">
        <svg
          viewBox="0 0 100 200"
          height={320}
          width={160}
          aria-hidden="true"
        >
          <InteractiveFigure
            shapes={shapes}
            primary={primary}
            secondary={secondary}
            onTap={cycle}
            dx={0}
          />
        </svg>
      </div>

      {/* chip fallback */}
      <MusclePicker primary={primary} secondary={secondary} onChange={onChange} />
    </div>
  )
}
