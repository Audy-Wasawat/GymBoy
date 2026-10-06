import { useEffect, useRef, useState } from 'react'
import { db } from '../../db/db'
import { clearRest } from '../../db/sessions'
import type { WorkoutSession } from '../../db/types'
import { useT } from '../../i18n/useT'
import { playCountdownTick, playRestDone } from '../../lib/sound'
import { vibrateRestDone } from '../../lib/vibrate'
import { useSettings } from '../../db/useSettings'

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

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
  const overdue = endsAt && done ? Math.floor((now - endsAt) / 1000) : 0
  const ticked = useRef<string>()

  // Soft ticks for the last three seconds, so the end is easy to catch in headphones.
  useEffect(() => {
    if (!endsAt || done || remaining > 3 || remaining < 1) return
    const key = `${endsAt}:${remaining}`
    if (ticked.current === key) return
    ticked.current = key
    if (document.visibilityState === 'visible') void playCountdownTick()
  }, [endsAt, done, remaining])

  useEffect(() => {
    // Chime once per timer, and only if it finished while the app was open (not long ago).
    if (done && endsAt && alerted.current !== endsAt) {
      alerted.current = endsAt
      if (Date.now() - endsAt < 5000) {
        void playRestDone()
        vibrateRestDone(vibrate)
      }
    }
  }, [done, endsAt, vibrate])

  // While the finished bar is still up and the app is open, remind again at 20 s and 40 s.
  useEffect(() => {
    if (!done || !endsAt) return
    if ((overdue === 20 || overdue === 40) && document.visibilityState === 'visible') void playRestDone()
  }, [done, endsAt, overdue])

  if (!endsAt || typing) return null

  // After the timer has run out, +15 starts a fresh 15 s rest.
  const adjust = (delta: number) =>
    db.sessions.update(session.id!, done
      ? { restEndsAt: Date.now() + delta * 1000, restTotalSec: delta }
      : { restEndsAt: Math.max(Date.now(), endsAt + delta * 1000), restTotalSec: Math.max(1, (session.restTotalSec ?? 0) + delta) })
  const total = session.restTotalSec ?? 1
  const frac = done ? 1 : Math.max(0, Math.min(1, remaining / total))
  const R = 21
  const C = 2 * Math.PI * R
  const button = 'flex h-11 min-w-[48px] items-center justify-center rounded-full px-3 text-[15px] font-bold'

  return (
    <div
      className="fixed inset-x-0 z-30 px-3"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px + var(--banner-h, 0px))' }}
      role="timer"
      aria-live="off"
    >
      {/* The countdown changes every second, so it is not announced; only the end of the rest is. */}
      <span className="sr-only" role="status">{done ? t('rest.done') : ''}</span>
      <div className={`mx-auto flex max-w-xl animate-pop-in items-center gap-2 overflow-hidden rounded-[22px] border px-2.5 py-2 shadow-[0_16px_40px_-14px_rgb(0_0_0/0.6)] backdrop-blur-xl ${
        done ? 'animate-ring-pulse border-weights bg-weights text-white' : 'border-line bg-surface/90'
      }`}>
        <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0 -rotate-90" aria-hidden>
          <circle cx="26" cy="26" r={R} fill="none" strokeWidth="5" className={done ? 'stroke-current opacity-25' : 'stroke-raised'} />
          <circle
            cx="26" cy="26" r={R} fill="none" strokeWidth="5" strokeLinecap="round"
            className={done ? 'stroke-current' : 'stroke-weights'}
            strokeDasharray={C}
            strokeDashoffset={C * (1 - frac)}
            style={{ transition: 'stroke-dashoffset 250ms linear' }}
          />
        </svg>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold uppercase tracking-wide opacity-75">{done ? t('rest.done') : t('rest.title')}</div>
          <div className="text-[28px] font-bold leading-none tracking-tight">
            {done ? `+${mmss(overdue)}` : mmss(remaining)}
          </div>
          {done && overdue >= 5 && <div className="mt-0.5 text-[12px] font-medium opacity-80">{t('rest.over')}</div>}
        </div>
        {!done && <button onClick={() => adjust(-15)} className={`${button} bg-raised`}>−15</button>}
        <button onClick={() => adjust(15)} className={`${button} ${done ? 'bg-white/20' : 'bg-raised'}`}>+15</button>
        <button onClick={() => clearRest(session.id!)} className={`${button} ${done ? 'bg-white/90 text-weights' : 'bg-weights text-white'}`}>
          {done ? t('common.close') : t('rest.skip')}
        </button>
      </div>
    </div>
  )
}
