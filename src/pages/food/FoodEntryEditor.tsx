import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight } from 'lucide-react'
import { Page, Row, Section } from '../../components/Page'
import { PhotoField } from '../../components/PhotoField'
import { PhotoThumb } from '../../components/PhotoThumb'
import { Sheet, SheetButton } from '../../components/Sheet'
import { deleteFoodEntry, listFoodsMRU, saveNewFoodEntry, updateFoodEntry } from '../../db/food'
import { db } from '../../db/db'
import type { Food } from '../../db/types'
import { useT } from '../../i18n/useT'
import { isPastOrToday, localDate } from '../../lib/dates'
import { fieldsFromEntry, finalValues, sameFields, tooLarge, type EntryFields } from '../../lib/foodEntry'
import { parseDecimal } from '../../lib/numbers'
import { FOOD_PHOTO_MAX } from '../../lib/photos'

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
  // The entry's own photo: a copy of the library food's when one is picked, replaceable and removable.
  const [photo, setPhoto] = useState<Blob | undefined>()
  const [date, setDate] = useState(initDate)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteSheet, setDeleteSheet] = useState(false)

  const loaded = useRef(false)
  // What the value fields showed when the entry was opened; if they still match on save, the stored numbers are kept as they are.
  const loadedValues = useRef<EntryFields | null>(null)
  useEffect(() => {
    if (!isNew && existingEntry && !loaded.current) {
      loaded.current = true
      setName(existingEntry.name)
      const f = fieldsFromEntry(existingEntry) // per-portion values: see fieldsFromEntry
      loadedValues.current = f
      setKcalStr(f.kcal)
      setProteinStr(f.protein)
      setPortionStr(f.portion)
      setDate(existingEntry.date)
      setPhoto(existingEntry.photo)
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
    setPhoto(f.photo)
    setMode('manual')
  }

  const portionVal = parseDecimal(portionStr)
  const fields = { kcal: kcalStr, protein: proteinStr, portion: portionStr }
  const { portion, baseKcal, baseProtein, kcal: finalKcal, proteinG: finalProtein } = finalValues(fields)

  async function handleSave() {
    if (!name.trim()) { setError(t('food.nameRequired')); return }
    if (parseDecimal(kcalStr) === undefined) { setError(t('food.kcalRequired')); return }
    if (proteinStr.trim() && parseDecimal(proteinStr) === undefined) { setError(t('food.proteinInvalid')); return }
    if (portionVal === undefined || portionVal <= 0) { setError(t('food.portionInvalid')); return }
    if (tooLarge(fields)) { setError(t('error.tooLarge')); return }
    if (!isPastOrToday(date)) { setError(t('run.futureDate')); return }
    setSaving(true)
    try {
      // Editing keeps the entry's place in the day and its link to the library food.
      const keep = !isNew && existingEntry ? existingEntry : undefined
      const unchanged = !!keep && !!loadedValues.current && sameFields(fields, loadedValues.current)
      const entry = {
        date,
        time: keep ? keep.time : Date.now(),
        foodId: keep ? keep.foodId : picked?.id,
        name: name.trim(),
        portion: unchanged ? keep!.portion : portion,
        kcal: unchanged ? keep!.kcal : finalKcal,
        proteinG: unchanged ? keep!.proteinG : finalProtein
      }
      if (isNew) {
        await saveNewFoodEntry(entry, photo, saveToLib && !picked ? { name: name.trim(), kcal: Math.round(baseKcal), proteinG: baseProtein } : undefined)
      } else {
        // photo may be undefined here: that removes it.
        await updateFoodEntry(Number(id), { ...entry, photo })
      }
      nav(-1)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    await deleteFoodEntry(Number(id))
    nav('/food', { replace: true })
  }

  if (existingEntry === undefined) return null
  if (!isNew && existingEntry === null) return <Page title={t('food.editTitle')} back="/food">{null}</Page>

  const title = isNew ? t('food.addTitle') : t('food.editTitle')

  return (
    <Page title={title} back="/food">
      {/* mode selector when new */}
      {isNew && !picked && (
        <>
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => setMode('pick')}
              aria-pressed={mode === 'pick'}
              className={`min-h-[44px] flex-1 rounded-xl border py-2 text-[15px] font-semibold ${mode === 'pick' ? 'border-food bg-food text-white' : 'border-line bg-surface'}`}
            >
              {t('food.pickFromLibrary')}
            </button>
            <button
              onClick={() => setMode('manual')}
              aria-pressed={mode === 'manual'}
              className={`min-h-[44px] flex-1 rounded-xl border py-2 text-[15px] font-semibold ${mode === 'manual' ? 'border-food bg-food text-white' : 'border-line bg-surface'}`}
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
                aria-label={t('food.search')}
                className="mb-3 w-full rounded-xl border border-line bg-surface px-4 py-3 text-[16px]"
              />
              <div className="rounded-xl border border-line bg-surface">
                {filtered.length === 0 && (
                  <p className="p-4 text-[15px] text-muted">{foods && foods.length === 0 ? t('food.libraryEmpty') : t('food.noMatch')}</p>
                )}
                {filtered.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => pickFood(f)}
                    className="flex w-full min-h-[52px] items-center gap-3 border-b border-line px-4 py-2 last:border-b-0 text-left"
                  >
                    <PhotoThumb blob={f.photo} alt={f.name} />
                    <span className="flex-1">
                      <span className="block text-[16px]">{f.name}</span>
                      <span className="block text-[13px] text-muted">{f.kcal} kcal · {f.proteinG} {t('food.gramUnit')}</span>
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
              <label htmlFor="fe-1" className="flex min-h-[44px] w-24 items-center text-[15px] text-muted">{t('food.name')}</label>
              <input id="fe-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!!picked}
                className="min-h-[44px] flex-1 bg-transparent text-[16px] outline-none disabled:text-muted"
              />
            </Row>
            <Row>
              <label htmlFor="fe-2" className="flex min-h-[44px] w-24 items-center text-[15px] text-muted">{t('food.kcalField')}</label>
              <input id="fe-2"
                inputMode="decimal"
                value={kcalStr}
                onChange={(e) => setKcalStr(e.target.value)}
                className="min-h-[44px] flex-1 bg-transparent text-[16px] outline-none"
              />
            </Row>
            <Row>
              <label htmlFor="fe-3" className="flex min-h-[44px] w-24 items-center text-[15px] text-muted">{t('food.proteinG')}</label>
              <input id="fe-3"
                inputMode="decimal"
                value={proteinStr}
                onChange={(e) => setProteinStr(e.target.value)}
                className="min-h-[44px] flex-1 bg-transparent text-[16px] outline-none"
              />
            </Row>
            <Row>
              <label htmlFor="fe-4" className="flex min-h-[44px] w-24 items-center text-[15px] text-muted">{t('food.portion')}</label>
              <input id="fe-4"
                inputMode="decimal"
                value={portionStr}
                onChange={(e) => setPortionStr(e.target.value)}
                className="min-h-[44px] flex-1 bg-transparent text-[16px] outline-none"
              />
            </Row>
            {portion !== 1 && (
              <Row className="text-[14px] text-muted">
                {t('food.adjustEntry')}: {finalKcal} kcal · {finalProtein} {t('food.gramUnit')}
              </Row>
            )}
            <Row>
              <label htmlFor="fe-5" className="flex min-h-[44px] w-24 items-center text-[15px] text-muted">{t('food.date')}</label>
              <input id="fe-5"
                type="date"
                value={date}
                max={localDate()}
                onChange={(e) => setDate(e.target.value)}
                className="min-h-[44px] flex-1 bg-transparent text-[16px] outline-none"
              />
            </Row>
          </Section>

          <Section title={t('food.photo')}>
            <PhotoField photo={photo} onChange={setPhoto} maxSide={FOOD_PHOTO_MAX} capture="environment" alt={name || t('food.photoOf')} />
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

          {error && <p className="mb-3 text-[14px] text-weights">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="mb-3 w-full min-h-[52px] rounded-xl bg-food text-[17px] font-semibold text-white disabled:opacity-50"
          >
            {t('common.save')}
          </button>

          {!isNew && (
            <button
              onClick={() => setDeleteSheet(true)}
              className="w-full min-h-[52px] rounded-xl border border-line text-[16px] text-weights"
            >
              {t('food.delete')}
            </button>
          )}

          <Sheet open={deleteSheet} onClose={() => setDeleteSheet(false)} title={t('food.deleteConfirm')}>
            <SheetButton tone="danger" onClick={handleDelete}>{t('food.delete')}</SheetButton>
            <SheetButton onClick={() => setDeleteSheet(false)}>{t('common.cancel')}</SheetButton>
          </Sheet>
        </>
      )}
    </Page>
  )
}
