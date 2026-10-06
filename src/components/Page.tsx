import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useT } from '../i18n/useT'

export function Page({ title, back, children }: { title: string; back?: string; children: ReactNode }) {
  const t = useT()
  return (
    <main className="mx-auto max-w-xl px-4 pb-8" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)' }}>
      <header className="mb-4 flex items-center gap-2">
        {back && (
          <Link
            to={back}
            className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink"
            aria-label={t('common.back')}
          >
            <ChevronLeft size={22} aria-hidden />
          </Link>
        )}
        <h1 className={`${back ? 'text-[24px]' : 'text-[32px]'} min-w-0 font-bold leading-tight tracking-tight`}>{title}</h1>
      </header>
      {children}
    </main>
  )
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      {title && <h2 className="eyebrow mb-2 px-1">{title}</h2>}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">{children}</div>
    </section>
  )
}

export function Row({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex min-h-[52px] items-center gap-3 border-b border-line px-4 py-2 last:border-b-0 ${className}`}>{children}</div>
}
