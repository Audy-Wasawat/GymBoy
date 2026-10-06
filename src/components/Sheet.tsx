import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useDialog } from './Dialog'

/** Bottom sheet for choices and confirmations. Tapping the backdrop or pressing Escape closes it. */
export function Sheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title?: string; children: ReactNode
}) {
  if (!open) return null
  return <SheetBody onClose={onClose} title={title}>{children}</SheetBody>
}

function SheetBody({ onClose, title, children }: { onClose: () => void; title?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useDialog(ref, onClose)
  return (
    <div ref={ref} className="fixed inset-0 z-50 flex items-end justify-center outline-none" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        className="relative max-h-[85vh] w-full max-w-xl animate-sheet-in overflow-y-auto rounded-t-[28px] border-t border-line bg-surface px-4 pt-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted/40" aria-hidden />
        {title && <h2 className="mb-3 text-[19px] font-bold">{title}</h2>}
        {children}
      </div>
    </div>
  )
}

/** A full-width button inside a sheet. */
export function SheetButton({ onClick, children, tone = 'plain' }: {
  onClick: () => void; children: ReactNode; tone?: 'plain' | 'primary' | 'danger'
}) {
  const cls =
    tone === 'primary' ? 'bg-weights text-white font-semibold'
    : tone === 'danger' ? 'bg-weights/10 text-weights font-semibold'
    : 'bg-raised'
  return (
    <button onClick={onClick} className={`mb-2 flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-[16px] ${cls}`}>
      {children}
    </button>
  )
}

/** Sheet with one text field, used for naming programs and days. */
export function NameSheet({ open, title, initial = '', saveLabel, onSave, onClose }: {
  open: boolean; title: string; initial?: string; saveLabel: string; onSave: (name: string) => void; onClose: () => void
}) {
  const [name, setName] = useState(initial)
  useEffect(() => { if (open) setName(initial) }, [open, initial])
  const submit = () => { if (name.trim()) onSave(name.trim()) }
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <form onSubmit={(e) => { e.preventDefault(); submit() }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          autoComplete="off"
          aria-label={title}
          className="mb-3 min-h-[48px] w-full rounded-lg border border-line bg-bg px-3 text-[16px]"
        />
        <button type="submit" disabled={!name.trim()} className="min-h-[52px] w-full rounded-xl bg-weights text-[16px] font-semibold text-white disabled:opacity-40">
          {saveLabel}
        </button>
      </form>
    </Sheet>
  )
}
