import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Page, Row, Section } from '../../components/Page'
import { addFood, deleteFood, updateFood } from '../../db/food'
import { db } from '../../db/db'
import { useT } from '../../i18n/useT'
import { usePhotoUrl } from '../../components/usePhotoUrl'
import { compressImage, FOOD_PHOTO_MAX } from '../../lib/photos'

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

  const photoUrl = usePhotoUrl(photo)

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file, FOOD_PHOTO_MAX)
    setPhoto(compressed)
  }

  async function handleSave() {
    if (!name.trim()) { setError(t('food.nameRequired')); return }
    if (!kcalStr.trim() || isNaN(Number(kcalStr))) { setError(t('food.kcalRequired')); return }
    setSaving(true)
    try {
      const food = {
        name: name.trim(),
        kcal: Math.round(parseFloat(kcalStr)),
        proteinG: parseFloat(proteinStr) || 0,
        ...(photo ? { photo } : {})
      }
      if (isNew) {
        await addFood(food)
      } else {
        await updateFood(Number(id), food)
      }
      nav(-1)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    if (!confirm(t('food.deleteLibraryConfirm'))) return
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
        <div className="px-4 py-3">
          {photoUrl && (
            <img src={photoUrl} alt={name} className="mb-3 h-40 w-full rounded-lg object-cover" />
          )}
          <label className="flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg border border-line bg-surface px-4 text-[15px]">
            {photoUrl ? t('food.changePhoto') : t('food.addPhoto')}
            <input type="file" accept="image/*" className="sr-only" onChange={handlePhoto} />
          </label>
        </div>
      </Section>

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
          {t('food.deleteLibrary')}
        </button>
      )}
    </Page>
  )
}
