import type { WorkoutSession } from '../db/types'
import type { StringKey } from '../i18n/strings'

/**
 * Name shown for a session: the program day, or for a session without one the body parts
 * actually trained (e.g. "Chest, Shoulders"); "Empty session" until a working set is saved.
 */
export function sessionTitle(s: WorkoutSession, t: (key: StringKey) => string) {
  if (s.dayName) return s.dayName
  if (s.bodyParts.length) return s.bodyParts.map((p) => t(`part.${p}`)).join(', ')
  return t('session.empty')
}
