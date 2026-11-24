import {
  type ReactNode,
  type RefObject,
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {createPortal} from 'react-dom'
import {html} from 'react-strict-dom'
import {Cluster} from '../Cluster/Cluster'
import type {RowSlot} from './FieldContext'
import type {RowErrorProps, RowProps, RowSlotState} from './FieldRowTypes'
import {styles} from './styles.css'

// A row of Fields shows its errors in one line under the whole row, in the
// row's own flow, so a long message wraps instead of covering what follows and
// the inputs never move. The line is a live region mounted empty: each erring
// Field adds its own span (keeping its element and `errorId`, so the control's
// `aria-describedby` still resolves) in the order the Fields sit in the page,
// and a second error announces only itself (`aria-atomic={false}`).

interface RowContextValue {
  line: HTMLElement | null
  onSlot: (delta: number) => void
}

const RowContext = createContext<RowContextValue | null>(null)

// The Field a slot belongs to, to keep the line in the Fields' page order.
const owners = new WeakMap<Element, HTMLElement>()

/** A row of Fields (and a button): the controls wrap, and every Field's error
 *  shows in one line under the whole row, each message led by its field's
 *  label. */
export function Row({gap = 'sm', children}: RowProps) {
  const [line, setLine] = useState<HTMLElement | null>(null)
  const [shown, setShown] = useState(0)
  const onSlot = useCallback((delta: number) => setShown((count) => count + delta), [])
  // Stable once the line is mounted, so a message coming or going re-renders
  // the row's own line and no Field.
  const rowContext = useMemo(() => ({line, onSlot}), [line, onSlot])
  return (
    <RowContext.Provider value={rowContext}>
      <html.div style={styles.row}>
        <Cluster gap={gap} align="end">
          {children}
        </Cluster>
        <html.div
          ref={setLine}
          role="alert"
          aria-atomic={false}
          style={[styles.rowLine, shown > 0 && styles.rowLineShown]}
        />
      </html.div>
    </RowContext.Provider>
  )
}

/** A Field reads the row it sits in, and a Field inside it does not: a form in
 *  a popover opened from a row keeps its own errors. */
export function RowBoundary({children}: {children: ReactNode}) {
  return <RowContext.Provider value={null}>{children}</RowContext.Provider>
}

/** The slot a Field's error takes in its row's line while `active`: the span
 *  that carries the Field's `errorId`. A Field that only inherits the row through
 *  a portal (the popup of a Popover opened from the row) is not in the row, and
 *  keeps its error where it is. `rootRef` goes on the Field's outermost element. */
export function useRowSlot(
  errorId: string,
  active: boolean,
): RowSlotState<RefObject<HTMLDivElement | null>> {
  const row = useContext(RowContext)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [slot, setSlot] = useState<RowSlot | null>(null)
  // Unknown until the Field is in the page; a layout effect settles it before paint.
  const [inside, setInside] = useState(true)
  const [fallbackLabel, setFallbackLabel] = useState<string | undefined>()
  const line = row?.line ?? null
  const onSlot = row?.onSlot
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!line || !root) return
    setInside(line.parentElement?.contains(root) ?? false)
  }, [line])
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!active || !inside || !line || !root || !onSlot) return
    setFallbackLabel(root.querySelector('[aria-label]')?.getAttribute('aria-label') ?? undefined)
    const span = document.createElement('span')
    span.id = errorId
    owners.set(span, root)
    const after = [...line.children].find((child) => {
      const owner = owners.get(child)
      return (
        owner !== undefined &&
        owner.compareDocumentPosition(root) & Node.DOCUMENT_POSITION_PRECEDING
      )
    })
    line.insertBefore(span, after ?? null)
    onSlot(1)
    setSlot(span as unknown as RowSlot)
    return () => {
      span.remove()
      onSlot(-1)
      setSlot(null)
    }
  }, [active, inside, line, onSlot, errorId])
  return {rootRef, inRow: row !== null && inside, slot, fallbackLabel}
}

/** A message ends in punctuation, so two read one after the other, in the line
 *  and aloud, as two sentences. */
function sentence(text: ReactNode): ReactNode {
  return typeof text === 'string' && !/[.!?]$/.test(text.trim()) ? `${text}.` : text
}

/** The message in its Field's slot, led by the field's label. */
export function RowError({slot, label, children}: RowErrorProps) {
  return createPortal(
    <>
      {label ? `${label}: ` : null}
      {sentence(children)}{' '}
    </>,
    slot as unknown as HTMLElement,
  )
}
