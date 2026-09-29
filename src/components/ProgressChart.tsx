import { useEffect, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface ChartPoint { label: string; full: string; value: number }

/** Reads theme tokens as colours. SVG attributes cannot use CSS variables, so they are resolved here. */
function useTokens() {
  const read = () => {
    const css = getComputedStyle(document.documentElement)
    const c = (name: string) => `rgb(${css.getPropertyValue(name).trim()})`
    return { red: c('--plate-red'), muted: c('--muted'), line: c('--line'), surface: c('--surface'), ink: c('--ink') }
  }
  const [tokens, setTokens] = useState(read)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setTokens(read())
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return tokens
}

/** Line chart of one value per session. Loaded lazily so recharts stays out of the main bundle. */
export default function ProgressChart({ points, format, label }: {
  points: ChartPoint[]; format: (v: number) => string; label: string
}) {
  const c = useTokens()
  return (
    <div className="h-56 w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 12, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid stroke={c.line} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" stroke={c.muted} tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={{ stroke: c.line }} minTickGap={16} />
          <YAxis stroke={c.muted} tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={false} width={48} domain={['auto', 'auto']} tickFormatter={format} />
          <Tooltip
            cursor={{ stroke: c.line }}
            contentStyle={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 10, color: c.ink, fontSize: 14 }}
            labelStyle={{ color: c.muted }}
            labelFormatter={(_, payload) => (payload?.[0]?.payload as ChartPoint | undefined)?.full ?? ''}
            formatter={(v) => [format(Number(v)), '']}
            separator=""
          />
          <Line type="monotone" dataKey="value" stroke={c.red} strokeWidth={2.5} dot={{ r: 4, fill: c.red, stroke: c.surface, strokeWidth: 2 }} activeDot={{ r: 7, fill: c.red }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
