import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Search } from 'lucide-react'
import { BodyModel } from '../../components/BodyModel'
import { Chip } from '../../components/Chip'
import { MuscleChips } from '../../components/Muscles'
import { Page } from '../../components/Page'
import { db } from '../../db/db'
import type { Equipment } from '../../db/types'
import { useT } from '../../i18n/useT'
import { BODY_PARTS, EQUIPMENT, groupOf, type LibraryGroup } from '../../lib/exercises'
import { searchExercises } from '../../lib/exerciseSearch'

const GROUPS: LibraryGroup[] = [...BODY_PARTS, 'mine']

export function ExerciseLibrary() {
  const t = useT()
  const [params, setParams] = useSearchParams()
  // Filters live in the URL so they survive opening an exercise and coming back.
  const q = params.get('q') ?? ''
  const part = (params.get('part') ?? '') as LibraryGroup | ''
  const equip = (params.get('equip') ?? '') as Equipment | ''
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const all = useLiveQuery(() => db.exercises.toArray(), [])
  const hasMine = all?.some((e) => groupOf(e) === 'mine')

  const groups = useMemo(() => {
    if (!all) return []
    // Search order (name matches first) is kept inside each group.
    const shown = searchExercises(all, q)
      .filter((e) => (!part || groupOf(e) === part) && (!equip || e.equipment === equip))
    return GROUPS.map((g) => ({ group: g, items: shown.filter((e) => groupOf(e) === g) })).filter((g) => g.items.length > 0)
  }, [all, q, part, equip])

  return (
    <Page title={t('weights.library')} back="/weights">
      <div className="mb-3 flex gap-2">
        <label className="flex min-h-[44px] flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3">
          <Search size={18} className="text-muted" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setParam('q', e.target.value)}
            placeholder={t('lib.search')}
            aria-label={t('lib.search')}
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none"
          />
        </label>
        <Link
          to="/weights/exercises/new"
          aria-label={t('lib.new')}
          className="flex h-11 w-11 items-center justify-center rounded-lg bg-weights text-white"
        >
          <Plus size={22} aria-hidden />
        </Link>
      </div>

      <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Chip selected={!part} onClick={() => setParam('part', '')}>{t('lib.allParts')}</Chip>
        {GROUPS.filter((g) => g !== 'mine' || hasMine).map((g) => (
          <Chip key={g} selected={part === g} onClick={() => setParam('part', part === g ? '' : g)}>{t(`part.${g}`)}</Chip>
        ))}
      </div>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Chip selected={!equip} onClick={() => setParam('equip', '')}>{t('lib.allEquipment')}</Chip>
        {EQUIPMENT.map((eq) => (
          <Chip key={eq} selected={equip === eq} onClick={() => setParam('equip', equip === eq ? '' : eq)}>{t(`equip.${eq}`)}</Chip>
        ))}
      </div>

      {all && groups.length === 0 && <p className="py-10 text-center text-muted">{t('lib.empty')}</p>}

      {groups.map(({ group, items }) => (
        <section key={group} className="mb-5">
          <h2 className="mb-2 flex items-baseline justify-between text-[15px] font-semibold text-muted">
            <span>{t(`part.${group}`)}</span>
            <span className="text-[13px] font-normal">{items.length} {t('lib.count')}</span>
          </h2>
          <ul className="rounded-xl border border-line bg-surface">
            {items.map((e) => (
              <li key={e.id} className="border-b border-line last:border-b-0">
                <Link to={`/weights/exercises/${e.id}`} className="flex min-h-[64px] items-center gap-3 px-3 py-2.5">
                  <BodyModel primary={e.primaryMuscles} secondary={e.secondaryMuscles} height={64} />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[16px] leading-snug">{e.name}</span>
                    <span className="text-[13px] text-muted">
                      {[t(`equip.${e.equipment}`), e.leftRight && t('ex.leftRight'), e.timed && t('ex.timed')].filter(Boolean).join(' · ')}
                    </span>
                    <MuscleChips primary={e.primaryMuscles} secondary={e.secondaryMuscles} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Page>
  )
}
