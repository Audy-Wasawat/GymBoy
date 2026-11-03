import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { GripVertical } from 'lucide-react'
import { useT } from '../i18n/useT'

const ROW = 60

export interface ReorderItem { id: number; title: string; subtitle?: string }

interface Drag { id: number; y: number; offset: number }

/**
 * A compact list whose rows are dragged into a new order with a finger (or the arrow keys).
 * `startDrag` lets a long press elsewhere hand over a drag that is already under way: the row with
 * that id starts under the finger at `y` (a viewport position).
 */
export function ReorderList({ items, startDrag, onChange, onDone, tone = 'bg-weights' }: {
  items: ReorderItem[]
  startDrag?: { id: number; y: number }
  /** Called with the new order of ids after every drop or key move. */
  onChange: (ids: number[]) => void
  onDone: () => void
  tone?: string
}) {
  const t = useT()
  const listRef = useRef<HTMLDivElement>(null)
  const [order, setOrder] = useState(() => items.map((i) => i.id))
  const [drag, setDrag] = useState<Drag | null>(null)
  const [top, setTop] = useState(0)
  const dragRef = useRef<Drag | null>(null)
  dragRef.current = drag

  // Rows added or removed meanwhile (another device, a tap elsewhere) are folded in, order kept.
  useEffect(() => {
    setOrder((cur) => [...cur.filter((id) => items.some((i) => i.id === id)), ...items.filter((i) => !cur.includes(i.id)).map((i) => i.id)])
  }, [items])

  // The list opens at the top of the page; a drag handed over from a long press starts under the finger.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0 })
    const rect = listRef.current?.getBoundingClientRect()
    setTop(rect?.top ?? 0)
    if (startDrag) setDrag({ id: startDrag.id, y: startDrag.y, offset: ROW / 2 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const slotOf = (d: Drag) => {
    const rect = listRef.current?.getBoundingClientRect()
    const y = d.y - (rect?.top ?? top) - d.offset
    return Math.max(0, Math.min(order.length - 1, Math.round(y / ROW)))
  }

  /** The order as it would be if the dragged row were dropped now. */
  const shown = (() => {
    if (!drag) return order
    const rest = order.filter((id) => id !== drag.id)
    rest.splice(slotOf(drag), 0, drag.id)
    return rest
  })()
  const shownRef = useRef(shown)
  shownRef.current = shown

  useEffect(() => {
    if (!drag) return
    const move = (y: number) => setDrag((d) => (d ? { ...d, y } : d))
    const onPointerMove = (e: PointerEvent) => move(e.clientY)
    // Stops the page from scrolling under the finger while a row is held.
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); if (e.touches[0]) move(e.touches[0].clientY) }
    const end = () => {
      if (!dragRef.current) return
      const next = shownRef.current
      setDrag(null)
      setOrder(next)
      onChange(next)
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('pointerup', end)
    window.addEventListener('touchend', end)
    window.addEventListener('touchcancel', end)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('touchend', end)
      window.removeEventListener('touchcancel', end)
    }
    // Only (re)attach when a drag starts or ends, not on every move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id])

  const begin = (id: number, e: ReactPointerEvent<HTMLDivElement>) => {
    const rowTop = e.currentTarget.getBoundingClientRect().top
    setDrag({ id, y: e.clientY, offset: e.clientY - rowTop })
  }

  const keyMove = (id: number, dir: -1 | 1) => {
    const i = order.indexOf(id)
    const j = i + dir
    if (j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    setOrder(next)
    onChange(next)
  }

  const dragTop = (d: Drag) => {
    const rect = listRef.current?.getBoundingClientRect()
    const y = d.y - (rect?.top ?? top) - d.offset
    return Math.max(-ROW / 2, Math.min((order.length - 1) * ROW + ROW / 2, y))
  }

  return (
    <div className="mb-4">
      <div className="mb-3 flex items-center gap-3">
        <p className="min-w-0 flex-1 text-[14px] text-muted">{t('reorder.hint')}</p>
        <button onClick={onDone} className={`min-h-[44px] shrink-0 rounded-xl px-5 text-[15px] font-bold text-white ${tone}`}>
          {t('reorder.done')}
        </button>
      </div>
      <div ref={listRef} className="relative" style={{ height: order.length * ROW }} role="list" aria-label={t('reorder.hint')}>
        {order.map((id) => {
          const item = items.find((i) => i.id === id)
          if (!item) return null
          const dragging = drag?.id === id
          const y = dragging && drag ? dragTop(drag) : shown.indexOf(id) * ROW
          return (
            <div
              key={id}
              role="listitem"
              tabIndex={0}
              aria-label={`${shown.indexOf(id) + 1}. ${item.title}`}
              onPointerDown={(e) => begin(id, e)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') { e.preventDefault(); keyMove(id, -1) }
                else if (e.key === 'ArrowDown') { e.preventDefault(); keyMove(id, 1) }
              }}
              onContextMenu={(e) => e.preventDefault()}
              className={`absolute inset-x-0 touch-none select-none px-0.5 outline-none ${dragging ? 'z-10' : 'transition-[top] duration-150'}`}
              style={{ top: y, height: ROW, WebkitTouchCallout: 'none' } as React.CSSProperties}
            >
              <div className={`flex h-[52px] items-center gap-3 rounded-xl border bg-surface px-3 ${
                dragging ? 'scale-[1.02] border-weights/50 shadow-[0_10px_24px_-8px_rgb(0_0_0/0.35)]' : 'border-line'
              }`}>
                <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-weights/15 px-1.5 text-[12px] font-bold text-weights">
                  {shown.indexOf(id) + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold">{item.title}</span>
                  {item.subtitle && <span className="block truncate text-[12px] text-muted">{item.subtitle}</span>}
                </span>
                <GripVertical size={20} className="shrink-0 text-muted" aria-hidden />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Long press without moving (about half a second) calls `onLongPress` with the finger's position.
 * Moving first, or lifting early, is an ordinary tap or scroll.
 */
export function useLongPress(onLongPress: (y: number) => void, ms = 450) {
  const timer = useRef<number>()
  const start = useRef<{ x: number; y: number } | null>(null)
  const cancel = () => { window.clearTimeout(timer.current); start.current = null }
  useEffect(() => cancel, [])
  return {
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      start.current = { x: e.clientX, y: e.clientY }
      const y = e.clientY
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        start.current = null
        navigator.vibrate?.(15)
        onLongPress(y)
      }, ms)
    },
    onPointerMove: (e: ReactPointerEvent) => {
      const s = start.current
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault()
  }
}
