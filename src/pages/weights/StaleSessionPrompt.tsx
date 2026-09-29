import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Sheet, SheetButton } from '../../components/Sheet'
import { getOpenSession } from '../../db/sessions'
import { useT } from '../../i18n/useT'
import { localDate } from '../../lib/dates'
import { sessionTitle } from '../../lib/sessionTitle'
import { FinishFlow } from './FinishFlow'

// Sessions the owner chose to keep going with; asked once per app run.
const keptOpen = new Set<number>()

/** On launch (and on return to the app), asks what to do with a session still open from an earlier day. */
export function StaleSessionPrompt() {
  const t = useT()
  const navigate = useNavigate()
  const [today, setToday] = useState(localDate())
  const [finishing, setFinishing] = useState(false)
  const [, rerender] = useState(0)
  const open = useLiveQuery(getOpenSession, [])

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') setToday(localDate()) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const stale = open && open.date < today && !keptOpen.has(open.id!)
  if (!stale && !finishing) return null

  return (
    <>
      <Sheet open={!!stale && !finishing} onClose={() => { keptOpen.add(open!.id!); rerender((n) => n + 1) }} title={t('stale.title')}>
        <p className="mb-4 text-[15px] text-muted">
          {t('stale.body').replace('{date}', open?.date ?? '').replace('{name}', open ? sessionTitle(open, t) : '')}
        </p>
        <SheetButton tone="primary" onClick={() => setFinishing(true)}>{t('session.finish')}</SheetButton>
        <SheetButton onClick={() => { keptOpen.add(open!.id!); navigate('/weights/session') }}>{t('stale.continue')}</SheetButton>
      </Sheet>
      <FinishFlow
        sessionId={open?.id}
        active={finishing}
        onCancel={() => setFinishing(false)}
        onDone={() => setFinishing(false)}
      />
    </>
  )
}
