import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { MoreVertical, Plus } from 'lucide-react'
import { Page } from '../components/Page'
import { Sheet, SheetButton, NameSheet } from '../components/Sheet'
import { addShoe, deleteShoe, listRuns, listShoes, renameShoe, setShoeRetired, shoeInUse } from '../db/runs'
import type { Shoe } from '../db/types'
import { useT } from '../i18n/useT'
import { shoeDistanceKm } from '../lib/running'
import { round } from '../lib/units'

export function Shoes() {
  const t = useT()
  const shoes = useLiveQuery(listShoes, [])
  const runs = useLiveQuery(listRuns, [])
  const [adding, setAdding] = useState(false)
  const [menu, setMenu] = useState<Shoe | null>(null)
  const [renaming, setRenaming] = useState<Shoe | null>(null)
  const [deleting, setDeleting] = useState<{ shoe: Shoe; inUse: boolean } | null>(null)

  const openDelete = async (shoe: Shoe) => {
    setMenu(null)
    setDeleting({ shoe, inUse: await shoeInUse(shoe.id!) })
  }

  const active = shoes?.filter((s) => !s.retired) ?? []
  const retired = shoes?.filter((s) => s.retired) ?? []

  const renderShoe = (s: Shoe) => (
    <li key={s.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <span className="flex-1">
        <span className="block text-[16px]">{s.name}</span>
        <span className="block text-[13px] text-muted">
          {round(runs ? shoeDistanceKm(runs, s.id!) : 0, 1)} {t('shoe.km')}
          {s.retired ? ` · ${t('shoe.retired')}` : ''}
        </span>
      </span>
      <button onClick={() => setMenu(s)} aria-label={s.name} className="flex h-11 w-11 items-center justify-center text-muted">
        <MoreVertical size={20} aria-hidden />
      </button>
    </li>
  )

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

      <NameSheet
        open={adding}
        title={t('shoe.add')}
        saveLabel={t('common.create')}
        onSave={(name) => { addShoe(name); setAdding(false) }}
        onClose={() => setAdding(false)}
      />

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu?.name}>
        <SheetButton onClick={() => { setRenaming(menu); setMenu(null) }}>{t('shoe.rename')}</SheetButton>
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
