import {beforeEach, describe, expect, it, vi} from 'vitest'

// Just enough React to call the native Checkbox, Switch and Slider as
// functions and read the props they render: no state survives a call.
interface Ctx {
  _cur: unknown
}
vi.mock('react', () => ({
  createContext: (initial: unknown) => {
    const context: Ctx & {Provider?: unknown} = {_cur: initial}
    context.Provider = {context}
    return context
  },
  useContext: (context: Ctx) => context._cur,
  useCallback: <T>(callback: T) => callback,
  useMemo: <T>(make: () => T) => make(),
  useRef: <T>(initial: T) => ({current: initial}),
  useState: <T>(initial: T | (() => T)) => [
    typeof initial === 'function' ? (initial as () => T)() : initial,
    () => {},
  ],
  useEffect: () => {},
}))
vi.mock('react-native', () => ({
  View: 'View',
  PanResponder: {create: () => ({panHandlers: {}})},
}))
vi.mock('react-strict-dom', () => ({html: new Proxy({}, {get: (_t, name) => String(name)})}))
// A dynamic style (Slider's fillWidth) is called: every entry is a callable.
const emptyStyles = {styles: new Proxy({}, {get: () => () => ({})})}
vi.mock('../src/components/Checkbox/styles.css', () => emptyStyles)
vi.mock('../src/components/Switch/styles.css', () => emptyStyles)
vi.mock('../src/components/Slider/styles.css', () => emptyStyles)

const {Checkbox} = await import('../src/components/Checkbox/Checkbox.native')
const {Switch} = await import('../src/components/Switch/Switch.native')
const {Slider} = await import('../src/components/Slider/Slider.native')
const {FieldContext} = await import('../src/components/Field/FieldContext')
const fieldContext = FieldContext as unknown as Ctx

interface El {
  type: unknown
  props: Record<string, any>
}
const isEl = (node: unknown): node is El =>
  typeof node === 'object' && node !== null && 'props' in node
function walk(node: unknown, out: El[] = []): El[] {
  if (!isEl(node)) return out
  out.push(node)
  const children = node.props.children
  for (const child of children == null ? [] : [children].flat(5)) walk(child, out)
  return out
}
function render(component: unknown, props: Record<string, unknown>, type: string) {
  return walk((component as (props: unknown) => El)(props)).find((el) => el.type === type)!
}

beforeEach(() => {
  fieldContext._cur = null
})

describe('native controls inside Field.Root', () => {
  const field = {labelText: 'Alerts', disabled: true}

  it('Checkbox takes the Field.Label text and disabled, aria-label first', () => {
    fieldContext._cur = field
    const box = render(Checkbox, {}, 'button')
    expect(box.props['aria-label']).toBe('Alerts')
    expect(box.props.disabled).toBe(true)
    expect(render(Checkbox, {'aria-label': 'Own'}, 'button').props['aria-label']).toBe('Own')
    // Visible children name it; the Field label is not added on top.
    expect(render(Checkbox, {children: 'Mine'}, 'button').props['aria-label']).toBeUndefined()
    expect(render(Checkbox, {disabled: false}, 'button').props.disabled).toBe(false)
  })

  it('Switch takes the Field.Label text and disabled, aria-label first', () => {
    fieldContext._cur = field
    const track = render(Switch, {}, 'button')
    expect(track.props['aria-label']).toBe('Alerts')
    expect(track.props.disabled).toBe(true)
    expect(render(Switch, {'aria-label': 'Own'}, 'button').props['aria-label']).toBe('Own')
    expect(render(Switch, {children: 'Mine'}, 'button').props['aria-label']).toBeUndefined()
  })

  it('Slider takes the Field.Label text after aria-label and string children', () => {
    fieldContext._cur = field
    const view = render(Slider, {}, 'View')
    expect(view.props.accessibilityLabel).toBe('Alerts')
    expect(view.props.accessibilityState).toEqual({disabled: true})
    expect(render(Slider, {'aria-label': 'Own'}, 'View').props.accessibilityLabel).toBe('Own')
    expect(render(Slider, {children: 'Mine'}, 'View').props.accessibilityLabel).toBe('Mine')
  })

  it('Checkbox and Switch inside a Form show the field and set it on a press, touched', () => {
    for (const control of [Checkbox, Switch]) {
      const onChange = vi.fn()
      const onBlur = vi.fn()
      const ref = () => {}
      fieldContext._cur = {field: {value: true, onChange, onBlur, ref, name: 'opt'}}
      const button = render(control, {}, 'button')
      expect(button.props['aria-checked']).toBe(true)
      expect(button.props.ref).toBe(ref)
      button.props.onClick()
      // A plain boolean, never the synthesized event.
      expect(onChange).toHaveBeenCalledWith(false)
      expect(onBlur).toHaveBeenCalledTimes(1)
      // An own value prop wins and leaves the field alone.
      onChange.mockClear()
      const own = render(control, {checked: false}, 'button')
      expect(own.props['aria-checked']).toBe(false)
      own.props.onClick()
      expect(onChange).not.toHaveBeenCalled()
    }
  })

  it('Checkbox and Switch call their own callback too when bound', () => {
    const field = {value: false, onChange: vi.fn(), onBlur: vi.fn(), ref: () => {}, name: 'opt'}
    fieldContext._cur = {field}
    const onChange = vi.fn()
    render(Checkbox, {onChange}, 'button').props.onClick()
    expect(onChange.mock.calls[0]?.[0].target.checked).toBe(true)
    const onCheckedChange = vi.fn()
    render(Switch, {onCheckedChange}, 'button').props.onClick()
    expect(onCheckedChange).toHaveBeenCalledWith(true)
    expect(field.onChange).toHaveBeenCalledTimes(2)
  })

  it('Slider inside a Form shows the field number and sets it on a step, touched', () => {
    const field = {value: 40, onChange: vi.fn(), onBlur: vi.fn(), ref: () => {}, name: 'vol'}
    fieldContext._cur = {field}
    const view = render(Slider, {step: 10}, 'View')
    expect(view.props.accessibilityValue.now).toBe(40)
    view.props.onAccessibilityAction({nativeEvent: {actionName: 'increment'}})
    expect(field.onChange).toHaveBeenCalledWith(50)
    expect(field.onBlur).toHaveBeenCalledTimes(1)
    // A field with no number yet shows defaultValue.
    fieldContext._cur = {field: {...field, value: undefined}}
    expect(render(Slider, {defaultValue: 30}, 'View').props.accessibilityValue.now).toBe(30)
  })

  it('outside a Field each keeps its own name and is enabled', () => {
    expect(render(Checkbox, {}, 'button').props['aria-label']).toBeUndefined()
    expect(render(Switch, {}, 'button').props.disabled).toBe(false)
    expect(render(Slider, {}, 'View').props.accessibilityLabel).toBeUndefined()
  })
})
