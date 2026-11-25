import {useCallback, useRef, useState} from 'react'
import {PanResponder, View} from 'react-native'
import {html} from 'react-strict-dom'
import {useControllableValue} from '../../hooks/useControllableValue'
import {styles} from './styles.css'
import {fractionOf, snapToStep, valueAtFraction} from './sliderMath'
import type {SliderProps} from './Slider.types'
import {useFieldBinding, useFieldContext} from '../Field/FieldContext'

export type {SliderProps} from './Slider.types'

/** A form field's value as the slider reads it: a finite number, else unset. */
const fieldNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

/**
 * Native Slider: a touch on the track sets the value and a drag moves it. The
 * track View is one adjustable accessibility element, whose increment and
 * decrement actions step the value (native has no arrow keys).
 */
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
  // Native has no `for`: the enclosing Field.Label's text names the slider
  // after its own aria-label and string children.
  const ctx = useFieldContext()
  const disabled = disabledProp ?? ctx?.disabled ?? false
  const range = {min, max, step}
  // Inside a Form's Field.Root name, an uncontrolled slider shows and sets the
  // form field; a field with no number yet shows `defaultValue ?? min`. The
  // end of a drag, or an accessibility step, marks it touched.
  const bound = useFieldBinding<number | undefined>(controlledValue, fieldNumber)
  const bindChange = bound?.onChange
  const touch = bound?.onBlur
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
  const [trackWidth, setTrackWidth] = useState(0)

  // The responder is created once; it reads what changes through this ref.
  const latest = useRef({current, range, trackWidth, disabled, setValue, touch})
  latest.current = {current, range, trackWidth, disabled, setValue, touch}
  const dragStartFraction = useRef(0)

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !latest.current.disabled && latest.current.trackWidth > 0,
      onMoveShouldSetPanResponder: () => !latest.current.disabled && latest.current.trackWidth > 0,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const {range: r, trackWidth: width, current: now, setValue: set} = latest.current
        const fraction = event.nativeEvent.locationX / width
        dragStartFraction.current = Math.min(1, Math.max(0, fraction))
        const next = valueAtFraction(fraction, r)
        if (next !== now) set(next)
      },
      onPanResponderMove: (_event, gesture) => {
        const {range: r, trackWidth: width, current: now, setValue: set} = latest.current
        const next = valueAtFraction(dragStartFraction.current + gesture.dx / width, r)
        if (next !== now) set(next)
      },
      onPanResponderRelease: () => latest.current.touch?.(),
    }),
  ).current

  const stepBy = (direction: 1 | -1) => {
    const next = snapToStep(current + direction * step, range)
    if (next !== current) setValue(next)
    touch?.()
  }

  return (
    <html.div style={[styles.root, disabled && styles.rootDisabled]}>
      {(children || showValue) && (
        <html.div style={styles.header}>
          {children && <html.span>{children}</html.span>}
          {showValue && <html.span style={styles.valueText}>{text}</html.span>}
        </html.div>
      )}
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={
          ariaLabel ?? (typeof children === 'string' ? children : undefined) ?? ctx?.labelText
        }
        accessibilityValue={{min, max, now: current, text}}
        accessibilityState={{disabled}}
        accessibilityActions={[{name: 'increment'}, {name: 'decrement'}]}
        onAccessibilityAction={(event) => {
          if (disabled) return
          if (event.nativeEvent.actionName === 'increment') stepBy(1)
          if (event.nativeEvent.actionName === 'decrement') stepBy(-1)
        }}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        {...responder.panHandlers}
      >
        <html.div style={[styles.hit, disabled && styles.hitDisabled]}>
          <html.div style={styles.track} />
          <html.div style={[styles.fill, styles.fillWidth(percent)]} />
          <html.div style={[styles.thumb, styles.thumbAt(percent)]} />
        </html.div>
      </View>
    </html.div>
  )
}
