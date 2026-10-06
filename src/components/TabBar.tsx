import { NavLink } from 'react-router-dom'
import { Dumbbell, Footprints, House, MoreHorizontal, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import { useT } from '../i18n/useT'
import type { StringKey } from '../i18n/strings'

interface Tab { to: string; label: StringKey; icon: LucideIcon; color: string; pill: string }

// Each tab wears its category's plate colour when active.
const tabs: Tab[] = [
  { to: '/', label: 'tab.today', icon: House, color: 'text-ink', pill: 'bg-ink/10' },
  { to: '/weights', label: 'tab.weights', icon: Dumbbell, color: 'text-weights', pill: 'bg-weights/15' },
  { to: '/running', label: 'tab.running', icon: Footprints, color: 'text-running', pill: 'bg-running/15' },
  { to: '/food', label: 'tab.food', icon: UtensilsCrossed, color: 'text-food', pill: 'bg-food/15' },
  { to: '/more', label: 'tab.more', icon: MoreHorizontal, color: 'text-ink', pill: 'bg-ink/10' }
]

/** Floating tab bar. It sits just above the home indicator and never covers more than 72 px + safe area. */
export function TabBar() {
  const t = useT()
  return (
    <nav
      className="fixed inset-x-0 z-20 px-3"
      style={{ bottom: 'max(8px, calc(env(safe-area-inset-bottom, 0px) - 6px))' }}
    >
      <ul className="mx-auto grid h-16 max-w-xl grid-cols-5 rounded-[26px] border border-line bg-surface/85 px-1 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.45)] backdrop-blur-xl backdrop-saturate-150">
        {tabs.map(({ to, label, icon: Icon, color, pill }) => (
          <li key={to} className="flex">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${isActive ? `${color} font-semibold` : 'text-muted'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${isActive ? pill : ''}`}>
                    <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} aria-hidden />
                  </span>
                  <span className="leading-none">{t(label)}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
