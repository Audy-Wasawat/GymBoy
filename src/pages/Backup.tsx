import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Page, Row, Section } from '../components/Page'
import { Sheet, SheetButton } from '../components/Sheet'
import { updateSettings } from '../db/db'
import { useSettings } from '../db/useSettings'
import { useT } from '../i18n/useT'
import {
  aiExportFilename, aiPeriodPreset, backupFilename, clearHistory, createAIExport,
  createBackup, eraseEverything, getDeleteCounts, parseBackup, restoreBackup, shareOrDownload,
  type AICategory, type BackupCounts, type DeleteCategory, type DeleteCounts
} from '../lib/backup'
import { localDate } from '../lib/dates'

// ─── Backup section ────────────────────────────────────────────────────────────

function FullBackup() {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function handleBackup() {
    setBusy(true)
    setErr('')
    try {
      const blob = await createBackup()
      const ok = await shareOrDownload(blob, backupFilename())
      if (ok) await updateSettings({ lastBackupAt: Date.now() })
    } catch (e) {
      setErr(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title={t('backup.full')}>
      <Row className="text-[14px] text-muted">{t('backup.fullNote')}</Row>
      {err && <Row className="text-[14px] text-weights">{err}</Row>}
      <Row>
        <button
          onClick={handleBackup}
          disabled={busy}
          className="w-full min-h-[44px] rounded-lg bg-running text-[16px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? '…' : t('backup.full')}
        </button>
      </Row>
    </Section>
  )
}

// ─── Restore section ───────────────────────────────────────────────────────────

function Restore() {
  const t = useT()
  const [counts, setCounts] = useState<BackupCounts | null>(null)
  const [pending, setPending] = useState<Record<string, unknown[]> | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [restoreSheet, setRestoreSheet] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErr('')
    setCounts(null)
    setPending(null)
    try {
      const { counts, data } = await parseBackup(file)
      setCounts(counts)
      setPending(data)
    } catch {
      setErr(t('backup.invalid'))
    }
    e.target.value = ''
  }

  async function handleRestore() {
    if (!pending) return
    setRestoreSheet(false)
    setBusy(true)
    try {
      await restoreBackup(pending)
      setDone(true)
    } catch (e) {
      setErr(String(e))
    } finally {
      setBusy(false)
    }
  }

  if (done) return (
    <Section title={t('backup.restore')}>
      <Row className="text-[15px] font-semibold text-food">{t('backup.success')}</Row>
    </Section>
  )

  return (
    <Section title={t('backup.restore')}>
      <Row className="text-[14px] text-muted">{t('backup.restoreNote')}</Row>
      <Row className="text-[14px] text-muted">{t('backup.restoreWarning')}</Row>
      {err && <Row className="text-[14px] text-weights">{err}</Row>}
      {counts && (
        <Row className="text-[14px]">
          {t('backup.restoreCount')
            .replace('{sessions}', String(counts.sessions))
            .replace('{runs}', String(counts.runs))
            .replace('{entries}', String(counts.foodEntries))}
        </Row>
      )}
      <Row>
        {counts ? (
          <>
            <button
              onClick={() => setRestoreSheet(true)}
              disabled={busy}
              className="w-full min-h-[44px] rounded-lg bg-weights text-[16px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? '…' : t('backup.restore')}
            </button>
            <Sheet open={restoreSheet} onClose={() => setRestoreSheet(false)} title={t('backup.restoreConfirm')}>
              <SheetButton tone="danger" onClick={handleRestore}>{t('backup.restore')}</SheetButton>
              <SheetButton onClick={() => setRestoreSheet(false)}>{t('common.cancel')}</SheetButton>
            </Sheet>
          </>
        ) : (
          <label className="flex w-full min-h-[44px] cursor-pointer items-center justify-center rounded-lg border border-line bg-surface text-[16px] font-semibold">
            {t('backup.restore')}
            <input type="file" accept=".json,application/json" className="sr-only" onChange={handleFile} />
          </label>
        )}
      </Row>
    </Section>
  )
}

// ─── AI Export section ─────────────────────────────────────────────────────────

type Period = 'month' | '2weeks' | 'custom'

const ALL_AI_CATS: AICategory[] = ['weights', 'running', 'activities', 'food', 'body']

function AIExport() {
  const t = useT()
  const [period, setPeriod] = useState<Period>('month')
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
      const blob = await createAIExport({ from, to, categories: cats })
      const ok = await shareOrDownload(blob, aiExportFilename(from, to))
      if (!ok) {
        // Fallback: copy to clipboard
        const text = await blob.text()
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch (e) {
      setErr(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title={t('backup.ai')}>
      <Row className="text-[14px] text-muted">{t('backup.aiNote')}</Row>

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
    if (word !== confirmWord) { setErr(t('delete.wrongWord')); return }
    setBusy(true)
    try {
      await clearHistory(cats)
      setDone(true)
    } catch (e) {
      setErr(String(e))
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
              disabled={busy || word !== confirmWord}
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
    if (word !== confirmWord) { setErr(t('delete.wrongWord')); return }
    setBusy(true)
    try {
      await eraseEverything()
      nav('/', { replace: true })
    } catch (e) {
      setErr(String(e))
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
          disabled={busy || word !== confirmWord}
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
