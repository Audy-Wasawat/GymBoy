import { NavLink } from 'react-router-dom'
import { Dumbbell, Footprints, House, MoreHorizontal, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import { useT } from '../i18n/useT'
import type { StringKey } from '../i18n/strings'

interface Tab { to: string; label: StringKey; icon: LucideIcon; color: string }

// Each tab wears its category's plate colour when active.
const tabs: Tab[] = [
  { to: '/', label: 'tab.today', icon: House, color: 'text-ink' },
  { to: '/weights', label: 'tab.weights', icon: Dumbbell, color: 'text-weights' },
  { to: '/running', label: 'tab.running', icon: Footprints, color: 'text-running' },
  { to: '/food', label: 'tab.food', icon: UtensilsCrossed, color: 'text-food' },
  { to: '/more', label: 'tab.more', icon: MoreHorizontal, color: 'text-ink' }
]

export function TabBar() {
  const t = useT()
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {tabs.map(({ to, label, icon: Icon, color }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] ${
                  isActive ? `${color} font-semibold` : 'text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      isActive ? 'ring-2 ring-current' : ''
                    }`}
                  >
                    <Icon size={18} strokeWidth={isActive ? 2.25 : 1.75} aria-hidden />
                  </span>
                  {t(label)}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
