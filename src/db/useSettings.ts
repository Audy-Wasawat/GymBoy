import { useLiveQuery } from 'dexie-react-hooks'
import { db, DEFAULT_SETTINGS } from './db'

export function useSettings() {
  return useLiveQuery(() => db.settings.get('app'), []) ?? DEFAULT_SETTINGS
}
