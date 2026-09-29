import { useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { useT } from '../i18n/useT'
import { isStandalone } from '../lib/storage'

const SESSION_KEY = 'gymboy-banner-dismissed'

export function BrowserBanner() {
  const t = useT()
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1')

  // Only shown when NOT in standalone mode
  if (isStandalone() || dismissed) return null

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, '1')
    setDismissed(true)
  }

  return (
    <div
      className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] z-30 mx-2 mb-2"
      role="banner"
    >
      <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-lg">
        <div className="flex-1">
          <p className="text-[14px] font-semibold">{t('banner.title')}</p>
          <p className="mt-0.5 text-[13px] text-muted">{t('banner.body')}</p>
          <div className="mt-2">
            <Link
              to="/more/backup"
              onClick={dismiss}
              className="text-[13px] font-semibold text-running underline"
            >
              {t('banner.backup')}
            </Link>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted"
          aria-label={t('banner.dismiss')}
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  )
}
