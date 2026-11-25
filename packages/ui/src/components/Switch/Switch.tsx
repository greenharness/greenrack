import {useCallback} from 'react'
import {html} from 'react-strict-dom'
import {useControllableValue} from '../../hooks/useControllableValue'
import {styles} from './styles.css'
import {visuallyHidden} from '../../styles/visually-hidden.css'
import type {SwitchProps} from './Switch.types'
import {useFieldBinding, useFieldContext} from '../Field/FieldContext'

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
  // Inside a Form's Field.Root name, an uncontrolled switch shows and sets the form field.
  const bound = useFieldBinding(controlledChecked, Boolean)
  const bindChange = bound?.onChange
  const handleCheckedChange = useCallback(
    (next: boolean) => {
      bindChange?.(next)
      onCheckedChange?.(next)
    },
    [bindChange, onCheckedChange],
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
    <html.label style={[styles.root, disabled && styles.rootDisabled]}>
      {/* The hidden real checkbox carries a11y and form submission (native:
          Switch.native.tsx, whose button carries the switch role). */}
      <html.input
        type="checkbox"
        role="switch"
        id={ctx?.controlId}
        name={name ?? bound?.name}
        value={value}
        ref={bound?.ref}
        onBlur={bound?.onBlur}
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
