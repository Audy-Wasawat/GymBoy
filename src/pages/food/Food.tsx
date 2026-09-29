import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Library, Plus } from 'lucide-react'
import { Page, Section } from '../../components/Page'
import { listFoodEntries } from '../../db/food'
import { useSettings } from '../../db/useSettings'
import type { FoodEntry } from '../../db/types'
import { useT } from '../../i18n/useT'
import { formatDate } from '../../lib/dates'
import { localDate, parseLocalDate } from '../../lib/dates'

function addDays(dateStr: string, n: number): string {
  const d = parseLocalDate(dateStr)
  d.setDate(d.getDate() + n)
  return localDate(d)
}

function totalKcal(entries: FoodEntry[]) { return entries.reduce((s, e) => s + e.kcal, 0) }
function totalProtein(entries: FoodEntry[]) { return entries.reduce((s, e) => s + e.proteinG, 0) }

export function Food() {
  const t = useT()
  const { language, goals } = useSettings()
  const today = localDate()
  const [date, setDate] = useState(today)

  const entries = useLiveQuery(() => listFoodEntries(date), [date], [])

  const kcal = totalKcal(entries)
  const protein = totalProtein(entries)
  const isToday = date === today

  return (
    <Page title={t('food.title')}>
      {/* date nav */}
      <div className="mb-5 flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2">
        <button
          onClick={() => setDate(addDays(date, -1))}
          className="flex h-10 w-10 items-center justify-center"
          aria-label={t('food.prevDay')}
        >
          <ChevronLeft size={20} aria-hidden />
        </button>
        <span className="text-[15px] font-semibold">
          {isToday ? `${formatDate(date, language)} (${t('today.title')})` : formatDate(date, language)}
        </span>
        <button
          onClick={() => { if (!isToday) setDate(addDays(date, 1)) }}
          disabled={isToday}
          className="flex h-10 w-10 items-center justify-center disabled:opacity-30"
          aria-label={t('food.nextDay')}
        >
          <ChevronRight size={20} aria-hidden />
        </button>
      </div>

      {/* totals */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="text-[22px] font-semibold text-food">{kcal}</div>
          <div className="text-[13px] text-muted">
            {t('food.kcalUnit')}
            {goals.kcal ? ` · ${t('food.remaining')} ${Math.max(0, goals.kcal - kcal)}` : ''}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="text-[22px] font-semibold text-food">{Math.round(protein * 10) / 10}</div>
          <div className="text-[13px] text-muted">
            {t('food.gramUnit')} {t('food.protein')}
            {goals.proteinG ? ` · ${t('food.remaining')} ${Math.max(0, Math.round((goals.proteinG - protein) * 10) / 10)}` : ''}
          </div>
        </div>
      </div>

      {/* quick actions */}
      <div className="mb-5 flex gap-3">
        <Link
          to={`/food/add?date=${date}`}
          className="flex flex-1 min-h-[52px] items-center justify-center gap-2 rounded-xl bg-food text-[16px] font-semibold text-white"
        >
          <Plus size={18} aria-hidden />
          {t('food.add')}
        </Link>
        <Link
          to="/food/library"
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-[15px]"
        >
          <Library size={18} className="text-muted" aria-hidden />
          {t('food.library')}
        </Link>
      </div>

      {entries.length === 0 ? (
        <p className="px-1 py-4 text-[15px] text-muted">{t('food.empty')}</p>
      ) : (
        <Section>
          {entries.map((e) => (
            <Link
              key={e.id}
              to={`/food/entry/${e.id}`}
              className="flex min-h-[56px] items-center gap-3 border-b border-line px-4 py-2 last:border-b-0"
            >
              <span className="flex-1">
                <span className="block text-[16px]">{e.name}{e.portion !== 1 ? ` ×${e.portion}` : ''}</span>
                <span className="block text-[13px] text-muted">{e.kcal} kcal · {Math.round(e.proteinG * 10) / 10} {t('food.gramUnit')} protein</span>
              </span>
              <ChevronRight size={18} className="text-muted" aria-hidden />
            </Link>
          ))}
        </Section>
      )}
    </Page>
  )
}
