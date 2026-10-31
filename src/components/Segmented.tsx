interface Option<T extends string> { value: T; label: string }

/** `wrap` lets long option lists flow onto a second row instead of squeezing the labels. */
export function Segmented<T extends string>({ value, options, onChange, label, wrap = false }: {
  value: T; options: Option<T>[]; onChange: (v: T) => void; label: string; wrap?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`flex rounded-xl bg-raised p-1 ${wrap ? 'flex-wrap gap-1' : ''}`}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-[44px] rounded-lg ${wrap ? 'flex-auto whitespace-nowrap px-2 text-[14px]' : 'min-w-[56px] flex-1 px-3 text-[15px]'} ${
            value === o.value ? 'bg-surface font-semibold shadow-[0_2px_8px_-2px_rgb(0_0_0/0.25)]' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
