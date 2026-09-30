import { useEffect, useRef, useState } from 'react'
import { db } from '../../db/db'
import { clearRest } from '../../db/sessions'
import type { WorkoutSession } from '../../db/types'
import { useT } from '../../i18n/useT'
import { formatDuration } from '../../lib/numbers'
import { playRestDone } from '../../lib/sound'
import { vibrateRestDone } from '../../lib/vibrate'
import { useSettings } from '../../db/useSettings'

/** True while a text field has focus, i.e. while the on-screen keyboard is likely open. */
function useTyping() {
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    const check = () => setTimeout(() => {
      const el = document.activeElement
      setTyping(!!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'))
    }, 0)
    document.addEventListener('focusin', check)
    document.addEventListener('focusout', check)
    return () => {
      document.removeEventListener('focusin', check)
      document.removeEventListener('focusout', check)
    }
  }, [])
  return typing
}

/**
 * Rest timer above the tab bar. Remaining time is worked out from the stored end time, so it stays
 * right after the screen locks. It hides while typing so it never covers an input.
 */
export function RestBar({ session }: { session: WorkoutSession }) {
  const t = useT()
  const { restVibrate } = useSettings()
  const vibrate = restVibrate !== false
  const typing = useTyping()
  const [now, setNow] = useState(Date.now())
  const alerted = useRef<number>()
  const endsAt = session.restEndsAt

  useEffect(() => {
    if (!endsAt) return
    const tick = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(tick)
  }, [endsAt])

  const remaining = endsAt ? Math.ceil((endsAt - now) / 1000) : 0
  const done = !!endsAt && remaining <= 0

  useEffect(() => {
    // Sound once per timer, and only if it finished while the app was open (not long ago).
    if (done && endsAt && alerted.current !== endsAt) {
      alerted.current = endsAt
      if (Date.now() - endsAt < 5000) {
        playRestDone()
        vibrateRestDone(vibrate)
      }
    }
  }, [done, endsAt, vibrate])

  if (!endsAt || typing) return null

  // After the timer has run out, +15 starts a fresh 15 s rest.
  const adjust = (delta: number) =>
    db.sessions.update(session.id!, done
      ? { restEndsAt: Date.now() + delta * 1000, restTotalSec: delta }
      : { restEndsAt: Math.max(Date.now(), endsAt + delta * 1000), restTotalSec: Math.max(1, (session.restTotalSec ?? 0) + delta) })
  const total = session.restTotalSec ?? 1
  const button = 'flex h-11 min-w-[48px] items-center justify-center rounded-lg px-2 text-[15px] font-semibold'

  return (
    <div
      className="fixed inset-x-0 z-30 px-3"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px + var(--banner-h, 0px))' }}
      role="timer"
      aria-live="off"
    >
      {/* The countdown changes every second, so it is not announced; only the end of the rest is. */}
      <span className="sr-only" role="status">{done ? t('rest.done') : ''}</span>
      <div className={`mx-auto flex max-w-xl items-center gap-2 overflow-hidden rounded-xl border px-3 py-2 shadow-lg ${
        done ? 'animate-pulse border-weights bg-weights text-white' : 'border-line bg-surface'
      }`}>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] opacity-80">{done ? t('rest.done') : t('rest.title')}</div>
          <div className="text-[24px] font-semibold leading-tight">{done ? '0' : formatDuration(remaining)}</div>
          {!done && (
            <div className="mt-1 h-1 rounded-full bg-line">
              <div className="h-1 rounded-full bg-weights" style={{ width: `${Math.min(100, (remaining / total) * 100)}%` }} />
            </div>
          )}
        </div>
        {!done && <button onClick={() => adjust(-15)} className={`${button} border border-line`}>−15</button>}
        <button onClick={() => adjust(15)} className={`${button} border ${done ? 'border-white/60' : 'border-line'}`}>+15</button>
        <button onClick={() => clearRest(session.id!)} className={`${button} ${done ? 'bg-white/20' : 'bg-bg'}`}>
          {done ? t('common.close') : t('rest.skip')}
        </button>
      </div>
    </div>
  )
}
