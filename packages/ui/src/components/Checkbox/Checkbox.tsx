import {type ReactNode, useState, useCallback} from 'react'
import {html} from 'react-strict-dom'
import {styles} from './styles.css'
import {visuallyHidden} from '../../styles/visually-hidden.css'
import {useFieldContext} from '../Field/FieldContext'

interface CheckboxProps {
  name?: string
  value?: string
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
  const isControlled = controlledChecked !== undefined
  const [internalChecked, setInternalChecked] = useState(defaultChecked)
  const isChecked = isControlled ? controlledChecked : internalChecked

  // The real <input type=checkbox> drives toggling, a11y and form submit.
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) {
        setInternalChecked(e.target.checked)
      }
      onChange?.(e)
    },
    [isControlled, onChange],
  )

  return (
    <html.label style={[styles.root, disabled && styles.rootDisabled]}>
      <html.input
        type="checkbox"
        id={ctx?.controlId}
        name={name}
        value={value}
        checked={isControlled ? controlledChecked : undefined}
        defaultChecked={!isControlled ? defaultChecked : undefined}
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
