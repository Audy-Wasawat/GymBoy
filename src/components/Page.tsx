import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useT } from '../i18n/useT'

export function Page({ title, back, children }: { title: string; back?: string; children: ReactNode }) {
  const t = useT()
  return (
    <main className="mx-auto max-w-xl px-4 pb-8" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
      <header className="mb-4 flex items-center gap-1">
        {back && (
          <Link to={back} className="-ml-2 flex h-10 w-10 items-center justify-center text-muted" aria-label={t('common.back')}>
            <ChevronLeft size={24} aria-hidden />
          </Link>
        )}
        <h1 className="text-[28px] font-semibold leading-tight">{title}</h1>
      </header>
      {children}
    </main>
  )
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      {title && <h2 className="mb-2 text-[15px] font-semibold text-muted">{title}</h2>}
      <div className="rounded-xl border border-line bg-surface">{children}</div>
    </section>
  )
}

export function Row({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex min-h-[52px] items-center gap-3 border-b border-line px-4 py-2 last:border-b-0 ${className}`}>{children}</div>
}
