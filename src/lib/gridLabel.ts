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
