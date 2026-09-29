import { TrendingUp } from 'lucide-react'
import type { WeightUnit } from '../../db/types'
import { useT } from '../../i18n/useT'
import type { WeightHint } from '../../lib/progress'
import { toDisplayWeight } from '../../lib/units'

/** "Last time you hit 8 on every set at 60 kg. Try adding weight." Informs only. */
export function HintNote({ hint, unit }: { hint: WeightHint; unit: WeightUnit }) {
  const t = useT()
  const top = `${hint.top} ${hint.timed ? t('set.sec') : t('set.reps')}`
  const text = hint.weightKg !== undefined
    ? t('hint.withWeight').replace('{top}', top).replace('{w}', `${toDisplayWeight(hint.weightKg, unit)} ${unit}`)
    : t('hint.noWeight').replace('{top}', top)
  return (
    <p className="mt-1 flex items-start gap-1.5 rounded-lg bg-weights/10 px-2.5 py-1.5 text-[13px] text-weights">
      <TrendingUp size={15} className="mt-0.5 shrink-0" aria-hidden />
      <span>{text}</span>
    </p>
  )
}
