import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Page, Row, Section } from '../components/Page'
import { Sheet, SheetButton } from '../components/Sheet'
import { updateSettings } from '../db/db'
import { useSettings } from '../db/useSettings'
import { useT } from '../i18n/useT'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import {
  aiExportFilename, aiPeriodPreset, backupFilename, BackupTooNewError, clearHistory, createAIExport,
  confirmWordMatches, createBackup, deleteRestorePoint, eraseEverything, getDeleteCounts, parseBackup, photoStats,
  keepRestorePoint, restoreWithUndo, shareOrDownload, undoRestore,
  type AICategory, type BackupCounts, type DeleteCategory, type DeleteCounts
} from '../lib/backup'
import { aiExcelFilename, createAIExcel } from '../lib/aiExcel'
import { mergeBackup, type MergeResult } from '../lib/merge'
import { localDate } from '../lib/dates'

// ─── Backup section ────────────────────────────────────────────────────────────

const mb = (bytes: number) => (bytes < 100 * 1024 ? '< 0.1' : (bytes / 1024 / 1024).toFixed(1))

function FullBackup() {
  const t = useT()
  const [busy, setBusy] = useState<'photos' | 'text' | null>(null)
  const [err, setErr] = useState('')
  const stats = useLiveQuery(photoStats, [])
  // Photos grow by about a third when written into the file as text.
  const withPhotosBytes = stats ? stats.bytes * 1.37 : 0

  async function handleBackup(photos: boolean) {
    setBusy(photos ? 'photos' : 'text')
    setErr('')
    try {
      const blob = await createBackup({ photos })
      const ok = await shareOrDownload(blob, backupFilename(photos))
      if (ok) await updateSettings({ lastBackupAt: Date.now() })
    } catch {
      setErr(t('error.generic'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Section title={t('backup.full')}>
      <Row className="text-[14px] text-muted">{t('backup.fullNote')}</Row>
      {err && <Row className="text-[14px] text-weights">{err}</Row>}
      <Row className="flex-col items-stretch gap-1">
        <button
          onClick={() => handleBackup(true)}
          disabled={!!busy}
          className="w-full min-h-[44px] rounded-lg bg-running text-[16px] font-semibold text-white disabled:opacity-50"
        >
          {busy === 'photos' ? '…' : t('backup.withPhotos')}
        </button>
        <span className="text-center text-[12px] text-muted">
          {stats ? t('backup.withPhotosNote').replace('{n}', String(stats.count)).replace('{mb}', mb(withPhotosBytes)) : '\u00a0'}
        </span>
      </Row>
      <Row className="flex-col items-stretch gap-1">
        <button
          onClick={() => handleBackup(false)}
          disabled={!!busy}
          className="w-full min-h-[44px] rounded-lg border border-running text-[16px] font-semibold text-running disabled:opacity-50"
        >
          {busy === 'text' ? '…' : t('backup.noPhotos')}
        </button>
        <span className="text-center text-[12px] text-muted">{t('backup.noPhotosNote')}</span>
      </Row>
    </Section>
  )
}

// ─── Restore section ───────────────────────────────────────────────────────────

function Restore() {
  const t = useT()
  const { language } = useSettings()
  const [counts, setCounts] = useState<BackupCounts | null>(null)
  const [pending, setPending] = useState<Record<string, unknown[]> | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ photosLost: number; merged?: MergeResult } | 'undone' | null>(null)
  const [sheet, setSheet] = useState<'restore' | 'undo' | null>(null)
  const point = useLiveQuery(async () => (await db.restorePoints.get('before-restore')) ?? null, [])
  const when = (ms: number | string) => new Date(ms).toLocaleString(language === 'th' ? 'th-TH-u-ca-gregory' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErr('')
    setCounts(null)
    setPending(null)
    setDone(null)
    try {
      const { counts, data } = await parseBackup(file)
      setCounts(counts)
      setPending(data)
    } catch (x) {
      setErr(x instanceof BackupTooNewError ? t('backup.tooNew') : t('backup.invalid'))
    }
    e.target.value = ''
  }

  async function handleMerge() {
    if (!pending) return
    setBusy(true)
    setErr('')
    try {
      await keepRestorePoint()
      const merged = await mergeBackup(pending)
      setDone({ photosLost: merged.photosLost, merged })
      setCounts(null)
      setPending(null)
    } catch {
      setErr(t('backup.restoreFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function handleRestore() {
    if (!pending) return
    setSheet(null)
    setBusy(true)
    try {
      setDone(await restoreWithUndo(pending))
      setCounts(null)
      setPending(null)
    } catch {
      setErr(t('backup.restoreFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function handleUndo() {
    setSheet(null)
    setBusy(true)
    setErr('')
    try {
      if (await undoRestore()) setDone('undone')
    } catch {
      setErr(t('backup.restoreFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title={t('backup.restore')}>
      {done && (
        <Row className="flex-col !items-start gap-0.5">
          <span className="text-[15px] font-semibold text-food">{done === 'undone' ? t('backup.undone') : t('backup.success')}</span>
          {done !== 'undone' && done.merged && (
            <span className="text-[13px] text-muted">
              {t('backup.mergedCount')
                .replace('{sessions}', String(done.merged.added.sessions))
                .replace('{runs}', String(done.merged.added.runs))
                .replace('{entries}', String(done.merged.added.foodEntries))
                .replace('{activities}', String(done.merged.added.activities))
                .replace('{body}', String(done.merged.added.bodyEntries))
                .replace('{skipped}', String(done.merged.skipped))}
            </span>
          )}
          {done !== 'undone' && done.photosLost > 0 && (
            <span className="text-[13px] text-weights">{t('backup.photosLost').replace('{n}', String(done.photosLost))}</span>
          )}
        </Row>
      )}
      <Row className="text-[14px] text-muted">{t('backup.restoreNote')}</Row>
      <Row className="text-[14px] text-muted">{t('backup.restoreModes')}</Row>
      {err && <Row className="text-[14px] text-weights">{err}</Row>}
      {counts && (
        <Row className="flex-col !items-start gap-0.5 text-[14px]">
          {counts.exportedAt && <span className="font-semibold">{t('backup.fileMade').replace('{date}', when(counts.exportedAt))}</span>}
          <span>
            {t('backup.restoreCountFull')
              .replace('{sessions}', String(counts.sessions))
              .replace('{runs}', String(counts.runs))
              .replace('{entries}', String(counts.foodEntries))
              .replace('{activities}', String(counts.activities))
              .replace('{body}', String(counts.bodyEntries))}
          </span>
          <span className="text-muted">
            {counts.photosExcluded ? t('backup.fileNoPhotos') : t('backup.filePhotos').replace('{n}', String(counts.photos))}
          </span>
        </Row>
      )}
      <Row>
        {counts ? (
          <div className="flex w-full flex-col gap-2">
            <button
              onClick={handleMerge}
              disabled={busy}
              className="min-h-[48px] w-full rounded-lg bg-running px-3 text-[16px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? '…' : t('backup.merge')}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => { setCounts(null); setPending(null) }}
                disabled={busy}
                className="min-h-[44px] flex-1 rounded-lg border border-line text-[15px] disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => setSheet('restore')}
                disabled={busy}
                className="min-h-[44px] flex-1 rounded-lg border border-weights text-[15px] font-semibold text-weights disabled:opacity-50"
              >
                {t('backup.replaceAll')}
              </button>
            </div>
          </div>
        ) : (
          <label className="flex w-full min-h-[44px] cursor-pointer items-center justify-center rounded-lg border border-line bg-surface text-[16px] font-semibold">
            {busy ? '…' : t('backup.restore')}
            <input type="file" accept=".json,application/json" className="sr-only" onChange={handleFile} disabled={busy} />
          </label>
        )}
      </Row>

      {point && (
        <Row className="flex-col items-stretch gap-2">
          <span className="text-[14px]">{t('backup.undoNote').replace('{date}', when(point.createdAt))}</span>
          <div className="flex gap-2">
            <button onClick={() => setSheet('undo')} disabled={busy} className="min-h-[44px] flex-[2] rounded-lg bg-raised text-[15px] font-semibold disabled:opacity-50">
              {t('backup.undo')}
            </button>
            <button onClick={() => void deleteRestorePoint()} disabled={busy} className="min-h-[44px] flex-1 rounded-lg border border-line text-[15px] text-muted disabled:opacity-50">
              {t('backup.undoDelete')}
            </button>
          </div>
        </Row>
      )}

      <Sheet open={sheet === 'restore'} onClose={() => setSheet(null)} title={t('backup.restoreConfirm')}>
        <p className="mb-4 text-[15px] text-muted">{t('backup.restoreKeepsCopy')}</p>
        <SheetButton tone="danger" onClick={handleRestore}>{t('backup.replaceAll')}</SheetButton>
        <SheetButton onClick={() => setSheet(null)}>{t('common.cancel')}</SheetButton>
      </Sheet>
      <Sheet open={sheet === 'undo'} onClose={() => setSheet(null)} title={t('backup.undoConfirm')}>
        <p className="mb-4 text-[15px] text-muted">{t('backup.undoConfirmNote')}</p>
        <SheetButton tone="danger" onClick={handleUndo}>{t('backup.undo')}</SheetButton>
        <SheetButton onClick={() => setSheet(null)}>{t('common.cancel')}</SheetButton>
      </Sheet>
    </Section>
  )
}

// ─── AI Export section ─────────────────────────────────────────────────────────

type Period = 'month' | '2weeks' | 'custom'
type AIFormat = 'excel' | 'json'

const ALL_AI_CATS: AICategory[] = ['weights', 'running', 'activities', 'food', 'body']

function AIExport() {
  const t = useT()
  const [period, setPeriod] = useState<Period>('month')
  const [format, setFormat] = useState<AIFormat>('excel')
  const [customFrom, setCustomFrom] = useState(localDate())
  const [customTo, setCustomTo] = useState(localDate())
  const [cats, setCats] = useState<Set<AICategory>>(new Set(ALL_AI_CATS))
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState('')

  const CAT_LABELS: Record<AICategory, string> = {
    weights: t('backup.catWeights'), running: t('backup.catRunning'),
    activities: t('backup.catActivities'), food: t('backup.catFood'), body: t('backup.catBody')
  }

  function range(): { from: string; to: string } {
    if (period === 'custom') return { from: customFrom, to: customTo }
    return aiPeriodPreset(period)
  }

  async function handleExport() {
    if (period === 'custom' && customFrom > customTo) { setErr(t('backup.invalidRange')); return }
    setBusy(true)
    setErr('')
    const { from, to } = range()
    try {
      if (format === 'excel') {
        await shareOrDownload(await createAIExcel({ from, to, categories: cats }), aiExcelFilename(from, to))
        return
      }
      const blob = await createAIExport({ from, to, categories: cats })
      const ok = await shareOrDownload(blob, aiExportFilename(from, to))
      if (!ok) {
        // Share sheet dismissed: the JSON text goes to the clipboard instead, ready to paste into a chat.
        const text = await blob.text()
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      setErr(t('error.generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title={t('backup.ai')}>
      <Row className="text-[14px] text-muted">{format === 'excel' ? t('backup.aiNoteExcel') : t('backup.aiNote')}</Row>

      {/* file type */}
      <Row className="flex-wrap gap-2">
        {(['excel', 'json'] as AIFormat[]).map((f) => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            className={`min-h-[36px] rounded-lg px-3 text-[14px] ${format === f ? 'bg-running text-white' : 'border border-line'}`}
          >
            {f === 'excel' ? 'Excel (.xlsx)' : 'JSON'}
          </button>
        ))}
      </Row>

      {/* period selector */}
      <Row className="flex-wrap gap-2">
        {(['month', '2weeks', 'custom'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`min-h-[36px] rounded-lg px-3 text-[14px] ${period === p ? 'bg-running text-white' : 'border border-line'}`}
          >
            {p === 'month' ? t('backup.thisMonth') : p === '2weeks' ? t('backup.last2Weeks') : t('backup.custom')}
          </button>
        ))}
      </Row>

      {period === 'custom' && (
        <>
          <Row className="justify-between">
            <span className="text-[14px] text-muted">{t('backup.from')}</span>
            <input type="date" value={customFrom} max={localDate()} onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-line bg-bg px-2 py-1 text-[14px]" />
          </Row>
          <Row className="justify-between">
            <span className="text-[14px] text-muted">{t('backup.to')}</span>
            <input type="date" value={customTo} max={localDate()} onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-line bg-bg px-2 py-1 text-[14px]" />
          </Row>
        </>
      )}

      {/* category checkboxes */}
      <div className="border-t border-line px-4 py-2">
        <p className="mb-2 text-[13px] text-muted">{t('backup.categories')}</p>
        <div className="flex flex-wrap gap-2">
          {ALL_AI_CATS.map((c) => (
            <button
              key={c}
              onClick={() => {
                const next = new Set(cats)
                next.has(c) ? next.delete(c) : next.add(c)
                setCats(next)
              }}
              className={`min-h-[36px] rounded-lg px-3 text-[14px] ${cats.has(c) ? 'bg-running text-white' : 'border border-line'}`}
            >
              {CAT_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      {err && <Row className="text-[14px] text-weights">{err}</Row>}

      <Row>
        <button
          onClick={handleExport}
          disabled={busy || cats.size === 0}
          className="w-full min-h-[44px] rounded-lg bg-running text-[16px] font-semibold text-white disabled:opacity-50"
        >
          {copied ? t('backup.copied') : busy ? '…' : t('backup.export')}
        </button>
      </Row>
    </Section>
  )
}

// ─── Data deletion section ─────────────────────────────────────────────────────

const ALL_DELETE_CATS: DeleteCategory[] = ['weights', 'runs', 'food', 'activities', 'body']

function ClearHistory() {
  const t = useT()
  const { language } = useSettings()
  const [cats, setCats] = useState<Set<DeleteCategory>>(new Set())
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const confirmWord = language === 'th' ? t('delete.confirmWordTh') : t('delete.confirmWordEn')
  const [deleteCounts, setDeleteCounts] = useState<DeleteCounts | null>(null)

  const CAT_LABELS: Record<DeleteCategory, string> = {
    weights: t('delete.catWeights'), runs: t('delete.catRuns'), food: t('delete.catFood'),
    activities: t('delete.catActivities'), body: t('delete.catBody')
  }

  useEffect(() => {
    if (cats.size === 0) { setDeleteCounts(null); return }
    getDeleteCounts(cats).then(setDeleteCounts).catch(() => setDeleteCounts(null))
  }, [cats])

  async function handleDelete() {
    if (!confirmWordMatches(word, confirmWord)) { setErr(t('delete.wrongWord')); return }
    setBusy(true)
    try {
      await clearHistory(cats)
      setDone(true)
    } catch {
      setErr(t('error.generic'))
    } finally {
      setBusy(false)
    }
  }

  if (done) return (
    <Section title={t('delete.clearTitle')}>
      <Row className="text-[15px] font-semibold text-food">{t('delete.done')}</Row>
    </Section>
  )

  return (
    <Section title={t('delete.clearTitle')}>
      <Row className="text-[14px] text-muted">{t('delete.clearNote')}</Row>

      <div className="border-t border-line px-4 py-2">
        <div className="flex flex-wrap gap-2">
          {ALL_DELETE_CATS.map((c) => (
            <button
              key={c}
              onClick={() => { const n = new Set(cats); n.has(c) ? n.delete(c) : n.add(c); setCats(n) }}
              className={`min-h-[36px] rounded-lg px-3 text-[14px] ${cats.has(c) ? 'bg-weights text-white' : 'border border-line'}`}
            >
              {CAT_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      {cats.size > 0 && (
        <>
          {deleteCounts && (
            <Row className="text-[14px] text-muted">
              {[
                deleteCounts.sessions > 0 && `${deleteCounts.sessions} ${t('delete.countSessions')}`,
                deleteCounts.sets > 0 && `${deleteCounts.sets} ${t('delete.countSets')}`,
                deleteCounts.runs > 0 && `${deleteCounts.runs} ${t('delete.countRuns')}`,
                deleteCounts.foodEntries > 0 && `${deleteCounts.foodEntries} ${t('delete.countFoodEntries')}`,
                deleteCounts.activities > 0 && `${deleteCounts.activities} ${t('delete.countActivities')}`,
                deleteCounts.bodyEntries > 0 && `${deleteCounts.bodyEntries} ${t('delete.countBodyEntries')}`
              ].filter(Boolean).join(' · ')}
            </Row>
          )}
          <Row>
            <Link to="/more/backup" className="text-[14px] underline text-running">{t('delete.backupFirst')}</Link>
          </Row>
          <Row>
            <span className="text-[14px] text-muted">{t('delete.typeConfirm').replace('{word}', confirmWord)}</span>
          </Row>
          <Row>
            <input
              value={word}
              onChange={(e) => { setWord(e.target.value); setErr('') }}
              className="flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-[16px]"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </Row>
          {err && <Row className="text-[14px] text-weights">{err}</Row>}
          <Row>
            <button
              onClick={handleDelete}
              disabled={busy || !confirmWordMatches(word, confirmWord)}
              className="w-full min-h-[44px] rounded-lg border border-weights text-[15px] font-semibold text-weights disabled:opacity-40"
            >
              {t('delete.proceed')}
            </button>
          </Row>
        </>
      )}
    </Section>
  )
}

function EraseEverything() {
  const t = useT()
  const { language } = useSettings()
  const nav = useNavigate()
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const confirmWord = language === 'th' ? t('delete.confirmWordTh') : t('delete.confirmWordEn')

  async function handleErase() {
    if (!confirmWordMatches(word, confirmWord)) { setErr(t('delete.wrongWord')); return }
    setBusy(true)
    try {
      await eraseEverything()
      nav('/', { replace: true })
    } catch {
      setErr(t('error.generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title={t('delete.eraseTitle')}>
      <Row className="text-[14px] text-muted">{t('delete.eraseNote')}</Row>
      <Row>
        <Link to="/more/backup" className="text-[14px] underline text-running">{t('delete.backupFirst')}</Link>
      </Row>
      <Row>
        <span className="text-[14px] text-muted">{t('delete.typeConfirm').replace('{word}', confirmWord)}</span>
      </Row>
      <Row>
        <input
          value={word}
          onChange={(e) => { setWord(e.target.value); setErr('') }}
          className="flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-[16px]"
          autoCapitalize="none"
          autoCorrect="off"
        />
      </Row>
      {err && <Row className="text-[14px] text-weights">{err}</Row>}
      <Row>
        <button
          onClick={handleErase}
          disabled={busy || !confirmWordMatches(word, confirmWord)}
          className="w-full min-h-[44px] rounded-lg bg-weights text-[15px] font-semibold text-white disabled:opacity-40"
        >
          {t('delete.proceed')}
        </button>
      </Row>
    </Section>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function BackupPage() {
  const t = useT()
  return (
    <Page title={t('backup.title')} back="/more">
      <FullBackup />
      <Restore />
      <AIExport />

      <h2 className="mb-2 text-[15px] font-semibold text-weights">{t('delete.title')}</h2>
      <ClearHistory />
      <EraseEverything />
    </Page>
  )
}
