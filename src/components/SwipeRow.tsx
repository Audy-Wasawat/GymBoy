import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'

const OPEN = 84

/**
 * Swipe a row to the left to reveal a delete button (like iOS lists). A short swipe springs back;
 * tapping anywhere outside closes it. Vertical scrolling is left alone.
 */
export function SwipeRow({ onDelete, label, children }: { onDelete: () => void; label: string; children: ReactNode }) {
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; base: number; axis?: 'h' | 'v' }>()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (x === 0) return
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setX(0) }
    document.addEventListener('touchstart', close, { passive: true })
    document.addEventListener('mousedown', close)
    return () => {
      document.removeEventListener('touchstart', close)
      document.removeEventListener('mousedown', close)
    }
  }, [x])

  return (
    <div ref={ref} className="relative overflow-hidden rounded-lg">
      <button
        onClick={() => { setX(0); onDelete() }}
        aria-label={label}
        tabIndex={x ? 0 : -1}
        className="absolute inset-y-0 right-0 flex items-center justify-center gap-1 rounded-lg bg-weights px-3 text-[14px] font-bold text-white"
        style={{ width: OPEN - 6, opacity: x ? 1 : 0 }}
      >
        <Trash2 size={18} aria-hidden />
      </button>
      <div
        className="relative bg-surface"
        style={{ transform: `translateX(${x}px)`, transition: dragging ? 'none' : 'transform 200ms cubic-bezier(.2,.8,.2,1)' }}
        onTouchStart={(e) => {
          const t = e.touches[0]
          start.current = { x: t.clientX, y: t.clientY, base: x }
        }}
        onTouchMove={(e) => {
          const s = start.current
          if (!s) return
          const t = e.touches[0]
          const dx = t.clientX - s.x
          const dy = t.clientY - s.y
          if (!s.axis) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
            s.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'h' : 'v'
          }
          if (s.axis !== 'h') return
          setDragging(true)
          setX(Math.max(-OPEN - 24, Math.min(0, s.base + dx)))
        }}
        onTouchEnd={() => {
          const s = start.current
          start.current = undefined
          setDragging(false)
          if (s?.axis === 'h') setX((cur) => (cur < -OPEN / 2 ? -OPEN : 0))
        }}
      >
        {children}
      </div>
    </div>
  )
}
