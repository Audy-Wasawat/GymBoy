import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Page, Row, Section } from '../../components/Page'
import { addBodyEntry, deleteBodyEntry, updateBodyEntry } from '../../db/body'
import { db } from '../../db/db'
import { useSettings } from '../../db/useSettings'
import { useT } from '../../i18n/useT'
import { isPastOrToday, localDate } from '../../lib/dates'
import { fromDisplayWeight, toDisplayWeight } from '../../lib/units'
import { usePhotoUrl } from '../../components/usePhotoUrl'
import { BODY_PHOTO_MAX, compressImage } from '../../lib/photos'

export function BodyEntryEditor() {
  const t = useT()
  const nav = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const { weightUnit } = useSettings()

  const existing = useLiveQuery(
    async () => (!isNew && id ? (await db.bodyEntries.get(Number(id))) ?? null : null),
    [id, isNew]
  )

  const [weightStr, setWeightStr] = useState('')
  const [date, setDate] = useState(localDate())
  const [photo, setPhoto] = useState<Blob | undefined>()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const loaded = useRef(false)
  useEffect(() => {
    if (!isNew && existing && !loaded.current) {
      loaded.current = true
      setWeightStr(String(toDisplayWeight(existing.weightKg, weightUnit)))
      setDate(existing.date)
      setPhoto(existing.photo)
    }
  }, [isNew, existing, weightUnit])

  const photoUrl = usePhotoUrl(photo)

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file, BODY_PHOTO_MAX)
    setPhoto(compressed)
  }

  async function handleSave() {
    const w = parseFloat(weightStr)
    if (!weightStr || isNaN(w) || w <= 0) { setError(t('body.weightRequired')); return }
    if (!isPastOrToday(date)) { setError(t('body.futureDate')); return }
    setSaving(true)
    try {
      const entry = {
        date,
        weightKg: fromDisplayWeight(w, weightUnit),
        ...(photo ? { photo } : {})
      }
      if (isNew) { await addBodyEntry(entry) } else { await updateBodyEntry(Number(id), entry) }
      nav(-1)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    if (!confirm(t('body.deleteConfirm'))) return
    await deleteBodyEntry(Number(id))
    nav('/more/body', { replace: true })
  }

  if (existing === undefined) return null

  return (
    <Page title={isNew ? t('body.addTitle') : t('body.editTitle')} back="/more/body">
      <Section>
        <Row>
          <label className="w-24 text-[15px] text-muted">{t('body.weight')} ({weightUnit})</label>
          <input
            inputMode="decimal"
            value={weightStr}
            onChange={(e) => setWeightStr(e.target.value)}
            className="flex-1 bg-transparent text-[16px] outline-none"
          />
        </Row>
        <Row>
          <label className="w-24 text-[15px] text-muted">{t('body.date')}</label>
          <input
            type="date"
            value={date}
            max={localDate()}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 bg-transparent text-[16px] outline-none"
          />
        </Row>
      </Section>

      <Section title={t('body.photo')}>
        <div className="px-4 py-3">
          {photoUrl && (
            <img src={photoUrl} alt={date} className="mb-3 w-full rounded-lg object-cover" style={{ maxHeight: 300 }} />
          )}
          <label className="flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg border border-line bg-surface px-4 text-[15px]">
            {photoUrl ? t('body.changePhoto') : t('body.addPhoto')}
            <input type="file" accept="image/*" capture="user" className="sr-only" onChange={handlePhoto} />
          </label>
        </div>
      </Section>

      {error && <p className="mb-3 text-[14px] text-red-500">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="mb-3 w-full min-h-[52px] rounded-xl bg-weights text-[17px] font-semibold text-white disabled:opacity-50"
      >
        {t('common.save')}
      </button>

      {!isNew && (
        <button
          onClick={handleDelete}
          className="w-full min-h-[52px] rounded-xl border border-red-400 text-[16px] text-red-500"
        >
          {t('body.delete')}
        </button>
      )}
    </Page>
  )
}
