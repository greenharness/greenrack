import type {ReactNode} from 'react'
import type {SpacingToken} from '@greenharness/greenrack-tokens/keys'
import type {RowSlot} from './FieldContext'

// What the web and the React Native versions of the row helpers both provide,
// so neither can drift from the other.

export interface RowProps {
  gap?: SpacingToken
  children: ReactNode
}

export interface RowErrorProps {
  slot: RowSlot
  label?: string
  children: ReactNode
}

export interface RowSlotState<Ref> {
  /** Goes on the Field's outermost element. */
  rootRef: Ref
  /** The Field sits in a row (and not in a portal that only inherits it). */
  inRow: boolean
  /** The Field's place in the row's line while its error shows. */
  slot: RowSlot | null
  /** The control's `aria-label`, for a Field with no label text to lead its message. */
  fallbackLabel: string | undefined
}
