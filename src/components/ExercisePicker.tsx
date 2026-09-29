import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, X } from 'lucide-react'
import { db } from '../db/db'
import type { Equipment, Exercise } from '../db/types'
import { useT } from '../i18n/useT'
import { BODY_PARTS, EQUIPMENT, groupOf, type LibraryGroup } from '../lib/exercises'
import { Chip } from './Chip'

const GROUPS: LibraryGroup[] = [...BODY_PARTS, 'mine']

/** Full-screen list for choosing one exercise from the library. */
export function ExercisePicker({ open, onPick, onClose }: {
  open: boolean; onPick: (ex: Exercise) => void; onClose: () => void
}) {
  const t = useT()
  const [q, setQ] = useState('')
  const [part, setPart] = useState<LibraryGroup | ''>('')
  const [equip, setEquip] = useState<Equipment | ''>('')
  const all = useLiveQuery(() => (open ? db.exercises.toArray() : []), [open])
  // The 10 exercises most recently added to a session, newest first.
  const recent = useLiveQuery(async () => {
    if (!open) return []
    const ids: number[] = []
    await db.sessionExercises.reverse().until(() => ids.length >= 10).each((se) => {
      if (!ids.includes(se.exerciseId)) ids.push(se.exerciseId)
    })
    return (await db.exercises.bulkGet(ids)).filter((e): e is Exercise => !!e)
  }, [open])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (all ?? [])
      .filter((e) => (!part || groupOf(e) === part) && (!equip || e.equipment === equip))
      .filter((e) => !needle || e.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [all, q, part, equip])
  const showRecent = !q.trim() && !part && !equip && !!recent?.length

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg" role="dialog" aria-modal="true" aria-label={t('pick.title')}>
      <div className="mx-auto w-full max-w-xl px-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="flex-1 text-[22px] font-semibold">{t('pick.title')}</h2>
          <button onClick={onClose} aria-label={t('common.close')} className="flex h-11 w-11 items-center justify-center text-muted">
            <X size={24} aria-hidden />
          </button>
        </div>
        <label className="mb-3 flex min-h-[44px] items-center gap-2 rounded-lg border border-line bg-surface px-3">
          <Search size={18} className="text-muted" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('lib.search')}
            aria-label={t('lib.search')}
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none"
          />
        </label>
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <Chip selected={!part} onClick={() => setPart('')}>{t('lib.allParts')}</Chip>
          {GROUPS.filter((g) => g !== 'mine' || all?.some((e) => groupOf(e) === 'mine')).map((g) => (
            <Chip key={g} selected={part === g} onClick={() => setPart(part === g ? '' : g)}>{t(`part.${g}`)}</Chip>
          ))}
        </div>
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <Chip selected={!equip} onClick={() => setEquip('')}>{t('lib.allEquipment')}</Chip>
          {EQUIPMENT.map((eq) => (
            <Chip key={eq} selected={equip === eq} onClick={() => setEquip(equip === eq ? '' : eq)}>{t(`equip.${eq}`)}</Chip>
          ))}
        </div>
      </div>
      <ul className="mx-auto w-full max-w-xl flex-1 overflow-y-auto px-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
        {all && shown.length === 0 && <li className="py-10 text-center text-muted">{t('lib.empty')}</li>}
        {showRecent && (
          <>
            <li className="pb-1 pt-2 text-[15px] font-semibold text-muted">{t('pick.recent')}</li>
            {recent!.map((e) => <PickRow key={`r${e.id}`} e={e} onPick={onPick} />)}
            <li className="pb-1 pt-4 text-[15px] font-semibold text-muted">{t('pick.all')}</li>
          </>
        )}
        {shown.map((e) => <PickRow key={e.id} e={e} onPick={onPick} />)}
      </ul>
    </div>
  )
}

function PickRow({ e, onPick }: { e: Exercise; onPick: (ex: Exercise) => void }) {
  const t = useT()
  return (
    <li className="border-b border-line">
      <button onClick={() => onPick(e)} className="flex min-h-[56px] w-full flex-col justify-center py-2 text-left">
        <span className="text-[16px]">{e.name}</span>
        <span className="text-[13px] text-muted">
          {t(`equip.${e.equipment}`)} · {t(`part.${groupOf(e)}`)}
        </span>
      </button>
    </li>
  )
}
