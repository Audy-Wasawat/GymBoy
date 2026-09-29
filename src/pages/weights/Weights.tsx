import { Link } from 'react-router-dom'
import { ChevronRight, Library } from 'lucide-react'
import { Page, Section } from '../../components/Page'
import { useT } from '../../i18n/useT'

export function Weights() {
  const t = useT()
  return (
    <Page title={t('weights.title')}>
      <Section>
        <Link to="/weights/exercises" className="flex min-h-[60px] items-center gap-3 px-4 py-2">
          <Library size={22} className="text-weights" aria-hidden />
          <span className="flex-1">
            <span className="block text-[16px]">{t('weights.library')}</span>
            <span className="block text-[13px] text-muted">{t('weights.libraryNote')}</span>
          </span>
          <ChevronRight size={18} className="text-muted" aria-hidden />
        </Link>
      </Section>
      <p className="px-1 text-[13px] text-muted">{t('weights.more')}</p>
    </Page>
  )
}
