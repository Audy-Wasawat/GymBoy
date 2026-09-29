import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Page, Row, Section } from '../../components/Page'
import { Sheet, SheetButton } from '../../components/Sheet'
import { addBodyEntry, deleteBodyEntry, updateBodyEntry } from '../../db/body'
import { db } from '../../db/db'
import { useSettings } from '../../db/useSettings'
import { useT } from '../../i18n/useT'
import { isPastOrToday, localDate } from '../../lib/dates'
import { fromDisplayWeight, toDisplayWeight } from '../../lib/units'
import { PhotoField } from '../../components/PhotoField'
import { BODY_PHOTO_MAX } from '../../lib/photos'

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
  const [deleteSheet, setDeleteSheet] = useState(false)

  const loaded = useRef(false)
  useEffect(() => {
    if (!isNew && existing && !loaded.current) {
      loaded.current = true
      setWeightStr(String(toDisplayWeight(existing.weightKg, weightUnit)))
      setDate(existing.date)
      setPhoto(existing.photo)
    }
  }, [isNew, existing, weightUnit])

  async function handleSave() {
    const w = parseFloat(weightStr)
    if (!weightStr || !isFinite(w) || w <= 0) { setError(t('body.weightRequired')); return }
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
    await deleteBodyEntry(Number(id))
    nav('/more/body', { replace: true })
  }

  if (existing === undefined) return null
  if (!isNew && existing === null) return <Page title={t('body.editTitle')} back="/more/body">{null}</Page>

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
        <PhotoField
          photo={photo}
          onChange={setPhoto}
          maxSide={BODY_PHOTO_MAX}
          capture="user"
          alt={`${t('body.photo')} ${date}`}
          allowRemove={false}
        />
      </Section>

      {error && <p className="mb-3 text-[14px] text-weights">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="mb-3 w-full min-h-[52px] rounded-xl bg-weights text-[17px] font-semibold text-white disabled:opacity-50"
      >
        {t('common.save')}
      </button>

      {!isNew && (
        <button
          onClick={() => setDeleteSheet(true)}
          className="w-full min-h-[52px] rounded-xl border border-line text-[16px] text-weights"
        >
          {t('body.delete')}
        </button>
      )}

      <Sheet open={deleteSheet} onClose={() => setDeleteSheet(false)} title={t('body.deleteConfirm')}>
        <SheetButton tone="danger" onClick={handleDelete}>{t('body.delete')}</SheetButton>
        <SheetButton onClick={() => setDeleteSheet(false)}>{t('common.cancel')}</SheetButton>
      </Sheet>
    </Page>
  )
}
