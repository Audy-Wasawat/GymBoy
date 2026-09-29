import { useEffect, useState } from 'react'
import { parseCount } from '../lib/numbers'

/** Whole-number field that saves on blur; invalid or empty input reverts to the stored value. */
export function NumberField({ label, value, onSave, min = 0 }: {
  label: string; value: number; onSave: (n: number) => void; min?: number
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  const commit = () => {
    const n = parseCount(text)
    if (n === undefined || n < min) setText(String(value))
    else if (n !== value) onSave(n)
  }
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[12px] text-muted">{label}</span>
      <input
        value={text}
        inputMode="decimal"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        className="min-h-[44px] w-full rounded-lg border border-line bg-bg px-2 text-center text-[16px]"
      />
    </label>
  )
}
