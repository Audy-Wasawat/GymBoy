import { describe, expect, it } from 'vitest'
import { ExercisePicker, PickerBody } from './ExercisePicker'
import { initialPickerState, pickerReducer, type PickerState } from './pickerState'

const noop = () => {}

describe('exercise picker starts clean when reopened (B1)', () => {
  it('a closed picker renders nothing, so no state can survive between openings', () => {
    expect(ExercisePicker({ open: false, onPick: noop, onClose: noop })).toBeNull()
  })

  it('an open picker is a freshly mounted body each time it is opened', () => {
    const first = ExercisePicker({ open: true, onPick: noop, onClose: noop })
    // Between the two openings the picker rendered null, which unmounts the body and its state.
    const closed = ExercisePicker({ open: false, onPick: noop, onClose: noop })
    const second = ExercisePicker({ open: true, onPick: noop, onClose: noop })
    expect(closed).toBeNull()
    expect(first && (first as { type: unknown }).type).toBe(PickerBody)
    expect(second && (second as { type: unknown }).type).toBe(PickerBody)
  })

  it('the state a picker starts with has no search text and no filters', () => {
    expect(initialPickerState).toEqual({ q: '', part: '', equip: '' })
  })

  it('reset clears the search text and both filters', () => {
    let s: PickerState = initialPickerState
    s = pickerReducer(s, { type: 'query', q: 'cable crunch' })
    s = pickerReducer(s, { type: 'part', part: 'core' })
    s = pickerReducer(s, { type: 'equip', equip: 'cable' })
    expect(s).toEqual({ q: 'cable crunch', part: 'core', equip: 'cable' })
    expect(pickerReducer(s, { type: 'reset' })).toEqual({ q: '', part: '', equip: '' })
  })
})
