import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Plus } from 'lucide-react'
import { Page } from '../../components/Page'
import { PhotoThumb } from '../../components/PhotoThumb'
import { listFoods } from '../../db/food'
import { useT } from '../../i18n/useT'

export function FoodLibrary() {
  const t = useT()
  const foods = useLiveQuery(listFoods, [])
  const [search, setSearch] = useState('')

  const filtered = foods?.filter((f) =>
    !search || f.name.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  return (
    <Page title={t('food.library')} back="/food">
      <Link
        to="/food/library/new"
        className="mb-5 flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-food text-[16px] font-semibold text-white"
      >
        <Plus size={18} aria-hidden />
        {t('food.add')}
      </Link>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('food.search')}
                aria-label={t('food.search')}
        className="mb-4 w-full rounded-xl border border-line bg-surface px-4 py-3 text-[16px]"
      />

      {filtered.length === 0 && foods !== undefined ? (
        <p className="px-1 text-[15px] text-muted">{foods && foods.length === 0 ? t('food.libraryEmpty') : t('food.noMatch')}</p>
      ) : (
        <div className="rounded-xl border border-line bg-surface">
          {filtered.map((f) => (
            <Link
              key={f.id}
              to={`/food/library/${f.id}`}
              className="flex min-h-[52px] items-center gap-3 border-b border-line px-4 py-2 last:border-b-0"
            >
              <PhotoThumb blob={f.photo} alt={f.name} />
              <span className="flex-1">
                <span className="block text-[16px]">{f.name}</span>
                <span className="block text-[13px] text-muted">{f.kcal} kcal · {f.proteinG} {t('food.gramUnit')} {t('food.protein')}</span>
              </span>
              <ChevronRight size={18} className="text-muted" aria-hidden />
            </Link>
          ))}
        </div>
      )}
    </Page>
  )
}
