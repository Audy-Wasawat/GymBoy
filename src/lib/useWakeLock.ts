import { useEffect } from 'react'

/**
 * Keeps the screen awake while mounted, where the browser allows it. iOS drops the lock when the
 * app goes to the background, so it is requested again whenever the page becomes visible.
 * Any failure (unsupported, denied, low battery) is ignored.
 */
export function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | undefined
    let cancelled = false
    const request = async () => {
      try {
        if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return
        const next = await navigator.wakeLock.request('screen')
        if (cancelled) void next.release()
        else lock = next
      } catch {
        // ignore
      }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') void request() }
    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [])
}
