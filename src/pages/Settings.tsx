import { useEffect, useState } from 'react'
import { Page, Row, Section } from '../components/Page'
import { Volume2 } from 'lucide-react'
import { Segmented } from '../components/Segmented'
import { audioState, previewRestDone } from '../lib/sound'
import { parseGoal } from '../lib/kcalGoal'
import { Switch } from '../components/Switch'
import { canVibrate } from '../lib/vibrate'
import { updateSettings } from '../db/db'
import { useSettings } from '../db/useSettings'
import type { Lang, WeightUnit } from '../db/types'
import { useT } from '../i18n/useT'
import { checkPersistence, isStandalone, requestPersistence, storageUsageMB, type PersistState } from '../lib/storage'

const REST_OPTIONS = [60, 90, 120, 150, 180, 240]

export function SettingsPage() {
  const t = useT()
  const settings = useSettings()
  const [persist, setPersist] = useState<PersistState>()
  const [usedMB, setUsedMB] = useState<number>()
  const [soundResult, setSoundResult] = useState('')
  const [kcalError, setKcalError] = useState(false)

  const testSound = async () => {
    setSoundResult('')
    const played = await previewRestDone()
    setSoundResult(played ? t('settings.soundOk') : t('settings.soundFail').replace('{state}', audioState()))
  }

  /** Saves the calorie floor or ceiling; a ceiling at or below the floor is refused. */
  const saveKcal = (field: 'kcal' | 'kcalMax', text: string) => {
    const goals = { ...settings.goals, [field]: parseGoal(text) }
    if (goals.kcal && goals.kcalMax && goals.kcalMax <= goals.kcal) { setKcalError(true); return }
    setKcalError(false)
    void updateSettings({ goals })
  }

  useEffect(() => {
    checkPersistence().then(setPersist)
    storageUsageMB().then(setUsedMB)
  }, [])

  const persistText =
    persist === 'persisted' ? t('settings.persisted')
    : persist === 'not-persisted' ? t('settings.notPersisted')
    : t('settings.persistUnsupported')

  return (
    <Page title={t('settings.title')} back="/more">
      <Section>
        <Row className="justify-between">
          <span>{t('settings.language')}</span>
          <Segmented<Lang>
            label={t('settings.language')}
            value={settings.language}
            onChange={(language) => updateSettings({ language })}
            options={[{ value: 'th', label: 'ไทย' }, { value: 'en', label: 'EN' }]}
          />
        </Row>
        <Row className="justify-between">
          <span>{t('settings.weightUnit')}</span>
          <Segmented<WeightUnit>
            label={t('settings.weightUnit')}
            value={settings.weightUnit}
            onChange={(weightUnit) => updateSettings({ weightUnit })}
            options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]}
          />
        </Row>
        {canVibrate() && (
          <Row className="justify-between">
            <span className="flex-1">
              <span className="block">{t('settings.restVibrate')}</span>
              <span className="block text-[13px] text-muted">{t('settings.restVibrateNote')}</span>
            </span>
            <Switch checked={settings.restVibrate !== false} onChange={(restVibrate) => updateSettings({ restVibrate })} label={t('settings.restVibrate')} />
          </Row>
        )}
        <Row className="justify-between">
          <label htmlFor="rest">{t('settings.restTime')}</label>
          <select
            id="rest"
            value={settings.defaultRestSec}
            onChange={(e) => updateSettings({ defaultRestSec: Number(e.target.value) })}
            className="min-h-[44px] rounded-lg border border-line bg-bg px-3 text-[16px]"
          >
            {REST_OPTIONS.map((s) => (
              <option key={s} value={s}>{s} {t('settings.seconds')}</option>
            ))}
          </select>
        </Row>
        <Row className="justify-between">
          <span className="flex-1">
            <span className="block">{t('settings.restSound')}</span>
            <span className="block text-[13px] text-muted">{t('settings.restSoundNote')}</span>
          </span>
          <button onClick={testSound} className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full bg-weights/15 px-4 text-[15px] font-semibold text-weights">
            <Volume2 size={18} aria-hidden />
            {t('settings.restSoundTest')}
          </button>
        </Row>
        {soundResult && <Row className="text-[13px] text-muted"><span role="status">{soundResult}</span></Row>}
      </Section>
      <p className="-mt-3 mb-5 px-1 text-[13px] text-muted">{t('settings.weightUnitNote')}</p>

      <Section title={t('settings.goals')}>
        <div className="border-b border-line px-4 py-3">
          <div className="mb-2 text-[15px]">{t('settings.goalKcal')}</div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] text-muted">{t('settings.kcalMin')}</span>
              <input
                id="goalKcal"
                inputMode="numeric"
                placeholder="–"
                defaultValue={settings.goals.kcal ?? ''}
                onBlur={(e) => saveKcal('kcal', e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-line bg-bg px-3 text-[16px] text-right"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] text-muted">{t('settings.kcalMax')}</span>
              <input
                id="goalKcalMax"
                inputMode="numeric"
                placeholder="–"
                defaultValue={settings.goals.kcalMax ?? ''}
                onBlur={(e) => saveKcal('kcalMax', e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-line bg-bg px-3 text-[16px] text-right"
              />
            </label>
          </div>
          {kcalError && <p role="alert" className="mt-2 text-[13px] text-weights">{t('settings.kcalRangeError')}</p>}
        </div>
        <Row className="justify-between">
          <label htmlFor="goalProtein" className="text-[15px]">{t('settings.goalProtein')}</label>
          <input
            id="goalProtein"
            inputMode="decimal"
            defaultValue={settings.goals.proteinG ?? ''}
            onBlur={(e) => {
              const v = e.target.value ? Number(e.target.value) : undefined
              updateSettings({ goals: { ...settings.goals, proteinG: v } })
            }}
            className="w-24 rounded-lg border border-line bg-bg px-3 py-1 text-[16px] text-right"
          />
        </Row>
        <Row className="justify-between">
          <label htmlFor="goalDays" className="text-[15px]">{t('settings.goalWeeklyDays')}</label>
          <input
            id="goalDays"
            inputMode="numeric"
            defaultValue={settings.goals.weeklyDays ?? ''}
            onBlur={(e) => {
              const v = e.target.value ? Number(e.target.value) : undefined
              updateSettings({ goals: { ...settings.goals, weeklyDays: v } })
            }}
            className="w-24 rounded-lg border border-line bg-bg px-3 py-1 text-[16px] text-right"
          />
        </Row>
        <Row className="text-[13px] text-muted">{t('settings.goalOptional')}</Row>
      </Section>

      <Section title={t('settings.storage')}>
        <Row>
          <span className="flex-1 text-[15px]">{persistText}</span>
          {persist === 'not-persisted' && (
            <button
              onClick={() => requestPersistence().then(setPersist)}
              className="min-h-[36px] rounded-lg border border-line px-3 text-[14px] font-semibold"
            >
              {t('settings.requestPersist')}
            </button>
          )}
        </Row>
        {usedMB !== undefined && (
          <Row className="justify-between text-[15px]">
            <span>{t('settings.used')}</span>
            <span className="text-muted">{usedMB} MB</span>
          </Row>
        )}
      </Section>

      <Section title={t('settings.install')}>
        <Row className="text-[15px]">{isStandalone() ? t('settings.installed') : t('settings.notInstalled')}</Row>
        <Row className="justify-between text-[15px]">
          <span>{t('settings.backupDate')}</span>
          <span className="text-muted">
            {settings.lastBackupAt
              ? new Date(settings.lastBackupAt).toLocaleDateString()
              : t('settings.neverBackedUp')}
          </span>
        </Row>
      </Section>

      <p className="px-1 text-[13px] text-muted">{t('settings.version')} 0.1.0</p>
    </Page>
  )
}
