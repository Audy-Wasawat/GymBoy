import { useEffect, useState } from 'react'
import { Sheet, SheetButton } from '../../components/Sheet'
import { finishPreview, finishSession } from '../../db/sessions'
import { useSettings } from '../../db/useSettings'
import { useT } from '../../i18n/useT'

type Preview = Awaited<ReturnType<typeof finishPreview>>
type Step =
  | { kind: 'drafts'; p: Preview }
  | { kind: 'empty'; keepDrafts: boolean }
  | { kind: 'prune'; keepDrafts: boolean; names: string[] }

/**
 * Finishing a session never drops anything silently: rows typed but not saved are saved or
 * discarded by the owner's choice, exercises left without sets are removed only after asking,
 * and a session with no sets at all is deleted only after asking.
 */
export function FinishFlow({ sessionId, active, onCancel, onDone }: {
  sessionId?: number; active: boolean; onCancel: () => void; onDone: () => void
}) {
  const t = useT()
  const { weightUnit } = useSettings()
  const [step, setStep] = useState<Step>()

  const finish = async (keepDrafts: boolean) => {
    await finishSession(sessionId!, keepDrafts, weightUnit)
    setStep(undefined)
    onDone()
  }

  // After the drafts decision: confirm deleting an empty session, or removing empty exercises.
  const next = (p: Preview, keepDrafts: boolean) => {
    const names = keepDrafts ? p.emptyIfKeep : p.emptyIfDiscard
    if (p.savedSets + (keepDrafts ? p.completeDrafts : 0) === 0) setStep({ kind: 'empty', keepDrafts })
    else if (names.length) setStep({ kind: 'prune', keepDrafts, names })
    else void finish(keepDrafts)
  }

  useEffect(() => {
    if (!active || sessionId === undefined) return
    let stale = false
    finishPreview(sessionId, weightUnit).then((p) => {
      if (stale) return
      if (p.typedDrafts > 0) setStep({ kind: 'drafts', p })
      else next(p, false)
    })
    return () => { stale = true }
  }, [active, sessionId])

  const close = () => { setStep(undefined); onCancel() }

  return (
    <>
      <Sheet open={step?.kind === 'drafts'} onClose={close} title={t('finish.draftsTitle')}>
        {step?.kind === 'drafts' && (
          <>
            <p className="mb-2 text-[15px]">{t('finish.draftsBody').replace('{n}', String(step.p.typedDrafts))}</p>
            {step.p.completeDrafts < step.p.typedDrafts && (
              <p className="mb-2 text-[14px] text-muted">
                {t('finish.incomplete').replace('{n}', String(step.p.typedDrafts - step.p.completeDrafts))}
              </p>
            )}
            <div className="mt-3">
              <SheetButton tone="primary" onClick={() => next(step.p, true)}>{t('finish.save')}</SheetButton>
              <SheetButton tone="danger" onClick={() => next(step.p, false)}>{t('finish.discard')}</SheetButton>
              <SheetButton onClick={close}>{t('finish.back')}</SheetButton>
            </div>
          </>
        )}
      </Sheet>
      <Sheet open={step?.kind === 'prune'} onClose={close} title={t('finish.pruneTitle')}>
        {step?.kind === 'prune' && (
          <>
            <p className="mb-2 text-[15px] text-muted">{t('finish.pruneBody')}</p>
            <ul className="mb-4 list-disc pl-5 text-[15px]">
              {step.names.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
            <SheetButton tone="primary" onClick={() => finish(step.keepDrafts)}>{t('session.finish')}</SheetButton>
            <SheetButton onClick={close}>{t('finish.back')}</SheetButton>
          </>
        )}
      </Sheet>
      <Sheet open={step?.kind === 'empty'} onClose={close} title={t('finish.emptyTitle')}>
        <p className="mb-4 text-[15px] text-muted">{t('finish.emptyBody')}</p>
        <SheetButton tone="danger" onClick={() => step?.kind === 'empty' && finish(step.keepDrafts)}>{t('finish.deleteSession')}</SheetButton>
        <SheetButton onClick={close}>{t('finish.back')}</SheetButton>
      </Sheet>
    </>
  )
}
