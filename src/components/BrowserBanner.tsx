import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { useT } from '../i18n/useT'
import { isStandalone } from '../lib/storage'

const SESSION_KEY = 'gymboy-banner-dismissed'

export function BrowserBanner() {
  const t = useT()
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1')
  const ref = useRef<HTMLDivElement>(null)
  // Only shown when NOT in standalone mode
  const visible = !(isStandalone() || dismissed)

  // The banner is fixed, so it publishes its height: the page adds it as bottom padding and the rest
  // bar sits above it. Without that it would cover Save buttons and the rest timer.
  useLayoutEffect(() => {
    const el = ref.current
    if (!visible || !el) return
    const publish = () => document.documentElement.style.setProperty('--banner-h', `${el.offsetHeight + 8}px`)
    publish()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(publish) : undefined
    ro?.observe(el)
    return () => { ro?.disconnect(); document.documentElement.style.removeProperty('--banner-h') }
  }, [visible])

  if (!visible) return null

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, '1')
    setDismissed(true)
  }

  return (
    <div
      ref={ref}
      className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] z-30 mx-2 mb-2"
      role="banner"
    >
      <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-lg">
        <div className="flex-1">
          <p className="text-[14px] font-semibold">{t('banner.title')}</p>
          <p className="mt-0.5 text-[13px] text-muted">{t('banner.body')}</p>
          <div>
            <Link
              to="/more/backup"
              onClick={dismiss}
              className="inline-flex min-h-[44px] items-center text-[13px] font-semibold text-running underline"
            >
              {t('banner.backup')}
            </Link>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted"
          aria-label={t('banner.dismiss')}
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  )
}
