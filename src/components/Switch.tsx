export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex h-11 w-[60px] shrink-0 items-center justify-center"
    >
      <span className={`flex h-[30px] w-[50px] items-center rounded-full p-[3px] transition-colors ${checked ? 'bg-weights' : 'bg-line'}`}>
        <span className={`h-6 w-6 rounded-full bg-surface shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  )
}
