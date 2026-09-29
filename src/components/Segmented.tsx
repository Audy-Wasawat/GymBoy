interface Option<T extends string> { value: T; label: string }

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: Option<T>[]; onChange: (v: T) => void; label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-bg p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-[36px] min-w-[56px] rounded-md px-3 text-[15px] ${
            value === o.value ? 'bg-surface font-semibold shadow-sm' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
