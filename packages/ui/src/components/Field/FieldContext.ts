import {createContext, useContext, useEffect, useRef} from 'react'
import type {LabelPosition, NecessityIndicator} from '../Form/FormContext'

/** Where a Field's own error line sits: `'below'` is in the Field's flow; `'hanging'` is out of it, under the control, so the Field keeps the height of its label and control and a row of Fields stays aligned on its inputs. */
export type ErrorPlacement = 'below' | 'hanging'

interface FieldContextValue {
  controlId: string
  /** id of the Field.Label — what a GROUP control points `aria-labelledby` at. */
  labelId: string
  /** The control is a group (ToggleGroup, CheckboxGroup, RadioGroup, a set of
   *  checkboxes): the label names the group instead of pointing `for` at one
   *  input, which a group is not. */
  group?: boolean
  descriptionId: string
  errorId: string
  invalid: boolean
  required?: boolean
  disabled?: boolean
  labelPosition?: LabelPosition
  errorPlacement?: ErrorPlacement
  necessityIndicator?: NecessityIndicator
  field?: {
    value: unknown
    onChange: (...event: unknown[]) => void
    onBlur: () => void
    ref: React.RefCallback<unknown>
    name: string
  }
  errorMessage?: string
  /** The control's own `validationMessage`, reported by the DOM `invalid` event. */
  nativeError?: string
  setNativeError?: (message: string | undefined) => void
  /** A mounted Field.Error registers here; the returned function unregisters it. */
  registerError?: () => () => void
  /** A mounted Field.Description registers here; the returned function unregisters it. */
  registerDescription?: () => () => void
  /** The mounted Field.Label's text (its necessity suffix included), for a
   *  control that names itself by a string: a native one, where `for` and
   *  `aria-labelledby` do not reach the label. Undefined with no label text. */
  labelText?: string
  /** A mounted Field.Label registers its text here; the returned function unregisters it. */
  registerLabel?: (text: string) => () => void
  /** What the control's `aria-describedby` names: the description id while a
   *  Field.Description is mounted, the error id while an error line is
   *  showing. Undefined when neither is, so no IDREF dangles. */
  describedBy?: string
}

export type {FieldContextValue}

export const FieldContext = createContext<FieldContextValue | null>(null)

export function useFieldContext() {
  return useContext(FieldContext)
}

interface NativeValidityTarget {
  value: string
  willValidate: boolean
  validationMessage: string
  validity: {valid: boolean}
  form?: {
    addEventListener: (type: 'reset', listener: () => void) => void
    removeEventListener: (type: 'reset', listener: () => void) => void
  } | null
}

/** The shown message is still the browser's current one for this control. */
function stillShowing(element: NativeValidityTarget, shownMessage: string | undefined): boolean {
  return (
    element.willValidate && !element.validity.valid && element.validationMessage === shownMessage
  )
}

/** Wires a text control to its Field's native validation message: the DOM
 *  `invalid` event creates it (nothing else does), and it is only ever
 *  cleared, never rewritten in place: a rewrite would re-announce the
 *  `role="alert"` line on each keystroke. It clears once it stops being the
 *  browser's current message (the value is valid, the reason changed, a
 *  constraint went), when the value changes without input (controlled state, a
 *  form library's reset) and on the owning form's reset; the next submit shows
 *  the new reason. The browser's own bubble is left alone. Outside a Field both
 *  handlers are undefined.
 *  Structural types: the native build (no DOM lib) types this too. */
export function useNativeValidation() {
  const ctx = useFieldContext()
  const setNativeError = ctx?.setNativeError
  const nativeError = ctx?.nativeError
  const shown = nativeError !== undefined
  const control = useRef<NativeValidityTarget | null>(null)
  const recordedValue = useRef('')

  // No dependency array on purpose: a constraint or value can change in any commit.
  useEffect(() => {
    if (!shown) {
      control.current = null
      return
    }
    const element = control.current
    if (!element || !setNativeError) return
    if (element.value !== recordedValue.current || !stillShowing(element, nativeError)) {
      recordedValue.current = element.value
      setNativeError(undefined)
    }
  })

  useEffect(() => {
    const form = control.current?.form
    if (!shown || !form || !setNativeError) return
    const clear = () => setNativeError(undefined)
    form.addEventListener('reset', clear)
    return () => form.removeEventListener('reset', clear)
  }, [shown, setNativeError])

  if (!setNativeError) return {onInvalid: undefined, afterChange: undefined}
  return {
    onInvalid: (event: {currentTarget: object}) => {
      // Native DOM typings lack the validity members on the element type.
      const target = event.currentTarget as NativeValidityTarget
      control.current = target
      recordedValue.current = target.value
      setNativeError(target.validationMessage)
    },
    afterChange: shown
      ? (event: {currentTarget: object}) => {
          const target = event.currentTarget as NativeValidityTarget
          control.current = target
          recordedValue.current = target.value
          if (!stillShowing(target, nativeError)) setNativeError(undefined)
        }
      : undefined,
  }
}

interface GroupLabelling {
  'aria-label'?: string
  'aria-labelledby'?: string
}

/** The accessible-name wiring for a group control: its own `aria-label` /
 *  `aria-labelledby` when given, else the enclosing Field's label and its
 *  description / error. Outside a Field with neither, the group is unnamed —
 *  pass one. */
export function useFieldGroupLabelling(own: GroupLabelling) {
  const ctx = useFieldContext()
  return {
    'aria-label': own['aria-label'],
    'aria-labelledby': own['aria-labelledby'] ?? (own['aria-label'] ? undefined : ctx?.labelId),
    'aria-describedby': ctx?.describedBy,
  }
}
