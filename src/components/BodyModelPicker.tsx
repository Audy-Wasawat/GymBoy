import { useState } from 'react'
import type { Muscle } from '../db/types'
import { useT } from '../i18n/useT'
import { MusclePicker } from './Muscles'

type Shape = { d: string } | { ellipse: [cx: number, cy: number, rx: number, ry: number, rotate: number] }

const FRONT_SHAPES: Partial<Record<Muscle, Shape[]>> = {
  traps: [{ d: 'M44.5 29.5 L46 34 L37 36.5 Z' }],
  delt_front: [{ d: 'M34.5 36.5 L39 37.5 L37 47 L31.5 51 L31 44 Z' }],
  delt_side: [{ d: 'M34 36 L31 44 L31.5 51 L26 52 L25.5 45 L28.5 39.5 Z' }],
  chest_upper: [{ d: 'M39.5 37.5 L49.5 37 L49.5 45.5 L37 47.5 Z' }],
  chest_lower: [{ d: 'M37 48 L49.5 46 L49.5 55 L41 58 L36.5 55 Z' }],
  biceps: [{ ellipse: [29, 60, 3.6, 9.5, 8] }],
  forearms: [{ d: 'M24 75 L29.5 74 L26.5 95 L21.5 95.5 Z' }],
  abs: [{ d: 'M43.5 58.5 L49.5 57.5 L49.5 92 L44.5 90 Z' }],
  obliques: [{ d: 'M36.5 59 L42.5 59.5 L43.5 88 L37 85 Z' }],
  quads: [{ d: 'M34.5 99 L44 101 L46.5 124 L45 141 L37.5 143 L34 124 Z' }],
  adductors: [{ d: 'M45 101.5 L49.5 104 L48 118 L46.5 123 Z' }],
  calves: [{ d: 'M36.5 152 L40 150 L40.5 176 L38 178 Z' }, { d: 'M41.5 150 L44.5 152 L43.5 176 L41.5 177 Z' }]
}

const BACK_SHAPES: Partial<Record<Muscle, Shape[]>> = {
  traps: [{ d: 'M49.5 28 L45 29 L44.5 33 L37.5 36.5 L43 41 L49.5 45 Z' }],
  delt_rear: [{ d: 'M37 37.5 L42 41.5 L37 48 L31.5 51 L31 44 Z' }],
  delt_side: [{ d: 'M34 36 L31 44 L31.5 51 L26 52 L25.5 45 L28.5 39.5 Z' }],
  mid_back: [{ d: 'M43.5 42 L49.5 46 L49.5 62 L45 59 L40 48.5 Z' }],
  lats: [{ d: 'M38 47.5 L44.5 59 L48 64 L46.5 80 L40 84 L35.5 68 L35.5 56 Z' }],
  lower_back: [{ d: 'M46 66 L49.5 64.5 L49.5 90 L44.5 90 L47.5 81 Z' }],
  triceps: [{ ellipse: [28.5, 60, 3.8, 10, 8] }],
  forearms: [{ d: 'M24 75 L29.5 74 L26.5 95 L21.5 95.5 Z' }],
  glutes: [{ d: 'M36.5 93 L49.5 93.5 L49.5 111 L44 115 L35.5 110 Z' }],
  hamstrings: [{ d: 'M34.5 114 L44 117 L46 131 L45 141 L37.5 143 L34 127 Z' }],
  adductors: [{ d: 'M45 117 L49 113 L48.5 122 L46.5 128 Z' }],
  calves: [{ d: 'M35.5 150 L41 149 L40.5 170 L37.5 176 L35 163 Z' }, { d: 'M41.5 149 L45.5 150.5 L45 163 L42.5 176 L41.5 170 Z' }]
}

const SILHOUETTE =
  'M50 27 L45 28 L44 33 L34 35.5 L28 38.5 L25 44 L24 56 L23 70 L21 76 L19.5 96 L18 105 L21 109 L24.5 105 L25.5 97 ' +
  'L29 77 L31 71 L33 57 L35 62 L35.5 86 L33 97 L32 121 L34.5 146 L34 161 L37 183 L36.5 190 L35 196 L46 196 L45.5 189 ' +
  'L45 162 L46 146 L48.5 121 L50 104 Z'

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
  const half = (
    <>
      <path d={SILHOUETTE} className="fill-muted/10" />
      {(Object.entries(shapes) as [Muscle, Shape[]][]).map(([m, shps]) => {
        const cls = fillClass(m, primary, secondary, true)
        return shps.map((s, i) => {
          const key = `${m}${i}`
          if ('d' in s) return <path key={key} d={s.d} className={cls} onClick={() => onTap(m)} />
          const [cx, cy, rx, ry, rot] = s.ellipse
          return (
            <ellipse key={key} cx={cx} cy={cy} rx={rx} ry={ry}
              transform={`rotate(${rot} ${cx} ${cy})`} className={cls} onClick={() => onTap(m)} />
          )
        })
      })}
    </>
  )
  return (
    <g transform={`translate(${dx} 0)`} className="stroke-surface" strokeWidth={0.8} strokeLinejoin="round">
      <ellipse cx={50} cy={15} rx={8.5} ry={10.5} className="fill-muted/10" />
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
            className={`min-h-[36px] rounded-lg px-4 text-[14px] font-semibold ${view === v ? 'bg-weights text-white' : 'border border-line'}`}
          >
            {v === 'front' ? 'Front' : 'Back'}
          </button>
        ))}
      </div>

      {/* clickable body model */}
      <div className="mb-3 flex justify-center">
        <svg
          viewBox="0 0 100 200"
          height={220}
          width={110}
          aria-label={t('ex.pickerHint')}
          role="group"
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

      <p className="mb-3 text-center text-[12px] text-muted">{t('ex.pickerHint')}</p>

      {/* chip fallback */}
      <MusclePicker primary={primary} secondary={secondary} onChange={onChange} />
    </div>
  )
}
