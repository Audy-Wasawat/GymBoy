import { useEffect, useState, type ReactNode } from 'react'

/** Bottom sheet for choices and confirmations. Tapping the backdrop or pressing Escape closes it. */
export function Sheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title?: string; children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden />
      <div
        className="relative max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-surface px-4 pt-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        {title && <h2 className="mb-3 text-[17px] font-semibold">{title}</h2>}
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
    : tone === 'danger' ? 'border border-line text-weights font-semibold'
    : 'border border-line'
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
