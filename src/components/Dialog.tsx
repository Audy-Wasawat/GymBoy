import { useEffect, useRef, type ReactNode, type RefObject } from 'react'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Focus handling for a dialog: focus moves into it when it opens (unless a field inside already took
 * it, like an autofocus input), Tab stays inside it, Escape closes it, and focus goes back to what
 * had it before. With dialogs stacked, only the top one reacts.
 */
export function useDialog(ref: RefObject<HTMLElement>, onClose: () => void) {
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const before = document.activeElement as HTMLElement | null
    el.tabIndex = -1
    if (!el.contains(document.activeElement)) el.focus({ preventScroll: true })
    const isTop = () => {
      const all = document.querySelectorAll('[role=dialog]')
      return all[all.length - 1] === el
    }
    const onKey = (e: KeyboardEvent) => {
      if (!isTop()) return
      if (e.key === 'Escape') { e.preventDefault(); close.current(); return }
      if (e.key !== 'Tab') return
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (items.length === 0) { e.preventDefault(); return }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === el)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
      else if (!el.contains(active)) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (before && document.contains(before)) before.focus({ preventScroll: true })
    }
  }, [ref])
}

/** A full-screen dialog panel (used by the exercise picker and its create form). */
export function Dialog({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useDialog(ref, onClose)
  return (
    <div ref={ref} className="fixed inset-0 z-50 flex flex-col bg-bg outline-none" role="dialog" aria-modal="true" aria-label={label}>
      {children}
    </div>
  )
}
