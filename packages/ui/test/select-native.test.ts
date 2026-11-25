import {beforeEach, describe, expect, it, vi} from 'vitest'

// A one-component hook runtime, as in combobox-native.test.ts: enough React
// to call the native Select's Root and Trigger as functions. Root's hooks
// take fixed slots from 0; Trigger reads contexts only.
interface Ctx {
  _cur: unknown
}
const runtime = vi.hoisted(() => ({slots: [] as unknown[], cursor: 0}))

vi.mock('react', () => {
  const slot = <T>(init: () => T) => {
    const index = runtime.cursor++
    if (!(index in runtime.slots)) runtime.slots[index] = init()
    return index
  }
  return {
    Children: {toArray: (children: unknown) => (children == null ? [] : [children].flat())},
    createContext: (initial: unknown) => {
      const context: Ctx & {Provider?: unknown} = {_cur: initial}
      context.Provider = {context}
      return context
    },
    useContext: (context: Ctx) => context._cur,
    isValidElement: (node: unknown) => typeof node === 'object' && node !== null && 'props' in node,
    useId: () => 'id',
    useMemo: <T>(make: () => T) => make(),
    useCallback: <T>(callback: T) => callback,
    useRef: <T>(initial: T) => {
      const index = slot(() => ({current: initial}))
      return runtime.slots[index]
    },
    useState: <T>(initial: T | (() => T)) => {
      const index = slot(() => (typeof initial === 'function' ? (initial as () => T)() : initial))
      const set = (next: T | ((previous: T) => T)) => {
        runtime.slots[index] =
          typeof next === 'function'
            ? (next as (previous: T) => T)(runtime.slots[index] as T)
            : next
      }
      return [runtime.slots[index], set]
    },
    useEffect: () => {},
    useLayoutEffect: () => {},
  }
})
vi.mock('react-native', () => ({Pressable: 'NativePressable', View: 'View'}))
vi.mock('react-native-gesture-handler', () => ({Pressable: 'Pressable'}))
vi.mock('react-strict-dom', () => ({html: new Proxy({}, {get: (_t, name) => String(name)})}))
const emptyStyles = {styles: new Proxy({}, {get: () => ({})})}
vi.mock('../src/components/Select/styles.css', () => emptyStyles)
vi.mock('../src/components/Select/native.css', () => ({nativeStyles: emptyStyles.styles}))
vi.mock('../src/components/Listbox/native.css', () => ({sheetStyles: emptyStyles.styles}))
vi.mock('../src/components/Drawer/Drawer', () => ({Drawer: {Root: 'Drawer.Root'}}))
vi.mock('../src/components/Listbox/Listbox', () => ({Listbox: {}}))
vi.mock('../src/components/Button/Button', () => ({Button: 'Button'}))
vi.mock('../src/components/SideNav/Chevron', () => ({Chevron: 'Chevron'}))
vi.mock('../src/shared/accessibilityFocus.native', () => ({focusForAccessibility: vi.fn()}))

const {Select} = await import('../src/components/Select/Select.native')
const {FieldContext} = await import('../src/components/Field/FieldContext')
const fieldContext = FieldContext as unknown as Ctx

interface El {
  type: unknown
  props: Record<string, any>
}

function renderRoot(props: Record<string, unknown> = {}) {
  runtime.slots = []
  runtime.cursor = 0
  const tree = (Select.Root as (props: unknown) => El)({children: null, ...props})
  // Hand the Trigger the context the Root provides.
  ;(tree.type as {context: Ctx}).context._cur = tree.props.value
}

function renderTrigger(props: Record<string, unknown> = {}) {
  return (Select.Trigger as (props: unknown) => El)({children: null, ...props})
}

beforeEach(() => {
  fieldContext._cur = null
})

describe('Select.native Trigger accessibility', () => {
  it('outside a Field, names the trigger by aria-label only', () => {
    renderRoot({defaultValue: 'b', initialLabels: {b: 'Banana'}})
    const named = renderTrigger({'aria-label': 'Fruit'})
    expect(named.type).toBe('NativePressable')
    expect(named.props.accessibilityLabel).toBe('Fruit')
    expect(named.props.accessibilityValue).toEqual({text: 'Banana'})

    // Unnamed, the trigger reads its children: no label, no value.
    const unnamed = renderTrigger()
    expect(unnamed.props.accessibilityLabel).toBeUndefined()
    expect(unnamed.props.accessibilityValue).toBeUndefined()
  })

  it('inside Field.Root names the trigger by its Field.Label, aria-label first', () => {
    renderRoot({defaultValue: 'b', initialLabels: {b: 'Banana'}})
    fieldContext._cur = {labelText: 'Fruit'}
    const labelled = renderTrigger()
    expect(labelled.props.accessibilityLabel).toBe('Fruit')
    expect(labelled.props.accessibilityValue).toEqual({text: 'Banana'})

    const own = renderTrigger({'aria-label': 'Favourite'})
    expect(own.props.accessibilityLabel).toBe('Favourite')
    expect(own.props.accessibilityValue).toEqual({text: 'Banana'})
  })

  it('carries no value before an item is chosen', () => {
    fieldContext._cur = null
    renderRoot()
    fieldContext._cur = {labelText: 'Fruit'}
    const empty = renderTrigger()
    expect(empty.props.accessibilityLabel).toBe('Fruit')
    expect(empty.props.accessibilityValue).toBeUndefined()
  })

  it('falls back to the raw value when its item registered no label', () => {
    renderRoot({defaultValue: 'kiwi'})
    fieldContext._cur = {labelText: 'Fruit'}
    expect(renderTrigger().props.accessibilityValue).toEqual({text: 'kiwi'})
  })
})
