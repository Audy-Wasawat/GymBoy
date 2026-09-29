import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { MoreVertical } from 'lucide-react'
import { Page } from '../../components/Page'
import { Sheet, SheetButton, NameSheet } from '../../components/Sheet'
import { deleteTemplate, listTemplates, renameTemplate } from '../../db/runs'
import type { IntervalPlan, RunTemplate } from '../../db/types'
import { useT } from '../../i18n/useT'
import { formatDuration } from '../../lib/numbers'
import { formatPace } from '../../lib/units'

/** e.g. "6 × 800 m @ 3:40" or "6 × 2:00". */
export function planSummary(plan: IntervalPlan) {
  const per = plan.distanceM ? `${plan.distanceM} m` : plan.durationSec ? formatDuration(plan.durationSec) : ''
  const tgt = plan.targetPaceSecPerKm ? ` @ ${formatPace(plan.targetPaceSecPerKm)}` : ''
  return `${plan.reps} × ${per}${tgt}`
}

export function Templates() {
  const t = useT()
  const templates = useLiveQuery(listTemplates, [])
  const [menu, setMenu] = useState<RunTemplate | null>(null)
  const [renaming, setRenaming] = useState<RunTemplate | null>(null)
  const [deleting, setDeleting] = useState<RunTemplate | null>(null)

  return (
    <Page title={t('run.templates')} back="/running">
      {templates && templates.length === 0 && <p className="px-1 py-4 text-[15px] text-muted">{t('run.noTemplates')}</p>}
      <ul className="rounded-xl border border-line bg-surface empty:hidden">
        {templates?.map((tpl) => (
          <li key={tpl.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
            <span className="flex-1">
              <span className="block text-[16px]">{tpl.name}</span>
              <span className="block text-[13px] text-muted">{planSummary(tpl.plan)}</span>
            </span>
            <button onClick={() => setMenu(tpl)} aria-label={tpl.name} className="flex h-11 w-11 items-center justify-center text-muted">
              <MoreVertical size={20} aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu?.name}>
        <SheetButton onClick={() => { setRenaming(menu); setMenu(null) }}>{t('template.rename')}</SheetButton>
        <SheetButton onClick={() => { setDeleting(menu); setMenu(null) }} tone="danger">{t('template.delete')}</SheetButton>
      </Sheet>

      <NameSheet
        open={!!renaming}
        title={t('template.rename')}
        initial={renaming?.name ?? ''}
        saveLabel={t('common.save')}
        onSave={(name) => { if (renaming?.id) renameTemplate(renaming.id, name); setRenaming(null) }}
        onClose={() => setRenaming(null)}
      />

      <Sheet open={!!deleting} onClose={() => setDeleting(null)} title={t('template.deleteConfirm')}>
        <SheetButton onClick={() => { if (deleting?.id) deleteTemplate(deleting.id); setDeleting(null) }} tone="danger">{t('template.delete')}</SheetButton>
        <SheetButton onClick={() => setDeleting(null)}>{t('common.cancel')}</SheetButton>
      </Sheet>
    </Page>
  )
}
