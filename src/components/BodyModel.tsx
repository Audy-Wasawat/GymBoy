import type { Muscle } from '../db/types'
import { useT } from '../i18n/useT'

export type BodyView = 'front' | 'back' | 'both'

import { BACK, FRONT, HEAD, SILHOUETTE, type Shape } from './bodyShapes'

function ShapeEl({ s, className }: { s: Shape; className: string }) {
  if ('d' in s) return <path d={s.d} className={className} />
  const [cx, cy, rx, ry, rot] = s.ellipse
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(${rot} ${cx} ${cy})`} className={className} />
}

function Figure({ regions, primary, secondary, dx }: {
  regions: Partial<Record<Muscle, Shape[]>>; primary: Muscle[]; secondary: Muscle[]; dx: number
}) {
  const fill = (m: Muscle) =>
    primary.includes(m) ? 'fill-weights' : secondary.includes(m) ? 'fill-weights/40' : 'fill-muted/25'
  const half = (
    <>
      <path d={SILHOUETTE} className="fill-muted/15" stroke="none" />
      {(Object.entries(regions) as [Muscle, Shape[]][]).map(([m, shapes]) =>
        shapes.map((s, i) => <ShapeEl key={`${m}${i}`} s={s} className={fill(m)} />)
      )}
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
 * Flat front/back body model. Primary muscles are drawn in the weights plate colour,
 * secondary muscles in the same colour at 35 %, everything else in a neutral theme tone.
 */
export function BodyModel({ primary, secondary, view = 'both', height = 200, className = '' }: {
  primary: Muscle[]; secondary: Muscle[]; view?: BodyView; height?: number; className?: string
}) {
  const t = useT()
  const views = view === 'both' ? (['front', 'back'] as const) : [view]
  const width = views.length * 100 + (views.length - 1) * 8
  const list = (ms: Muscle[]) => ms.map((m) => t(`muscle.${m}`)).join(', ')
  const label = primary.length + secondary.length === 0
    ? t('ex.noMuscles')
    : [primary.length && `${t('ex.primary')}: ${list(primary)}`, secondary.length && `${t('ex.secondary')}: ${list(secondary)}`]
        .filter(Boolean).join('; ')
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} 200`}
      height={height}
      width={(height * width) / 200}
      className={`shrink-0 ${className}`}
    >
      {views.map((v, i) => (
        <Figure key={v} regions={v === 'front' ? FRONT : BACK} primary={primary} secondary={secondary} dx={i * 108} />
      ))}
    </svg>
  )
}
