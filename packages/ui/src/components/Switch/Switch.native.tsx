import {useCallback} from 'react'
import {html} from 'react-strict-dom'
import {useControllableValue} from '../../hooks/useControllableValue'
import {styles} from './styles.css'
import type {SwitchProps} from './Switch.types'
import {useFieldContext} from '../Field/FieldContext'

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
  const [checked, setChecked] = useControllableValue(
    controlledChecked,
    defaultChecked,
    onCheckedChange,
  )
  const handleClick = useCallback(() => {
    if (!disabled) setChecked(!checked)
  }, [disabled, checked, setChecked])

  return (
    <html.label style={[styles.root, styles.nativeFlex, disabled && styles.rootDisabled]}>
      <html.button
        type="button"
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
