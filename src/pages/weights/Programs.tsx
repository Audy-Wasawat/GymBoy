import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Plus } from 'lucide-react'
import { Page, Section } from '../../components/Page'
import { NameSheet } from '../../components/Sheet'
import { db } from '../../db/db'
import { createProgram } from '../../db/programs'
import { useT } from '../../i18n/useT'

export function Programs() {
  const t = useT()
  const navigate = useNavigate()
  const programs = useLiveQuery(() => db.programs.orderBy('id').toArray(), [])
  const [naming, setNaming] = useState(false)

  return (
    <Page title={t('program.title')} back="/weights">
      {programs && programs.length === 0 && <p className="mb-4 px-1 text-[15px] text-muted">{t('program.emptyList')}</p>}
      {programs && programs.length > 0 && (
        <Section>
          {programs.map((p) => (
            <Link key={p.id} to={`/weights/programs/${p.id}`} className="flex min-h-[56px] items-center gap-3 border-b border-line px-4 last:border-b-0">
              <span className="flex-1 text-[16px]">{p.name}</span>
              {p.isActive && <span className="rounded-full bg-weights/15 px-2.5 py-0.5 text-[13px] font-semibold text-weights">{t('program.active')}</span>}
              <ChevronRight size={18} className="text-muted" aria-hidden />
            </Link>
          ))}
        </Section>
      )}
      <button onClick={() => setNaming(true)} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-[16px] font-semibold text-weights">
        <Plus size={20} aria-hidden />
        {t('program.new')}
      </button>
      <NameSheet
        open={naming}
        title={t('program.newName')}
        saveLabel={t('common.create')}
        onClose={() => setNaming(false)}
        onSave={async (name) => {
          const id = await createProgram(name)
          setNaming(false)
          navigate(`/weights/programs/${id}`)
        }}
      />
    </Page>
  )
}
