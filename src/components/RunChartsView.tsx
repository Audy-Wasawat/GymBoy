import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ChartPoint } from './ProgressChart'

/** Reads theme tokens as colours, since SVG attributes cannot use CSS variables. */
function useTokens() {
  const read = () => {
    const css = getComputedStyle(document.documentElement)
    const c = (name: string) => `rgb(${css.getPropertyValue(name).trim()})`
    return { blue: c('--plate-blue'), muted: c('--muted'), line: c('--line'), surface: c('--surface'), ink: c('--ink') }
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

/**
 * The three running charts, loaded lazily so recharts stays out of the main bundle.
 * The pace axis is reversed so a faster (smaller) pace sits higher.
 */
export default function RunChartsView({ pace, weekly, monthly, formatPaceValue, paceLabel, weeklyLabel, monthlyLabel }: {
  pace: ChartPoint[]
  weekly: ChartPoint[]
  monthly: ChartPoint[]
  formatPaceValue: (v: number) => string
  paceLabel: string
  weeklyLabel: string
  monthlyLabel: string
}) {
  const c = useTokens()
  const kmFormat = (v: number) => `${Math.round(v * 10) / 10}`
  return (
    <div className="flex flex-col gap-6">
      {pace.length >= 2 && (
        <div className="h-56 w-full" role="img" aria-label={paceLabel}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pace} margin={{ top: 12, right: 12, bottom: 4, left: -8 }}>
              <CartesianGrid stroke={c.line} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke={c.muted} tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={{ stroke: c.line }} minTickGap={16} />
              <YAxis reversed stroke={c.muted} tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={false} width={52} domain={['auto', 'auto']} tickFormatter={formatPaceValue} />
              <Tooltip
                cursor={{ stroke: c.line }}
                contentStyle={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 10, color: c.ink, fontSize: 14 }}
                labelStyle={{ color: c.muted }}
                labelFormatter={(_, p) => (p?.[0]?.payload as ChartPoint | undefined)?.full ?? ''}
                formatter={(v) => [formatPaceValue(Number(v)), '']}
                separator=""
              />
              <Line type="monotone" dataKey="value" stroke={c.blue} strokeWidth={2.5} dot={{ r: 4, fill: c.blue, stroke: c.surface, strokeWidth: 2 }} activeDot={{ r: 7, fill: c.blue }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <BarBlock title={weeklyLabel} data={weekly} colour={c.blue} c={c} format={kmFormat} />
      <BarBlock title={monthlyLabel} data={monthly} colour={c.blue} c={c} format={kmFormat} />
    </div>
  )
}

function BarBlock({ title, data, colour, c, format }: {
  title: string; data: ChartPoint[]; colour: string
  c: { muted: string; line: string; surface: string; ink: string }; format: (v: number) => string
}) {
  return (
    <div>
      <h3 className="mb-2 text-[14px] font-semibold text-muted">{title}</h3>
      <div className="h-48 w-full" role="img" aria-label={`${title}: ${data.map((d) => `${d.full} ${format(d.value)} km`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
            <CartesianGrid stroke={c.line} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" stroke={c.muted} tick={{ fill: c.muted, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.line }} interval={0} minTickGap={0} />
            <YAxis stroke={c.muted} tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={false} width={40} tickFormatter={format} />
            <Tooltip
              cursor={{ fill: c.line, opacity: 0.3 }}
              contentStyle={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 10, color: c.ink, fontSize: 14 }}
              labelStyle={{ color: c.muted }}
              labelFormatter={(_, p) => (p?.[0]?.payload as ChartPoint | undefined)?.full ?? ''}
              formatter={(v) => [`${format(Number(v))} km`, '']}
              separator=""
            />
            <Bar dataKey="value" fill={colour} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
