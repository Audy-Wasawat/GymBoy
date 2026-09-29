import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Plus } from 'lucide-react'
import { Page, Section } from '../../components/Page'
import { db } from '../../db/db'
import { useSettings } from '../../db/useSettings'
import { useT } from '../../i18n/useT'
import { formatDate } from '../../lib/dates'
import { sessionTitle } from '../../lib/sessionTitle'

/** Finished sessions, newest first. */
export function History() {
  const t = useT()
  const { language } = useSettings()
  const rows = useLiveQuery(async () => {
    const sessions = await db.sessions.filter((s) => !!s.finishedAt).toArray()
    sessions.sort((a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt)
    const ses = await db.sessionExercises.where('sessionId').anyOf(sessions.map((s) => s.id!)).toArray()
    const setCounts = new Map<number, number>()
    await db.sets.where('sessionExerciseId').anyOf(ses.map((se) => se.id!)).each((s) => {
      setCounts.set(s.sessionExerciseId, (setCounts.get(s.sessionExerciseId) ?? 0) + 1)
    })
    return sessions.map((s) => {
      const mine = ses.filter((se) => se.sessionId === s.id)
      return { s, exercises: mine.length, sets: mine.reduce((n, se) => n + (setCounts.get(se.id!) ?? 0), 0) }
    })
  }, [])

  return (
    <Page title={t('history.title')} back="/weights">
      <Link to="/weights/history/new" className="mb-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-[16px] font-semibold text-weights">
        <Plus size={20} aria-hidden />
        {t('history.addPast')}
      </Link>
      {rows && rows.length === 0 && <p className="px-1 text-[15px] text-muted">{t('history.empty')}</p>}
      {rows && rows.length > 0 && (
        <Section>
          {rows.map(({ s, exercises, sets }) => (
            <Link key={s.id} to={`/weights/history/${s.id}`} className="flex min-h-[64px] items-center gap-3 border-b border-line px-4 py-2 last:border-b-0">
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] text-muted">{formatDate(s.date, language)}</span>
                <span className="block truncate text-[16px]">{sessionTitle(s, t)}</span>
                <span className="block text-[13px] text-muted">
                  {exercises} {t('lib.count')} · {sets} {t('history.sets')}
                </span>
              </span>
              <ChevronRight size={18} className="text-muted" aria-hidden />
            </Link>
          ))}
        </Section>
      )}
    </Page>
  )
}
