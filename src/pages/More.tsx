import { Link } from 'react-router-dom'
import { BarChart3, ChevronRight, Download, Footprints, Scale, Settings, Trophy, type LucideIcon } from 'lucide-react'
import { Page, Section } from '../components/Page'
import { useT } from '../i18n/useT'
import type { StringKey } from '../i18n/strings'

const items: { to: string; label: StringKey; icon: LucideIcon }[] = [
  { to: '/more/summary', label: 'more.summary', icon: BarChart3 },
  { to: '/more/body', label: 'more.body', icon: Scale },
  { to: '/more/activities', label: 'more.activities', icon: Trophy },
  { to: '/more/shoes', label: 'more.shoes', icon: Footprints },
  { to: '/more/backup', label: 'more.backup', icon: Download },
  { to: '/more/settings', label: 'more.settings', icon: Settings }
]

export function More() {
  const t = useT()
  return (
    <Page title={t('more.title')}>
      <Section>
        {items.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex min-h-[52px] items-center gap-3 border-b border-line px-4 last:border-b-0">
            <Icon size={20} className="text-muted" aria-hidden />
            <span className="flex-1 text-[16px]">{t(label)}</span>
            <ChevronRight size={18} className="text-muted" aria-hidden />
          </Link>
        ))}
      </Section>
    </Page>
  )
}
