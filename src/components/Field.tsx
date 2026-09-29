import type { ReactNode } from 'react'

/** A label above its control, used across the run, food, activity and body editors. */
export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="text-[13px] text-muted">{label}</span>
      {children}
    </label>
  )
}

/** Free-text or numeric input that holds its own typed text; the parent reads it on save. */
export function TextInput({
  value, onChange, inputMode = 'text', placeholder, ariaLabel, autoFocus, className = ''
}: {
  value: string
  onChange: (v: string) => void
  inputMode?: 'text' | 'decimal' | 'numeric'
  placeholder?: string
  ariaLabel?: string
  autoFocus?: boolean
  className?: string
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode={inputMode}
      placeholder={placeholder}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      autoComplete="off"
      className={`min-h-[48px] w-full rounded-lg border border-line bg-bg px-3 text-[16px] ${className}`}
    />
  )
}
