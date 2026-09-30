import { useMemo, useReducer, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Search, X } from 'lucide-react'
import { db } from '../db/db'
import { createExercise } from '../db/exercises'
import type { Exercise } from '../db/types'
import { useT } from '../i18n/useT'
import { BODY_PARTS, EQUIPMENT, groupOf, type LibraryGroup } from '../lib/exercises'
import { searchExercises } from '../lib/exerciseSearch'
import { ExerciseForm } from '../pages/weights/ExerciseForm'
import { Chip } from './Chip'
import { Dialog } from './Dialog'
import { initialPickerState, pickerReducer } from './pickerState'

const GROUPS: LibraryGroup[] = [...BODY_PARTS, 'mine']

/**
 * Full-screen list for choosing one exercise from the library. The list is mounted only while it
 * is open, so search text and filters always start clean when it is opened again.
 */
export function ExercisePicker({ open, onPick, onClose }: {
  open: boolean; onPick: (ex: Exercise) => void; onClose: () => void
}) {
  if (!open) return null
  return <PickerBody onPick={onPick} onClose={onClose} />
}

export function PickerBody({ onPick, onClose }: { onPick: (ex: Exercise) => void; onClose: () => void }) {
  const t = useT()
  const [{ q, part, equip }, dispatch] = useReducer(pickerReducer, initialPickerState)
  const [creating, setCreating] = useState(false)
  const all = useLiveQuery(() => db.exercises.toArray(), [])
  // The 10 exercises most recently added to a session, newest first.
  const recent = useLiveQuery(async () => {
    const ids: number[] = []
    await db.sessionExercises.reverse().until(() => ids.length >= 10).each((se) => {
      if (!ids.includes(se.exerciseId)) ids.push(se.exerciseId)
    })
    return (await db.exercises.bulkGet(ids)).filter((e): e is Exercise => !!e)
  }, [])

  const shown = useMemo(
    () => searchExercises(all ?? [], q).filter((e) => (!part || groupOf(e) === part) && (!equip || e.equipment === equip)),
    [all, q, part, equip]
  )
  const searching = q.trim() !== ''
  const showRecent = !searching && !part && !equip && !!recent?.length
  const noResults = !!all && shown.length === 0
  const showCreate = searching || noResults

  // A pick clears the search and filters too, in case the parent keeps the picker mounted.
  const pick = (ex: Exercise) => { dispatch({ type: 'reset' }); onPick(ex) }

  return (
    <Dialog label={t('pick.title')} onClose={onClose}>
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
            onChange={(e) => dispatch({ type: 'query', q: e.target.value })}
            placeholder={t('lib.search')}
            aria-label={t('lib.search')}
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none"
          />
        </label>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
      <div className="mx-auto w-full max-w-xl px-4">
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Chip selected={!part} onClick={() => dispatch({ type: 'part', part: '' })}>{t('lib.allParts')}</Chip>
        {GROUPS.filter((g) => g !== 'mine' || all?.some((e) => groupOf(e) === 'mine')).map((g) => (
          <Chip key={g} selected={part === g} onClick={() => dispatch({ type: 'part', part: part === g ? '' : g })}>{t(`part.${g}`)}</Chip>
        ))}
      </div>
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Chip selected={!equip} onClick={() => dispatch({ type: 'equip', equip: '' })}>{t('lib.allEquipment')}</Chip>
        {EQUIPMENT.map((eq) => (
          <Chip key={eq} selected={equip === eq} onClick={() => dispatch({ type: 'equip', equip: equip === eq ? '' : eq })}>{t(`equip.${eq}`)}</Chip>
        ))}
      </div>
      </div>
      <ul className="mx-auto w-full max-w-xl px-4">
        {showCreate && (
          <li className="sticky top-0 z-10 border-b border-line bg-bg">
            <button onClick={() => setCreating(true)} className="flex min-h-[56px] w-full items-center gap-3 py-2 text-left text-weights">
              <Plus size={20} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold">{t('pick.create')}</span>
                {searching && <span className="block truncate text-[13px] text-muted">{q.trim()}</span>}
              </span>
            </button>
          </li>
        )}
        {noResults && <li className="py-10 text-center text-muted">{t('lib.empty')}</li>}
        {showRecent && (
          <>
            <li className="pb-1 pt-2 text-[15px] font-semibold text-muted">{t('pick.recent')}</li>
            {recent!.map((e) => <PickRow key={`r${e.id}`} e={e} onPick={pick} />)}
            <li className="pb-1 pt-4 text-[15px] font-semibold text-muted">{t('pick.all')}</li>
          </>
        )}
        {shown.map((e) => <PickRow key={e.id} e={e} onPick={pick} />)}
      </ul>
      </div>

      {creating && (
        <Dialog label={t('ex.newTitle')} onClose={() => setCreating(false)}>
          <div className="mx-auto flex w-full max-w-xl items-center gap-2 px-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
            <h2 className="flex-1 text-[22px] font-semibold">{t('ex.newTitle')}</h2>
            <button onClick={() => setCreating(false)} aria-label={t('common.close')} className="flex h-11 w-11 items-center justify-center text-muted">
              <X size={24} aria-hidden />
            </button>
          </div>
          <div className="mx-auto mt-3 w-full max-w-xl flex-1 overflow-y-auto px-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
            <ExerciseForm
              initialName={q.trim()}
              saveLabel={t('pick.createAndPick')}
              onSave={async (values) => { const ex = await createExercise(values); setCreating(false); pick(ex) }}
              onUseExisting={(ex) => { setCreating(false); pick(ex) }}
            />
          </div>
        </Dialog>
      )}
    </Dialog>
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
