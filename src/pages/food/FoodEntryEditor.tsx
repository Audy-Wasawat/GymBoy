import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight } from 'lucide-react'
import { Page, Row, Section } from '../../components/Page'
import { addFood, addFoodEntry, deleteFoodEntry, listFoodsMRU, updateFoodEntry } from '../../db/food'
import { db } from '../../db/db'
import type { Food } from '../../db/types'
import { useT } from '../../i18n/useT'
import { isPastOrToday, localDate } from '../../lib/dates'

type Mode = 'pick' | 'manual'

export function FoodEntryEditor() {
  const t = useT()
  const nav = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()


  const isNew = !id
  const initDate = params.get('date') ?? localDate()

  const existingEntry = useLiveQuery(
    async () => (id ? (await db.foodEntries.get(Number(id))) ?? null : null),
    [id]
  )
  const foods = useLiveQuery(listFoodsMRU, [])

  const [mode, setMode] = useState<Mode>('pick')
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Food | null>(null)

  const [name, setName] = useState('')
  const [kcalStr, setKcalStr] = useState('')
  const [proteinStr, setProteinStr] = useState('')
  const [portionStr, setPortionStr] = useState('1')
  const [saveToLib, setSaveToLib] = useState(false)
  const [date, setDate] = useState(initDate)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const loaded = useRef(false)
  useEffect(() => {
    if (!isNew && existingEntry && !loaded.current) {
      loaded.current = true
      setName(existingEntry.name)
      setKcalStr(String(existingEntry.kcal))
      setProteinStr(String(existingEntry.proteinG))
      setPortionStr(String(existingEntry.portion))
      setDate(existingEntry.date)
      setMode('manual')
    }
  }, [isNew, existingEntry])

  const filtered = foods?.filter((f) =>
    !search || f.name.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  function pickFood(f: Food) {
    setPicked(f)
    setName(f.name)
    setKcalStr(String(f.kcal))
    setProteinStr(String(f.proteinG))
    setPortionStr('1')
    setMode('manual')
  }

  const portion = parseFloat(portionStr) || 1
  const baseKcal = parseFloat(kcalStr) || 0
  const baseProtein = parseFloat(proteinStr) || 0
  const finalKcal = Math.round(baseKcal * portion)
  const finalProtein = Math.round(baseProtein * portion * 10) / 10

  async function handleSave() {
    if (!name.trim()) { setError(t('food.nameRequired')); return }
    if (!kcalStr.trim() || isNaN(Number(kcalStr))) { setError(t('food.kcalRequired')); return }
    if (!isPastOrToday(date)) { setError(t('run.futureDate')); return }
    setSaving(true)
    try {
      let foodId = picked?.id
      if (saveToLib && !picked) {
        foodId = await addFood({ name: name.trim(), kcal: baseKcal, proteinG: baseProtein })
      }
      const entry = {
        date,
        time: Date.now(),
        foodId,
        name: name.trim(),
        portion,
        kcal: finalKcal,
        proteinG: finalProtein
      }
      if (isNew) {
        await addFoodEntry(entry)
      } else {
        await updateFoodEntry(Number(id), entry)
      }
      nav(-1)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    if (!confirm(t('food.deleteConfirm'))) return
    await deleteFoodEntry(Number(id))
    nav('/food', { replace: true })
  }

  if (existingEntry === undefined) return null

  const title = isNew ? t('food.addTitle') : t('food.editTitle')

  return (
    <Page title={title} back={isNew ? `/food` : undefined}>
      {/* mode selector when new */}
      {isNew && !picked && (
        <>
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => setMode('pick')}
              className={`flex-1 rounded-xl border py-2 text-[15px] font-semibold ${mode === 'pick' ? 'border-food bg-food text-white' : 'border-line bg-surface'}`}
            >
              {t('food.pickFromLibrary')}
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 rounded-xl border py-2 text-[15px] font-semibold ${mode === 'manual' ? 'border-food bg-food text-white' : 'border-line bg-surface'}`}
            >
              {t('food.enterManually')}
            </button>
          </div>

          {mode === 'pick' && (
            <>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('food.search')}
                className="mb-3 w-full rounded-xl border border-line bg-surface px-4 py-3 text-[16px]"
              />
              <div className="rounded-xl border border-line bg-surface">
                {filtered.length === 0 && (
                  <p className="p-4 text-[15px] text-muted">{t('lib.empty')}</p>
                )}
                {filtered.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => pickFood(f)}
                    className="flex w-full min-h-[52px] items-center gap-3 border-b border-line px-4 py-2 last:border-b-0 text-left"
                  >
                    <span className="flex-1">
                      <span className="block text-[16px]">{f.name}</span>
                      <span className="block text-[13px] text-muted">{f.kcal} kcal · {f.proteinG} g</span>
                    </span>
                    <ChevronRight size={18} className="text-muted" aria-hidden />
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* entry form */}
      {(mode === 'manual' || !isNew) && (
        <>
          <Section>
            <Row>
              <label className="w-24 text-[15px] text-muted">{t('food.name')}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!!picked}
                className="flex-1 bg-transparent text-[16px] outline-none disabled:text-muted"
              />
            </Row>
            <Row>
              <label className="w-24 text-[15px] text-muted">{t('food.kcalField')}</label>
              <input
                inputMode="decimal"
                value={kcalStr}
                onChange={(e) => setKcalStr(e.target.value)}
                className="flex-1 bg-transparent text-[16px] outline-none"
              />
            </Row>
            <Row>
              <label className="w-24 text-[15px] text-muted">{t('food.proteinG')}</label>
              <input
                inputMode="decimal"
                value={proteinStr}
                onChange={(e) => setProteinStr(e.target.value)}
                className="flex-1 bg-transparent text-[16px] outline-none"
              />
            </Row>
            <Row>
              <label className="w-24 text-[15px] text-muted">{t('food.portion')}</label>
              <input
                inputMode="decimal"
                value={portionStr}
                onChange={(e) => setPortionStr(e.target.value)}
                className="flex-1 bg-transparent text-[16px] outline-none"
              />
            </Row>
            {portion !== 1 && (
              <Row className="text-[14px] text-muted">
                {t('food.adjustEntry')}: {finalKcal} kcal · {finalProtein} g
              </Row>
            )}
            <Row>
              <label className="w-24 text-[15px] text-muted">{t('food.date')}</label>
              <input
                type="date"
                value={date}
                max={localDate()}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 bg-transparent text-[16px] outline-none"
              />
            </Row>
          </Section>

          {/* save-to-library toggle (new + manual only) */}
          {isNew && !picked && (
            <Section>
              <Row className="justify-between">
                <label htmlFor="saveLib" className="text-[16px]">{t('food.saveToLibrary')}</label>
                <input id="saveLib" type="checkbox" checked={saveToLib} onChange={(e) => setSaveToLib(e.target.checked)} className="h-5 w-5" />
              </Row>
            </Section>
          )}

          {error && <p className="mb-3 text-[14px] text-red-500">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="mb-3 w-full min-h-[52px] rounded-xl bg-food text-[17px] font-semibold text-white disabled:opacity-50"
          >
            {t('common.save')}
          </button>

          {!isNew && (
            <button
              onClick={handleDelete}
              className="w-full min-h-[52px] rounded-xl border border-red-400 text-[16px] text-red-500"
            >
              {t('food.delete')}
            </button>
          )}
        </>
      )}
    </Page>
  )
}
