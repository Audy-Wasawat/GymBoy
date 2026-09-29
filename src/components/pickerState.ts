import type { Equipment } from '../db/types'
import type { LibraryGroup } from '../lib/exercises'

/** Search text and filters of the exercise picker. A picker always starts from `initialPickerState`. */
export interface PickerState { q: string; part: LibraryGroup | ''; equip: Equipment | '' }

export const initialPickerState: PickerState = { q: '', part: '', equip: '' }

export type PickerAction =
  | { type: 'query'; q: string }
  | { type: 'part'; part: LibraryGroup | '' }
  | { type: 'equip'; equip: Equipment | '' }
  | { type: 'reset' }

export function pickerReducer(state: PickerState, action: PickerAction): PickerState {
  switch (action.type) {
    case 'query': return { ...state, q: action.q }
    case 'part': return { ...state, part: action.part }
    case 'equip': return { ...state, equip: action.equip }
    case 'reset': return initialPickerState
  }
}
