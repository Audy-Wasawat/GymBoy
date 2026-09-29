import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import type { BodyEntry } from '../../db/types'
import { toDisplayWeight } from '../../lib/units'
import { formatDate } from '../../lib/dates'

interface Props {
  entries: BodyEntry[]
  weightUnit: 'kg' | 'lb'
  language: 'th' | 'en'
}

export default function BodyChartView({ entries, weightUnit, language }: Props) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const data = sorted.map((e) => ({
    date: e.date,
    w: toDisplayWeight(e.weightKg, weightUnit)
  }))

  return (
    <div className="mb-5 rounded-xl border border-line bg-surface px-2 py-4">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ left: -10, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line) / 0.4)" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => formatDate(v, language, false)} />
          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(v) => [`${v} ${weightUnit}`]}
            labelFormatter={(v) => (typeof v === 'string' ? formatDate(v, language) : String(v))}
          />
          <Line type="monotone" dataKey="w" stroke="rgb(var(--plate-red))" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
