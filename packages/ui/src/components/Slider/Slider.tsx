import {useCallback, useId, useRef} from 'react'
import type {KeyboardEvent, PointerEvent} from 'react'
import {html} from 'react-strict-dom'
import {useControllableValue} from '../../hooks/useControllableValue'
import {styles} from './styles.css'
import {fractionOf, snapToStep, valueAfterKey, valueAtFraction} from './sliderMath'
import type {SliderProps} from './Slider.types'
import {useFieldBinding, useFieldContext} from '../Field/FieldContext'

export type {SliderProps} from './Slider.types'

/** A form field's value as the slider reads it: a finite number, else unset. */
const fieldNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

export function Slider({
  value: controlledValue,
  defaultValue,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled: disabledProp,
  children,
  'aria-label': ariaLabel,
  showValue = false,
  formatValue,
}: SliderProps) {
  const ctx = useFieldContext()
  const disabled = disabledProp ?? ctx?.disabled ?? false
  // A div with role="slider" is not labelable: Field.Label's `for` cannot name
  // it, so the thumb points aria-labelledby at a mounted Field.Label instead.
  const fieldLabelId = ctx?.labelText !== undefined ? ctx.labelId : undefined
  const range = {min, max, step}
  // Inside a Form's Field.Root name, an uncontrolled slider shows and sets the
  // form field; a field with no number yet shows `defaultValue ?? min`.
  const bound = useFieldBinding<number | undefined>(controlledValue, fieldNumber)
  const bindChange = bound?.onChange
  const handleValueChange = useCallback(
    (next: number) => {
      bindChange?.(next)
      onValueChange?.(next)
    },
    [bindChange, onValueChange],
  )
  const [value, setValue] = useControllableValue(
    controlledValue ?? bound?.value,
    snapToStep(defaultValue ?? min, range),
    handleValueChange,
  )
  const current = snapToStep(value, range)
  const percent = fractionOf(current, range) * 100
  const text = formatValue ? formatValue(current) : String(current)
  const labelId = useId()
  const hitRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const change = useCallback(
    (next: number) => {
      if (next !== current) setValue(next)
    },
    [current, setValue],
  )

  const moveTo = (event: PointerEvent<HTMLDivElement>) => {
    const rect = hitRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    change(valueAtFraction((event.clientX - rect.left) / rect.width, range))
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return
    dragging.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    moveTo(event)
    event.currentTarget.querySelector<HTMLElement>('[role="slider"]')?.focus()
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || !dragging.current) return
    moveTo(event)
  }

  const endDrag = () => {
    dragging.current = false
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    const next = valueAfterKey(event.key, current, range)
    if (next === null) return
    event.preventDefault()
    change(next)
  }

  return (
    <html.div style={[styles.root, disabled && styles.rootDisabled]}>
      {(children || showValue) && (
        <html.div style={styles.header}>
          {children && <html.span id={labelId}>{children}</html.span>}
          {showValue && <html.span style={styles.valueText}>{text}</html.span>}
        </html.div>
      )}
      <html.div
        ref={hitRef}
        style={[styles.hit, disabled && styles.hitDisabled]}
        onPointerDown={handlePointerDown as never}
        onPointerMove={handlePointerMove as never}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <html.div style={styles.track} />
        <html.div style={[styles.fill, styles.fillWidth(percent)]} />
        <html.div
          role="slider"
          ref={bound?.ref}
          id={ctx?.controlId}
          onBlur={bound?.onBlur}
          tabIndex={disabled ? -1 : 0}
          aria-label={children ? undefined : ariaLabel}
          aria-labelledby={children ? labelId : ariaLabel ? undefined : fieldLabelId}
          aria-describedby={ctx?.describedBy}
          aria-invalid={ctx?.invalid || undefined}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={current}
          aria-valuetext={text}
          aria-disabled={disabled || undefined}
          onKeyDown={handleKeyDown as never}
          style={[styles.thumb, styles.thumbAt(percent)]}
        />
      </html.div>
    </html.div>
  )
}
