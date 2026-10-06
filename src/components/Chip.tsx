import type { ReactNode } from 'react'

/** Filter chip; the selected one wears the weights plate colour. */
export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-full border px-4 text-[15px] ${
        selected ? 'border-weights bg-weights font-semibold text-white' : 'border-line bg-surface text-muted'
      }`}
    >
      {children}
    </button>
  )
}
