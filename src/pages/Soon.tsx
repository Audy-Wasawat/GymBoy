import { Hammer } from 'lucide-react'
import { Page } from '../components/Page'
import { useT } from '../i18n/useT'

export function Soon({ title, back }: { title: string; back?: string }) {
  const t = useT()
  return (
    <Page title={title} back={back}>
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-6 py-12 text-center">
        <Hammer size={28} className="text-muted" aria-hidden />
        <p className="font-semibold">{t('soon.title')}</p>
        <p className="text-[15px] text-muted">{t('soon.body')}</p>
      </div>
    </Page>
  )
}
