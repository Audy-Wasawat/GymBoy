import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2 } from 'lucide-react'
import { Page } from '../../components/Page'
import { Field, TextInput } from '../../components/Field'
import { Segmented } from '../../components/Segmented'
import { Sheet, SheetButton, NameSheet } from '../../components/Sheet'
import { db } from '../../db/db'
import { addRun, addTemplate, deleteRun, listTemplates, updateRun } from '../../db/runs'
import type { IntervalPlan, IntervalRepResult, RunLog, RunType, Surface } from '../../db/types'
import { useT } from '../../i18n/useT'
import { isPastOrToday, localDate } from '../../lib/dates'
import { parseCount, parseDecimal, parseDuration, formatDuration } from '../../lib/numbers'
import { avgRepPace, paceSecPerKm, repPace } from '../../lib/running'
import { formatPace, round } from '../../lib/units'
import type { StringKey } from '../../i18n/strings'

const TYPE_OPTS: { value: RunType; key: StringKey }[] = [
  { value: 'easy', key: 'run.typeEasy' }, { value: 'lsd', key: 'run.typeLsd' },
  { value: 'tempo', key: 'run.typeTempo' }, { value: 'interval', key: 'run.typeInterval' }
]

const hmsToSec = (h: string, m: string, s: string) =>
  (parseCount(h) ?? 0) * 3600 + (parseCount(m) ?? 0) * 60 + (parseCount(s) ?? 0)

const secToHms = (sec: number) => ({
  h: sec >= 3600 ? String(Math.floor(sec / 3600)) : '',
  m: String(Math.floor((sec % 3600) / 60)),
  s: String(sec % 60)
})

export function RunEditor() {
  const t = useT()
  const navigate = useNavigate()
  const editingId = useParams().id ? Number(useParams().id) : undefined
  const existing = useLiveQuery(async () => (editingId ? (await db.runs.get(editingId)) ?? null : null), [editingId])
  const shoes = useLiveQuery(() => db.shoes.toArray(), [])
  const templates = useLiveQuery(listTemplates, [])

  const [date, setDate] = useState(localDate())
  const [type, setType] = useState<RunType>('easy')
  const [distance, setDistance] = useState('')
  const [h, setH] = useState('')
  const [m, setM] = useState('')
  const [s, setS] = useState('')
  const [shoeId, setShoeId] = useState<number | undefined>(undefined)
  const [avgHr, setAvgHr] = useState('')
  const [maxHr, setMaxHr] = useState('')
  const [surface, setSurface] = useState<Surface | ''>('')
  const [note, setNote] = useState('')

  // Interval plan and per-rep results.
  const [reps, setReps] = useState('6')
  const [planMode, setPlanMode] = useState<'distance' | 'time'>('distance')
  const [repDistanceM, setRepDistanceM] = useState('')
  const [repDurationSec, setRepDurationSec] = useState('')
  const [targetPace, setTargetPace] = useState('')
  const [restSec, setRestSec] = useState('')
  const [repInputs, setRepInputs] = useState<string[]>([])

  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [pickShoe, setPickShoe] = useState(false)
  const [applying, setApplying] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Load an existing run once it arrives.
  useEffect(() => {
    if (!existing) return
    setDate(existing.date)
    setType(existing.type)
    setDistance(String(round(existing.distanceKm, 2)))
    const { h: hh, m: mm, s: ss } = secToHms(existing.durationSec)
    setH(hh); setM(mm); setS(ss)
    setShoeId(existing.shoeId)
    setAvgHr(existing.avgHr ? String(existing.avgHr) : '')
    setMaxHr(existing.maxHr ? String(existing.maxHr) : '')
    setSurface(existing.surface ?? '')
    setNote(existing.note ?? '')
    if (existing.plan) {
      setReps(String(existing.plan.reps))
      setPlanMode(existing.plan.durationSec ? 'time' : 'distance')
      setRepDistanceM(existing.plan.distanceM ? String(existing.plan.distanceM) : '')
      setRepDurationSec(existing.plan.durationSec ? formatDuration(existing.plan.durationSec) : '')
      setTargetPace(existing.plan.targetPaceSecPerKm ? formatPace(existing.plan.targetPaceSecPerKm) : '')
      setRestSec(existing.plan.restSec ? String(existing.plan.restSec) : '')
      const inputs = Array.from({ length: existing.plan.reps }, (_, i) => {
        const rr = existing.repResults?.find((x) => x.rep === i + 1)
        if (!rr) return ''
        return existing.plan!.durationSec
          ? (rr.distanceM ? String(rr.distanceM) : '')
          : (rr.durationSec ? formatDuration(rr.durationSec) : '')
      })
      setRepInputs(inputs)
    }
  }, [existing])

  // Keep the per-rep rows in step with the rep count.
  const repCount = parseCount(reps) ?? 0
  useEffect(() => {
    if (type !== 'interval') return
    setRepInputs((prev) => {
      const next = Array.from({ length: repCount }, (_, i) => prev[i] ?? '')
      return next
    })
  }, [repCount, type])

  const plan: IntervalPlan | undefined = useMemo(() => {
    if (type !== 'interval') return undefined
    return {
      reps: repCount,
      distanceM: planMode === 'distance' ? parseCount(repDistanceM) : undefined,
      durationSec: planMode === 'time' ? parseDuration(repDurationSec) : undefined,
      targetPaceSecPerKm: parseDuration(targetPace),
      restSec: parseCount(restSec)
    }
  }, [type, repCount, planMode, repDistanceM, repDurationSec, targetPace, restSec])

  const distanceKm = parseDecimal(distance)
  const durationSec = hmsToSec(h, m, s)
  const overallPace = distanceKm !== undefined ? paceSecPerKm(distanceKm, durationSec) : undefined

  const currentShoe = shoes?.find((sh) => sh.id === shoeId)
  // Retired pairs are offered only when already assigned to this run.
  const shoeOptions = shoes?.filter((sh) => !sh.retired || sh.id === shoeId) ?? []

  const applyTemplate = (tplPlan: IntervalPlan, tplType: RunType) => {
    setType(tplType)
    setReps(String(tplPlan.reps))
    setPlanMode(tplPlan.durationSec ? 'time' : 'distance')
    setRepDistanceM(tplPlan.distanceM ? String(tplPlan.distanceM) : '')
    setRepDurationSec(tplPlan.durationSec ? formatDuration(tplPlan.durationSec) : '')
    setTargetPace(tplPlan.targetPaceSecPerKm ? formatPace(tplPlan.targetPaceSecPerKm) : '')
    setRestSec(tplPlan.restSec ? String(tplPlan.restSec) : '')
    setApplying(false)
  }

  const buildRepResults = (): IntervalRepResult[] => {
    if (!plan) return []
    return repInputs.map((text, i) => {
      const rep = i + 1
      if (planMode === 'distance') {
        const durationSec = parseDuration(text)
        return { rep, durationSec, paceSecPerKm: repPace(plan, { durationSec }) }
      }
      const distanceM = parseCount(text)
      return { rep, distanceM, paceSecPerKm: repPace(plan, { distanceM }) }
    })
  }

  const hr = (text: string) => {
    const n = parseCount(text)
    return n !== undefined && n >= 30 && n <= 250 ? n : undefined
  }
  // A typed HR that falls outside 30-250 is flagged rather than silently dropped.
  const hrOutOfRange = (text: string) => {
    const n = parseCount(text)
    return n !== undefined && (n < 30 || n > 250)
  }
  const hrError = hrOutOfRange(avgHr) || hrOutOfRange(maxHr)

  const save = async () => {
    if (saving) return
    if (!isPastOrToday(date)) { setError(t('run.futureDate')); return }
    if (distanceKm === undefined || distanceKm <= 0 || durationSec <= 0) { setError(t('run.distanceRequired')); return }
    if (hrError) { setError(t('run.hrRange')); return }
    setSaving(true)
    const run: Omit<RunLog, 'id'> = {
      date,
      type,
      distanceKm: round(distanceKm, 2),
      durationSec,
      shoeId,
      note: note.trim() || undefined,
      avgHr: hr(avgHr),
      maxHr: hr(maxHr),
      surface: surface || undefined,
      plan: type === 'interval' && plan && plan.reps > 0 ? plan : undefined,
      repResults: type === 'interval' && plan && plan.reps > 0 ? buildRepResults() : undefined
    }
    if (editingId) await updateRun(editingId, run)
    else await addRun(run)
    navigate('/running')
  }

  const saveTemplate = async (name: string) => {
    if (plan && plan.reps > 0) await addTemplate({ name, type, plan })
    setSavingTemplate(false)
  }

  const remove = async () => {
    if (editingId) await deleteRun(editingId)
    navigate('/running')
  }

  if (editingId && existing === null) return <Page title={t('run.notFound')} back="/running">{null}</Page>

  return (
    <Page title={editingId ? t('run.editTitle') : t('run.newTitle')} back="/running">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('run.date')}>
            <input
              type="date"
              value={date}
              max={localDate()}
              onChange={(e) => setDate(e.target.value)}
              aria-label={t('run.date')}
              className="min-h-[48px] w-full rounded-lg border border-line bg-bg px-3 text-[16px]"
            />
          </Field>
          <Field label={t('run.distance')}>
            <TextInput value={distance} onChange={setDistance} inputMode="decimal" ariaLabel={t('run.distance')} placeholder="0" />
          </Field>
        </div>

        <Field label={t('run.type')}>
          <Segmented value={type} onChange={setType} label={t('run.type')} options={TYPE_OPTS.map((o) => ({ value: o.value, label: t(o.key) }))} />
        </Field>

        <div>
          <span className="text-[13px] text-muted">{t('run.duration')}</span>
          <div className="mt-1 flex items-end gap-2">
            <DurationBox value={h} onChange={setH} label={t('run.hours')} />
            <span className="pb-3 text-muted">:</span>
            <DurationBox value={m} onChange={setM} label={t('run.minutes')} />
            <span className="pb-3 text-muted">:</span>
            <DurationBox value={s} onChange={setS} label={t('run.seconds')} />
          </div>
          {overallPace && (
            <p className="mt-1 text-[13px] text-muted">{t('run.pace')}: {formatPace(overallPace)} {t('run.paceUnit')}</p>
          )}
        </div>

        <Field label={t('run.shoe')}>
          <button
            type="button"
            onClick={() => setPickShoe(true)}
            className="min-h-[48px] w-full rounded-lg border border-line bg-bg px-3 text-left text-[16px]"
          >
            {currentShoe ? currentShoe.name : <span className="text-muted">{t('run.noShoe')}</span>}
          </button>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('run.avgHr')}>
            <TextInput value={avgHr} onChange={setAvgHr} inputMode="numeric" ariaLabel={t('run.avgHr')} placeholder={t('run.bpm')} />
          </Field>
          <Field label={t('run.maxHr')}>
            <TextInput value={maxHr} onChange={setMaxHr} inputMode="numeric" ariaLabel={t('run.maxHr')} placeholder={t('run.bpm')} />
          </Field>
        </div>
        {hrError && <p className="-mt-2 text-[13px] text-weights">{t('run.hrRange')}</p>}

        <Field label={t('run.surface')}>
          <Segmented
            value={surface || 'none'}
            onChange={(v) => setSurface(v === 'none' ? '' : (v as Surface))}
            label={t('run.surface')}
            options={[
              { value: 'none', label: t('run.surfaceNone') },
              { value: 'treadmill', label: t('run.treadmill') },
              { value: 'outdoor', label: t('run.outdoor') }
            ]}
          />
        </Field>

        {type === 'interval' && (
          <section className="rounded-xl border border-line bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">{t('run.plan')}</h2>
              <button type="button" onClick={() => setApplying(true)} className="text-[14px] font-semibold text-running">
                {t('run.applyTemplate')}
              </button>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <Field label={t('run.reps')}>
                <TextInput value={reps} onChange={setReps} inputMode="numeric" ariaLabel={t('run.reps')} />
              </Field>
              <Field label={t('run.restSec')}>
                <TextInput value={restSec} onChange={setRestSec} inputMode="numeric" ariaLabel={t('run.restSec')} />
              </Field>
            </div>
            <div className="mb-3">
              <Segmented
                value={planMode}
                onChange={(v) => setPlanMode(v)}
                label={t('run.plan')}
                options={[{ value: 'distance', label: t('run.byDistance') }, { value: 'time', label: t('run.byTime') }]}
              />
            </div>
            <div className="mb-3 grid grid-cols-2 gap-3">
              {planMode === 'distance' ? (
                <Field label={t('run.repDistanceM')}>
                  <TextInput value={repDistanceM} onChange={setRepDistanceM} inputMode="numeric" ariaLabel={t('run.repDistanceM')} />
                </Field>
              ) : (
                <Field label={t('run.repDurationSec')}>
                  <TextInput value={repDurationSec} onChange={setRepDurationSec} inputMode="text" ariaLabel={t('run.repDurationSec')} />
                </Field>
              )}
              <Field label={t('run.targetPace')}>
                <TextInput value={targetPace} onChange={setTargetPace} inputMode="text" ariaLabel={t('run.targetPace')} placeholder="m:ss" />
              </Field>
            </div>

            {repCount > 0 && (() => {
              const paces = Array.from({ length: repCount }, (_, i) => {
                const text = repInputs[i] ?? ''
                return planMode === 'distance'
                  ? repPace(plan!, { durationSec: parseDuration(text) })
                  : repPace(plan!, { distanceM: parseCount(text) })
              })
              const avg = avgRepPace(paces.map((p, i) => ({ rep: i + 1, paceSecPerKm: p })))
              const planPer = planMode === 'distance'
                ? (plan!.distanceM ? `${plan!.distanceM} m` : '—')
                : (plan!.durationSec ? formatDuration(plan!.durationSec) : '—')
              return (
                <div className="mt-4">
                  <div className="mb-2 flex items-baseline justify-between text-[13px] text-muted">
                    <span>{t('run.planLabel')}: {planPer}{plan!.targetPaceSecPerKm ? ` @ ${formatPace(plan!.targetPaceSecPerKm)}` : ''}</span>
                    {avg ? <span>{t('run.avgRepPace')}: {formatPace(avg)}</span> : null}
                  </div>
                  <div className="mb-1 flex items-center gap-3 text-[12px] text-muted">
                    <span className="w-12">{t('run.rep')}</span>
                    <span className="flex-1">{t('run.actualLabel')}</span>
                    <span className="w-20 text-right">{t('run.paceUnit')}</span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {Array.from({ length: repCount }, (_, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <span className="w-12 text-[14px] text-muted">{i + 1}</span>
                        <input
                          value={repInputs[i] ?? ''}
                          onChange={(e) => setRepInputs((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                          inputMode={planMode === 'distance' ? 'text' : 'numeric'}
                          aria-label={`${t('run.rep')} ${i + 1} ${planMode === 'distance' ? t('run.repTime') : t('run.repDistance')}`}
                          className="min-h-[44px] flex-1 rounded-lg border border-line bg-bg px-3 text-[16px]"
                        />
                        <span className="w-20 text-right text-[14px] text-muted">{paces[i] ? formatPace(paces[i]!) : '—'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })()}

            <button type="button" onClick={() => setSavingTemplate(true)} className="mt-4 text-[14px] font-semibold text-running">
              {t('run.saveTemplate')}
            </button>
          </section>
        )}

        <Field label={t('run.note')}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            aria-label={t('run.note')}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[16px]"
          />
        </Field>

        {error && <p className="text-[14px] text-weights">{error}</p>}

        <button onClick={save} disabled={saving} className="min-h-[52px] w-full rounded-xl bg-running text-[16px] font-semibold text-white disabled:opacity-50">
          {t('run.save')}
        </button>

        {editingId && (
          <button onClick={() => setConfirmDelete(true)} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-line text-[15px] text-weights">
            <Trash2 size={18} aria-hidden />
            {t('run.delete')}
          </button>
        )}
      </div>

      <Sheet open={pickShoe} onClose={() => setPickShoe(false)} title={t('run.shoe')}>
        <SheetButton onClick={() => { setShoeId(undefined); setPickShoe(false) }}>{t('run.noShoe')}</SheetButton>
        {shoeOptions.map((sh) => (
          <SheetButton key={sh.id} onClick={() => { setShoeId(sh.id); setPickShoe(false) }} tone={sh.id === shoeId ? 'primary' : 'plain'}>
            {sh.name}{sh.retired ? ` · ${t('shoe.retired')}` : ''}
          </SheetButton>
        ))}
      </Sheet>

      <Sheet open={applying} onClose={() => setApplying(false)} title={t('run.applyTemplate')}>
        {templates && templates.length === 0 && <p className="mb-2 text-[15px] text-muted">{t('run.noTemplates')}</p>}
        {templates?.map((tpl) => (
          <SheetButton key={tpl.id} onClick={() => applyTemplate(tpl.plan, tpl.type)}>{tpl.name}</SheetButton>
        ))}
      </Sheet>

      <NameSheet
        open={savingTemplate}
        title={t('run.saveTemplate')}
        saveLabel={t('common.save')}
        onSave={saveTemplate}
        onClose={() => setSavingTemplate(false)}
      />

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title={t('run.deleteConfirm')}>
        <SheetButton onClick={remove} tone="danger">{t('run.delete')}</SheetButton>
        <SheetButton onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</SheetButton>
      </Sheet>
    </Page>
  )
}

function DurationBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="flex flex-1 flex-col items-center gap-1">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        placeholder="0"
        aria-label={label}
        className="min-h-[48px] w-full rounded-lg border border-line bg-bg px-2 text-center text-[16px]"
      />
      <span className="text-[12px] text-muted">{label}</span>
    </label>
  )
}
