import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { MoreVertical, Plus } from 'lucide-react'
import { Page } from '../components/Page'
import { Sheet, SheetButton, NameSheet } from '../components/Sheet'
import { addShoe, deleteShoe, listRuns, listShoes, renameShoe, setShoeRetired, setShoeStartKm, shoeInUse } from '../db/runs'
import type { Shoe } from '../db/types'
import { useT } from '../i18n/useT'
import { parseStartKm, shoeTotals } from '../lib/running'

export function Shoes() {
  const t = useT()
  const shoes = useLiveQuery(listShoes, [])
  const runs = useLiveQuery(listRuns, [])
  const [adding, setAdding] = useState(false)
  const [menu, setMenu] = useState<Shoe | null>(null)
  const [renaming, setRenaming] = useState<Shoe | null>(null)
  const [editingStart, setEditingStart] = useState<Shoe | null>(null)
  const [deleting, setDeleting] = useState<{ shoe: Shoe; inUse: boolean } | null>(null)

  const openDelete = async (shoe: Shoe) => {
    setMenu(null)
    setDeleting({ shoe, inUse: await shoeInUse(shoe.id!) })
  }

  const active = shoes?.filter((s) => !s.retired) ?? []
  const retired = shoes?.filter((s) => s.retired) ?? []

  const renderShoe = (s: Shoe) => {
    const { startKm, inAppKm, totalKm } = shoeTotals(s, runs ?? [])
    return (
    <li key={s.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <span className="flex-1">
        <span className="block text-[16px]">{s.name}</span>
        <span className="block text-[13px] text-muted">
          {t('shoe.total').replace('{km}', String(totalKm))}
          {s.retired ? ` · ${t('shoe.retired')}` : ''}
        </span>
        {startKm > 0 && (
          <span className="block text-[13px] text-muted">
            {t('shoe.split').replace('{before}', String(startKm)).replace('{inApp}', String(inAppKm))}
          </span>
        )}
      </span>
      <button onClick={() => setMenu(s)} aria-label={s.name} className="flex h-11 w-11 items-center justify-center text-muted">
        <MoreVertical size={20} aria-hidden />
      </button>
    </li>
    )
  }

  return (
    <Page title={t('shoe.title')} back="/more">
      <button onClick={() => setAdding(true)} className="mb-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-running text-[16px] font-semibold text-white">
        <Plus size={20} aria-hidden />
        {t('shoe.add')}
      </button>

      {shoes && shoes.length === 0 && <p className="px-1 text-[15px] text-muted">{t('shoe.empty')}</p>}

      {active.length > 0 && (
        <>
          <h2 className="mb-2 text-[15px] font-semibold text-muted">{t('shoe.active')}</h2>
          <ul className="mb-5 rounded-xl border border-line bg-surface">{active.map(renderShoe)}</ul>
        </>
      )}
      {retired.length > 0 && (
        <>
          <h2 className="mb-2 text-[15px] font-semibold text-muted">{t('shoe.retired')}</h2>
          <ul className="rounded-xl border border-line bg-surface">{retired.map(renderShoe)}</ul>
        </>
      )}

      <ShoeSheet
        open={adding}
        title={t('shoe.add')}
        saveLabel={t('common.create')}
        withName
        onSave={(name, km) => { void addShoe(name, km); setAdding(false) }}
        onClose={() => setAdding(false)}
      />
      <ShoeSheet
        open={!!editingStart}
        title={t('shoe.editStart')}
        saveLabel={t('common.save')}
        initialKm={editingStart?.startKm}
        onSave={(_name, km) => { if (editingStart?.id) void setShoeStartKm(editingStart.id, km); setEditingStart(null) }}
        onClose={() => setEditingStart(null)}
      />

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu?.name}>
        <SheetButton onClick={() => { setRenaming(menu); setMenu(null) }}>{t('shoe.rename')}</SheetButton>
        <SheetButton onClick={() => { setEditingStart(menu); setMenu(null) }}>{t('shoe.editStart')}</SheetButton>
        {menu?.retired ? (
          <SheetButton onClick={() => { if (menu?.id) setShoeRetired(menu.id, false); setMenu(null) }}>{t('shoe.unretire')}</SheetButton>
        ) : (
          <SheetButton onClick={() => { if (menu?.id) setShoeRetired(menu.id, true); setMenu(null) }}>{t('shoe.retire')}</SheetButton>
        )}
        <SheetButton onClick={() => menu && openDelete(menu)} tone="danger">{t('shoe.delete')}</SheetButton>
      </Sheet>

      <NameSheet
        open={!!renaming}
        title={t('shoe.rename')}
        initial={renaming?.name ?? ''}
        saveLabel={t('common.save')}
        onSave={(name) => { if (renaming?.id) renameShoe(renaming.id, name); setRenaming(null) }}
        onClose={() => setRenaming(null)}
      />

      <Sheet open={!!deleting} onClose={() => setDeleting(null)} title={t('shoe.deleteConfirm')}>
        {deleting?.inUse ? (
          <>
            <p className="mb-3 text-[15px] text-muted">{t('shoe.inUseNote')}</p>
            <SheetButton onClick={() => { if (deleting?.shoe.id) setShoeRetired(deleting.shoe.id, true); setDeleting(null) }}>{t('shoe.retire')}</SheetButton>
            <SheetButton onClick={() => setDeleting(null)}>{t('common.cancel')}</SheetButton>
          </>
        ) : (
          <>
            <SheetButton onClick={() => { if (deleting?.shoe.id) deleteShoe(deleting.shoe.id); setDeleting(null) }} tone="danger">{t('shoe.delete')}</SheetButton>
            <SheetButton onClick={() => setDeleting(null)}>{t('common.cancel')}</SheetButton>
          </>
        )}
      </Sheet>
    </Page>
  )
}

/** Sheet for a pair's name (new pairs only) and the optional distance already run before the app. */
function ShoeSheet({ open, title, saveLabel, withName, initialKm, onSave, onClose }: {
  open: boolean; title: string; saveLabel: string; withName?: boolean; initialKm?: number
  onSave: (name: string, startKm: number) => void; onClose: () => void
}) {
  const t = useT()
  const [name, setName] = useState('')
  const [km, setKm] = useState('')
  const [error, setError] = useState(false)
  useEffect(() => {
    if (open) { setName(''); setKm(initialKm ? String(initialKm) : ''); setError(false) }
  }, [open, initialKm])
  const submit = () => {
    const parsed = parseStartKm(km)
    if (parsed === undefined) { setError(true); return }
    if (withName && !name.trim()) return
    onSave(name.trim(), parsed)
  }
  const input = 'mb-3 min-h-[48px] w-full rounded-lg border border-line bg-bg px-3 text-[16px]'
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <form onSubmit={(e) => { e.preventDefault(); submit() }}>
        {withName && (
          <label className="block">
            <span className="mb-1 block text-[13px] text-muted">{t('shoe.name')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="off" className={input} />
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-[13px] text-muted">{t('shoe.startKm')}</span>
          <input
            value={km}
            onChange={(e) => { setKm(e.target.value); setError(false) }}
            inputMode="decimal"
            placeholder="0"
            autoFocus={!withName}
            className={`${input} ${error ? 'border-weights' : ''}`}
          />
        </label>
        {error && <p role="alert" className="-mt-2 mb-3 text-[14px] text-weights">{t('shoe.startInvalid')}</p>}
        <button
          type="submit"
          disabled={withName && !name.trim()}
          className="min-h-[52px] w-full rounded-xl bg-running text-[16px] font-semibold text-white disabled:opacity-40"
        >
          {saveLabel}
        </button>
      </form>
    </Sheet>
  )
}
