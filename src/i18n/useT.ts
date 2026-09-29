import { useSettings } from '../db/useSettings'
import { strings, type StringKey } from './strings'

export function useT() {
  const { language } = useSettings()
  return (key: StringKey) => strings[language][key]
}
