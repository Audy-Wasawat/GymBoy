import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Plus } from 'lucide-react'
import { Page, Row, Section } from '../components/Page'
import { Sheet, SheetButton } from '../components/Sheet'
import { activitySec, addActivity, deleteActivity, listActivities, listSportSuggestions, updateActivity } from '../db/activities'
import { db } from '../db/db'
import { useSettings } from '../db/useSettings'
import { useT } from '../i18n/useT'
import { formatDate, isPastOrToday, localDate } from '../lib/dates'
import { DurationBoxes, formatHms, hmsToSec, secToHms } from '../components/DurationBoxes'
import { EFFORT_MAX, EffortMeter, EffortPicker } from '../components/EffortBars'


export function Activities() {
  const t = useT()
  const { language } = useSettings()
  const nav = useNavigate()
  const activities = useLiveQuery(listActivities, [])

  return (
    <Page title={t('act.title')} back="/more">
      <button
        onClick={() => nav('/more/activities/new')}
        className="mb-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-other text-[16px] font-semibold text-white"
      >
        <Plus size={18} aria-hidden />
        {t('act.add')}
      </button>

      {activities?.length === 0 ? (
        <p className="px-1 py-4 text-[15px] text-muted">{t('act.empty')}</p>
      ) : (
        <div className="rounded-xl border border-line bg-surface">
          {activities?.map((a) => (
            <button
              key={a.id}
              onClick={() => nav(`/more/activities/${a.id}`)}
              className="flex w-full min-h-[52px] items-center gap-3 border-b border-line px-4 py-2 last:border-b-0 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px]">{a.sport}</span>
                <span className="block text-[13px] text-muted">
                  {formatDate(a.date, language)} · {formatHms(activitySec(a), t)}
                </span>
              </span>
              {a.effort ? (
                <span className="flex shrink-0 items-center gap-1.5" aria-label={`${t('act.effort')} ${a.effort}/${EFFORT_MAX}`}>
                  <EffortMeter value={a.effort} />
                  <span className="text-[13px] font-semibold tabular-nums text-muted">{a.effort}</span>
                </span>
              ) : null}
              <ChevronRight size={18} className="text-muted" aria-hidden />
            </button>
          ))}
        </div>
      )}
    </Page>
  )
}

export function ActivityEditor() {
  const t = useT()
  const nav = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'

  const existing = useLiveQuery(
    async () => (!isNew && id ? (await db.activities.get(Number(id))) ?? null : null),
    [id, isNew]
  )
  const suggestions = useLiveQuery(listSportSuggestions, [])

  const [sport, setSport] = useState('')
  const [h, setH] = useState('')
  const [m, setM] = useState('')
  const [s, setS] = useState('')
  const [effort, setEffort] = useState<number | undefined>()
  const [note, setNote] = useState('')
  const [date, setDate] = useState(localDate())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteSheet, setDeleteSheet] = useState(false)

  const loaded = useRef(false)
  useEffect(() => {
    if (!isNew && existing && !loaded.current) {
      loaded.current = true
      setSport(existing.sport)
      const hms = secToHms(activitySec(existing))
      setH(hms.h); setM(hms.m); setS(hms.s)
      setEffort(existing.effort)
      setNote(existing.note ?? '')
      setDate(existing.date)
    }
  }, [isNew, existing])

  const filteredSuggestions = suggestions?.filter(
    (s) => s.toLowerCase().includes(sport.toLowerCase()) && s.toLowerCase() !== sport.toLowerCase()
  ).slice(0, 6) ?? []

  async function handleSave() {
    if (!sport.trim()) { setError(t('act.sportRequired')); return }
    const durationSec = hmsToSec(h, m, s)
    if (durationSec <= 0) { setError(t('act.minutesRequired')); return }
    if (!isPastOrToday(date)) { setError(t('act.futureDate')); return }
    setSaving(true)
    try {
      const act = { sport: sport.trim(), minutes: Math.round(durationSec / 60), durationSec, effort, note: note.trim() || undefined, date }
      if (isNew) { await addActivity(act) } else { await updateActivity(Number(id), act) }
      nav(-1)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    await deleteActivity(Number(id))
    nav('/more/activities', { replace: true })
  }

  if (existing === undefined) return null

  return (
    <Page title={isNew ? t('act.addTitle') : t('act.editTitle')} back="/more/activities">
      <Section>
        <Row>
          <label className="w-24 text-[15px] text-muted">{t('act.sport')}</label>
          <div className="relative flex-1">
            <input
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              list="sport-suggestions"
              className="w-full bg-transparent text-[16px] outline-none"
            />
            {filteredSuggestions.length > 0 && (
              <datalist id="sport-suggestions">
                {filteredSuggestions.map((s) => <option key={s} value={s} />)}
              </datalist>
            )}
          </div>
        </Row>
        <div className="border-b border-line px-4 py-3">
          <span className="text-[15px] text-muted">{t('act.minutes')}</span>
          <DurationBoxes h={h} m={m} s={s} onH={setH} onM={setM} onS={setS} />
        </div>
        <div className="border-b border-line px-4 py-3">
          <span className="text-[15px] text-muted">{t('act.effort')}</span>
          <div className="mt-1">
            <EffortPicker value={effort} onChange={setEffort} />
          </div>
        </div>
        <Row>
          <label className="w-24 text-[15px] text-muted">{t('act.note')}</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="flex-1 bg-transparent text-[16px] outline-none"
          />
        </Row>
        <Row>
          <label className="w-24 text-[15px] text-muted">{t('act.date')}</label>
          <input
            type="date"
            value={date}
            max={localDate()}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 bg-transparent text-[16px] outline-none"
          />
        </Row>
      </Section>

      {error && <p className="mb-3 text-[14px] text-weights">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="mb-3 w-full min-h-[52px] rounded-xl bg-other text-[17px] font-semibold text-white disabled:opacity-50"
      >
        {t('common.save')}
      </button>

      {!isNew && (
        <button
          onClick={() => setDeleteSheet(true)}
          className="w-full min-h-[52px] rounded-xl border border-line text-[16px] text-weights"
        >
          {t('act.delete')}
        </button>
      )}

      <Sheet open={deleteSheet} onClose={() => setDeleteSheet(false)} title={t('act.deleteConfirm')}>
        <SheetButton tone="danger" onClick={handleDelete}>{t('act.delete')}</SheetButton>
        <SheetButton onClick={() => setDeleteSheet(false)}>{t('common.cancel')}</SheetButton>
      </Sheet>
    </Page>
  )
}
