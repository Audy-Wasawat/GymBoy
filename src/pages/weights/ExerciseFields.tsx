import { Row, Section } from '../../components/Page'
import { Switch } from '../../components/Switch'
import type { BodyPart, Equipment } from '../../db/types'
import { useT } from '../../i18n/useT'
import { BODY_PARTS, EQUIPMENT } from '../../lib/exercises'

const input = 'min-h-[44px] rounded-lg border border-line bg-bg px-3 text-[16px]'

/** Name, equipment and body part: editable only for custom exercises. */
export function DetailFields({ name, equipment, bodyPart, onName, onNameBlur, onEquipment, onBodyPart }: {
  name: string; equipment: Equipment; bodyPart?: BodyPart
  onName: (v: string) => void; onNameBlur?: () => void
  onEquipment: (v: Equipment) => void; onBodyPart: (v: BodyPart | undefined) => void
}) {
  const t = useT()
  return (
    <Section title={t('ex.details')}>
      <Row>
        <label htmlFor="ex-name" className="w-28 shrink-0">{t('ex.name')}</label>
        <input
          id="ex-name"
          value={name}
          maxLength={80}
          onChange={(e) => onName(e.target.value)}
          onBlur={onNameBlur}
          autoComplete="off"
          className={`${input} min-w-0 flex-1`}
        />
      </Row>
      <Row>
        <label htmlFor="ex-equip" className="w-28 shrink-0">{t('ex.equipment')}</label>
        <select id="ex-equip" value={equipment} onChange={(e) => onEquipment(e.target.value as Equipment)} className={`${input} min-w-0 flex-1`}>
          {EQUIPMENT.map((eq) => <option key={eq} value={eq}>{t(`equip.${eq}`)}</option>)}
        </select>
      </Row>
      <Row>
        <label htmlFor="ex-part" className="w-28 shrink-0">{t('ex.bodyPart')}</label>
        <select
          id="ex-part"
          value={bodyPart ?? ''}
          onChange={(e) => onBodyPart((e.target.value || undefined) as BodyPart | undefined)}
          className={`${input} min-w-0 flex-1`}
        >
          <option value="">{t('ex.bodyPartNone')}</option>
          {BODY_PARTS.map((p) => <option key={p} value={p}>{t(`part.${p}`)}</option>)}
        </select>
      </Row>
    </Section>
  )
}

/** Left/right and timed switches, shown for every exercise. */
export function LoggingFields({ leftRight, timed, onLeftRight, onTimed, showNote }: {
  leftRight: boolean; timed: boolean; onLeftRight: (v: boolean) => void; onTimed: (v: boolean) => void; showNote?: boolean
}) {
  const t = useT()
  return (
    <>
      <Section title={t('ex.settings')}>
        <Row>
          <span className="flex-1">
            <span className="block">{t('ex.leftRight')}</span>
            <span className="block text-[13px] text-muted">{showNote ? t('ex.leftRightNoteNext') : t('ex.leftRightNote')}</span>
          </span>
          <Switch checked={leftRight} onChange={onLeftRight} label={t('ex.leftRight')} />
        </Row>
        <Row>
          <span className="flex-1">
            <span className="block">{t('ex.timed')}</span>
            <span className="block text-[13px] text-muted">{t('ex.timedNote')}</span>
          </span>
          <Switch checked={timed} onChange={onTimed} label={t('ex.timed')} />
        </Row>
      </Section>
      {showNote && <p className="-mt-3 mb-5 px-1 text-[13px] text-muted">{t('ex.nextSessionNote')}</p>}
    </>
  )
}
