import {useCallback} from 'react'
import {html} from 'react-strict-dom'
import {useControllableValue} from '../../hooks/useControllableValue'
import {styles} from './styles.css'
import type {SwitchProps} from './Switch.types'
import {useFieldBinding, useFieldContext} from '../Field/FieldContext'

export type {SwitchProps} from './Switch.types'

/**
 * Native Switch: RSD has no `<input type="checkbox">` on native, so the track
 * button carries the switch role. `name` and `value` have no form to submit
 * to here.
 */
export function Switch({
  checked: controlledChecked,
  defaultChecked = false,
  onCheckedChange,
  disabled: disabledProp,
  children,
  'aria-label': ariaLabel,
}: SwitchProps) {
  // Native has no `for`: with no children, the enclosing Field.Label's text
  // names the switch.
  const ctx = useFieldContext()
  const disabled = disabledProp ?? ctx?.disabled ?? false
  const label = !children ? (ariaLabel ?? ctx?.labelText) : undefined
  // Inside a Form's Field.Root name, an uncontrolled switch shows and sets the
  // form field; a press is the whole interaction here, so it also marks it touched.
  const bound = useFieldBinding(controlledChecked, Boolean)
  const bindChange = bound?.onChange
  const bindBlur = bound?.onBlur
  const handleCheckedChange = useCallback(
    (next: boolean) => {
      bindChange?.(next)
      bindBlur?.()
      onCheckedChange?.(next)
    },
    [bindChange, bindBlur, onCheckedChange],
  )
  const [checked, setChecked] = useControllableValue(
    controlledChecked ?? bound?.value,
    defaultChecked,
    handleCheckedChange,
  )
  const handleClick = useCallback(() => {
    if (!disabled) setChecked(!checked)
  }, [disabled, checked, setChecked])

  return (
    <html.label style={[styles.root, styles.nativeFlex, disabled && styles.rootDisabled]}>
      <html.button
        type="button"
        ref={bound?.ref}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={handleClick}
        style={[styles.track, checked ? styles.trackChecked : styles.trackUnchecked]}
      >
        <html.span style={[styles.thumb, checked && styles.thumbChecked]} />
      </html.button>
      {children && <html.span>{children}</html.span>}
    </html.label>
  )
}
