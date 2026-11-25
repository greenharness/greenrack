import {type ReactNode, useState, useCallback} from 'react'
import {html} from 'react-strict-dom'
import {styles} from './styles.css'
import {visuallyHidden} from '../../styles/visually-hidden.css'
import {useFieldBinding, useFieldContext} from '../Field/FieldContext'

interface CheckboxProps {
  name?: string
  value?: string
  /** Controlled checked state. Unset inside a `Form`'s `Field.Root name`, the
   *  form field's boolean is shown and set instead (`defaultChecked` is then unused). */
  checked?: boolean
  defaultChecked?: boolean
  /** Prevents interaction. Default: the enclosing Field's `disabled`, else false. */
  disabled?: boolean
  /** Accessible label when no visible label (children) is provided. */
  'aria-label'?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  children?: ReactNode
}

export function Checkbox({
  name,
  value,
  checked: controlledChecked,
  defaultChecked = false,
  disabled: disabledProp,
  'aria-label': ariaLabel,
  onChange,
  children,
}: CheckboxProps) {
  // Inside a Field.Root the input takes the Field's control id (so Field.Label
  // names it), its description and error, and its invalid and disabled state.
  const ctx = useFieldContext()
  const disabled = disabledProp ?? ctx?.disabled ?? false
  // Inside a Form's Field.Root name, an uncontrolled checkbox shows and sets the form field.
  const bound = useFieldBinding(controlledChecked, Boolean)
  const shownChecked = controlledChecked ?? bound?.value
  const isControlled = shownChecked !== undefined
  const [internalChecked, setInternalChecked] = useState(defaultChecked)
  const isChecked = isControlled ? shownChecked : internalChecked
  const bindChange = bound?.onChange

  // The real <input type=checkbox> drives toggling, a11y and form submit.
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) {
        setInternalChecked(e.target.checked)
      }
      bindChange?.(e.target.checked)
      onChange?.(e)
    },
    [isControlled, onChange, bindChange],
  )

  return (
    <html.label style={[styles.root, disabled && styles.rootDisabled]}>
      <html.input
        type="checkbox"
        id={ctx?.controlId}
        name={name ?? bound?.name}
        value={value}
        ref={bound?.ref}
        onBlur={bound?.onBlur}
        // Always the shown state (controlled or internal), so the input never
        // switches between uncontrolled and controlled.
        checked={isChecked}
        disabled={disabled}
        aria-label={!children ? ariaLabel : undefined}
        aria-describedby={ctx?.describedBy}
        aria-invalid={ctx?.invalid || undefined}
        onChange={handleChange}
        style={[visuallyHidden.base, styles.input]}
      />
      <html.span
        style={[styles.box, isChecked ? styles.boxChecked : styles.boxUnchecked]}
        aria-hidden
      >
        <svg
          width={12}
          height={12}
          viewBox="0 0 12 12"
          fill="none"
          style={{opacity: isChecked ? 1 : 0}}
        >
          <polyline
            points="2.5 6 5 8.5 9.5 3.5"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </html.span>
      {children && <html.span>{children}</html.span>}
    </html.label>
  )
}
