import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Page, Row, Section } from '../../components/Page'
import { Sheet, SheetButton } from '../../components/Sheet'
import { addFood, deleteFood, updateFood } from '../../db/food'
import { db } from '../../db/db'
import { useT } from '../../i18n/useT'
import { PhotoField } from '../../components/PhotoField'
import { FOOD_PHOTO_MAX } from '../../lib/photos'

export function FoodLibraryEditor() {
  const t = useT()
  const nav = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isNew = !id

  const existing = useLiveQuery(
    async () => (id ? (await db.foods.get(Number(id))) ?? null : null),
    [id]
  )

  const [name, setName] = useState('')
  const [kcalStr, setKcalStr] = useState('')
  const [proteinStr, setProteinStr] = useState('')
  const [photo, setPhoto] = useState<Blob | undefined>()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteSheet, setDeleteSheet] = useState(false)

  const loaded = useRef(false)
  useEffect(() => {
    if (!isNew && existing && !loaded.current) {
      loaded.current = true
      setName(existing.name)
      setKcalStr(String(existing.kcal))
      setProteinStr(String(existing.proteinG))
      setPhoto(existing.photo)
    }
  }, [isNew, existing])

  async function handleSave() {
    if (!name.trim()) { setError(t('food.nameRequired')); return }
    if (!kcalStr.trim() || isNaN(Number(kcalStr))) { setError(t('food.kcalRequired')); return }
    setSaving(true)
    try {
      const food = {
        name: name.trim(),
        kcal: Math.round(parseFloat(kcalStr)),
        proteinG: parseFloat(proteinStr) || 0
      }
      if (isNew) {
        await addFood({ ...food, ...(photo ? { photo } : {}) })
      } else {
        // photo may be undefined here: that removes it.
        await updateFood(Number(id), { ...food, photo })
      }
      nav(-1)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    await deleteFood(Number(id))
    nav('/food/library', { replace: true })
  }

  if (existing === undefined) return null

  const title = isNew ? t('food.newLibraryTitle') : t('food.editLibraryTitle')

  return (
    <Page title={title} back="/food/library">
      <Section>
        <Row>
          <label className="w-24 text-[15px] text-muted">{t('food.name')}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 bg-transparent text-[16px] outline-none"
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
      </Section>

      {/* photo */}
      <Section title={t('food.photo')}>
        <PhotoField photo={photo} onChange={setPhoto} maxSide={FOOD_PHOTO_MAX} capture="environment" alt={name || t('food.photoOf')} />
      </Section>

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
          {t('food.deleteLibrary')}
        </button>
      )}

      <Sheet open={deleteSheet} onClose={() => setDeleteSheet(false)} title={t('food.deleteLibraryConfirm')}>
        <SheetButton tone="danger" onClick={handleDelete}>{t('food.deleteLibrary')}</SheetButton>
        <SheetButton onClick={() => setDeleteSheet(false)}>{t('common.cancel')}</SheetButton>
      </Sheet>
    </Page>
  )
}
