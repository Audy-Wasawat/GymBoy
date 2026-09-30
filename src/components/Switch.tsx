export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex h-11 w-[60px] shrink-0 items-center justify-center disabled:opacity-40"
    >
      <span className={`flex h-[30px] w-[50px] items-center rounded-full p-[3px] transition-colors ${checked ? 'bg-weights' : 'bg-control'}`}>
        <span className={`h-6 w-6 rounded-full bg-surface shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  )
}
