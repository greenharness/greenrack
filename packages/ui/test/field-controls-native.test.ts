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

  it('outside a Field each keeps its own name and is enabled', () => {
    expect(render(Checkbox, {}, 'button').props['aria-label']).toBeUndefined()
    expect(render(Switch, {}, 'button').props.disabled).toBe(false)
    expect(render(Slider, {}, 'View').props.accessibilityLabel).toBeUndefined()
  })
})
