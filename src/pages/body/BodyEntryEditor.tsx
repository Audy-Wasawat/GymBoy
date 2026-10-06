import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Page, Row, Section } from '../../components/Page'
import { Sheet, SheetButton } from '../../components/Sheet'
import { addBodyEntry, deleteBodyEntry, updateBodyEntry } from '../../db/body'
import { db } from '../../db/db'
import { useSettings } from '../../db/useSettings'
import { useT } from '../../i18n/useT'
import { formatDate, isPastOrToday, localDate } from '../../lib/dates'
import { MAX_BODY_KG } from '../../lib/foodEntry'
import { parseDecimal } from '../../lib/numbers'
import { fromDisplayWeight, toDisplayWeight } from '../../lib/units'
import { BodyPhotosField } from './BodyPhotosField'
import type { BodyPhoto } from '../../db/types'

export function BodyEntryEditor() {
  const t = useT()
  const nav = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const { weightUnit, language } = useSettings()

  const existing = useLiveQuery(
    async () => (!isNew && id ? (await db.bodyEntries.get(Number(id))) ?? null : null),
    [id, isNew]
  )

  const [weightStr, setWeightStr] = useState('')
  const [date, setDate] = useState(localDate())
  const [photos, setPhotos] = useState<BodyPhoto[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteSheet, setDeleteSheet] = useState(false)

  const loaded = useRef(false)
  // The weight as first shown; if it is unchanged on save, the stored kg stays as it is (converting the
  // rounded lb value back would drift it, e.g. 72.5 kg -> 159.8 lb -> 72.484 kg).
  const shownWeight = useRef('')
  useEffect(() => {
    if (!isNew && existing && !loaded.current) {
      loaded.current = true
      shownWeight.current = String(toDisplayWeight(existing.weightKg, weightUnit))
      setWeightStr(shownWeight.current)
      setDate(existing.date)
      setPhotos(existing.photos ?? [])
    }
  }, [isNew, existing, weightUnit])

  async function handleSave() {
    const w = parseDecimal(weightStr)
    if (w === undefined || w <= 0) { setError(t('body.weightRequired')); return }
    if (fromDisplayWeight(w, weightUnit) > MAX_BODY_KG) { setError(t('error.tooLarge')); return }
    if (!isPastOrToday(date)) { setError(t('body.futureDate')); return }
    setSaving(true)
    try {
      const entry = {
        date,
        weightKg: !isNew && existing && weightStr === shownWeight.current ? existing.weightKg : fromDisplayWeight(w, weightUnit),
        photos: photos.length ? photos : undefined
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
          <label htmlFor="be-1" className="flex min-h-[44px] w-24 items-center text-[15px] text-muted">{t('body.weight')} ({weightUnit})</label>
          <input id="be-1"
            inputMode="decimal"
            value={weightStr}
            onChange={(e) => setWeightStr(e.target.value)}
            className="min-h-[44px] flex-1 bg-transparent text-[16px] outline-none"
          />
        </Row>
        <Row>
          <label htmlFor="be-2" className="flex min-h-[44px] w-24 items-center text-[15px] text-muted">{t('body.date')}</label>
          <input id="be-2"
            type="date"
            value={date}
            max={localDate()}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-[44px] flex-1 bg-transparent text-[16px] outline-none"
          />
        </Row>
      </Section>

      <Section title={t('body.photos')}>
        <BodyPhotosField photos={photos} onChange={setPhotos} alt={`${t('body.photo')} ${formatDate(date, language)}`} />
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
