import { Link } from 'react-router-dom'
import { BarChart3, ChevronRight, Download, Footprints, Scale, Settings, Trophy, type LucideIcon } from 'lucide-react'
import { Page, Section } from '../components/Page'
import { useT } from '../i18n/useT'
import type { StringKey } from '../i18n/strings'

const items: { to: string; label: StringKey; icon: LucideIcon; tone: string }[] = [
  { to: '/more/summary', label: 'more.summary', icon: BarChart3, tone: 'bg-running/15 text-running' },
  { to: '/more/body', label: 'more.body', icon: Scale, tone: 'bg-weights/15 text-weights' },
  { to: '/more/activities', label: 'more.activities', icon: Trophy, tone: 'bg-other/15 text-other' },
  { to: '/more/shoes', label: 'more.shoes', icon: Footprints, tone: 'bg-running/15 text-running' },
  { to: '/more/backup', label: 'more.backup', icon: Download, tone: 'bg-food/15 text-food' },
  { to: '/more/settings', label: 'more.settings', icon: Settings, tone: 'bg-ink/10 text-ink' }
]

export function More() {
  const t = useT()
  return (
    <Page title={t('more.title')}>
      <Section>
        {items.map(({ to, label, icon: Icon, tone }) => (
          <Link key={to} to={to} className="flex min-h-[60px] items-center gap-3 border-b border-line px-4 last:border-b-0">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon size={20} aria-hidden /></span>
            <span className="flex-1 text-[16px] font-semibold">{t(label)}</span>
            <ChevronRight size={18} className="text-muted" aria-hidden />
          </Link>
        ))}
      </Section>
    </Page>
  )
}
