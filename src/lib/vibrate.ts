/** Long-short-long-short-long buzz for the end of a rest. */
export const REST_DONE_PATTERN = [250, 120, 250, 120, 500]

/** True where the browser can vibrate at all. iPhone Safari cannot, so this is false there. */
export const canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

/**
 * Vibrates for the end of a rest. Returns whether a buzz was requested. It does nothing (and never
 * throws) where vibration is missing, blocked, or turned off; like the alarm sound it only works
 * while the app is open.
 */
export function vibrateRestDone(enabled = true): boolean {
  if (!enabled || !canVibrate()) return false
  try {
    return navigator.vibrate(REST_DONE_PATTERN)
  } catch {
    return false
  }
}
