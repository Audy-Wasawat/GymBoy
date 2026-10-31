import type { StringKey } from '../i18n/strings'
import { formatDate } from './dates'

export type GridColor = 'weights' | 'running' | 'both' | 'other' | 'none' | 'blank'

/** Screen-reader text for an activity-grid cell: the date and the activities, in the app language. */
export function gridCellLabel(dateStr: string, col: GridColor, lang: 'th' | 'en', t: (key: StringKey) => string): string {
  const what =
    col === 'both' ? `${t('grid.weights')}, ${t('grid.running')}`
    : col === 'weights' ? t('grid.weights')
    : col === 'running' ? t('grid.running')
    : col === 'other' ? t('more.activities')
    : t('grid.noLog')
  return `${formatDate(dateStr, lang)}: ${what}`
}

export type GridPart = 'weights' | 'running' | 'other'

/** Like gridCellLabel, for a cell that may hold any mix of weights, running and other activities. */
export function gridPartsLabel(dateStr: string, parts: GridPart[], lang: 'th' | 'en', t: (key: StringKey) => string): string {
  const names = parts.map((p) => (p === 'weights' ? t('grid.weights') : p === 'running' ? t('grid.running') : t('more.activities')))
  return `${formatDate(dateStr, lang)}: ${names.length ? names.join(', ') : t('grid.noLog')}`
}
