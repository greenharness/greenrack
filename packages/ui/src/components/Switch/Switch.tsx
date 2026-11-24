import {useCallback} from 'react'
import {html} from 'react-strict-dom'
import {useControllableValue} from '../../hooks/useControllableValue'
import {styles} from './styles.css'
import {visuallyHidden} from '../../styles/visually-hidden.css'
import type {SwitchProps} from './Switch.types'
import {useFieldContext} from '../Field/FieldContext'

export type {SwitchProps} from './Switch.types'

export function Switch({
  checked: controlledChecked,
  defaultChecked = false,
  onCheckedChange,
  disabled: disabledProp,
  name,
  value,
  children,
  'aria-label': ariaLabel,
}: SwitchProps) {
  // Inside a Field.Root the input takes the Field's control id (so Field.Label
  // names it), its description and error, and its invalid and disabled state.
  const ctx = useFieldContext()
  const disabled = disabledProp ?? ctx?.disabled ?? false
  const [checked, setChecked] = useControllableValue(
    controlledChecked,
    defaultChecked,
    onCheckedChange,
  )
  const handleClick = useCallback(() => {
    if (!disabled) setChecked(!checked)
  }, [disabled, checked, setChecked])

  return (
    <html.label style={[styles.root, disabled && styles.rootDisabled]}>
      {/* The hidden real checkbox carries a11y and form submission (native:
          Switch.native.tsx, whose button carries the switch role). */}
      <html.input
        type="checkbox"
        role="switch"
        id={ctx?.controlId}
        name={name}
        value={value}
        // The input always shows the Switch's state (controlled or internal),
        // so a click on the track, the input or a label all go through setChecked.
        checked={checked}
        disabled={disabled}
        aria-checked={checked}
        aria-label={!children ? ariaLabel : undefined}
        aria-describedby={ctx?.describedBy}
        aria-invalid={ctx?.invalid || undefined}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          setChecked(e.target.checked)
        }}
        style={[visuallyHidden.base, styles.input]}
      />
      <html.button
        type="button"
        tabIndex={-1}
        aria-hidden
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
