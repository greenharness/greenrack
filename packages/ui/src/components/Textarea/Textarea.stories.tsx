import type {Meta, StoryObj} from '@storybook/react'
import {expect, fn, waitFor, within} from 'storybook/test'
import {useCallback, useId, useRef, useState} from 'react'
import {css, html} from 'react-strict-dom'
import {Textarea} from './Textarea'
import {Field} from '../Field/Field'
import {Listbox} from '../Listbox/Listbox'
import {Button} from '../Button/Button'
import {spacing} from '@greenharness/greenrack-tokens/tokens/spacing.css'
import {sizes} from '@greenharness/greenrack-tokens/tokens/sizes.css'

const meta: Meta<typeof Textarea> = {
  title: 'Components/Textarea',
  component: Textarea,
  args: {
    onChange: fn(),
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'error'],
    },
    disabled: {control: 'boolean'},
    rows: {control: 'number'},
  },
}

export default meta
type Story = StoryObj<typeof Textarea>

export const Default: Story = {
  args: {placeholder: 'Enter your message...'},
  play: async ({canvas, userEvent, args}) => {
    const textarea = canvas.getByPlaceholderText('Enter your message...')
    await expect(textarea).toBeInTheDocument()
    await expect(textarea).toBeEnabled()

    await userEvent.type(textarea, 'Hello world')
    await expect(textarea).toHaveValue('Hello world')
    await expect(args.onChange).toHaveBeenCalled()
  },
}

export const KeyboardEvents: Story = {
  args: {placeholder: 'Edit note', onFocus: fn(), onKeyDown: fn(), onKeyUp: fn()},
  play: async ({args, canvas, userEvent}) => {
    const textarea = canvas.getByPlaceholderText('Edit note')
    await userEvent.click(textarea)
    await expect(args.onFocus).toHaveBeenCalledTimes(1)

    await userEvent.keyboard('{ArrowDown}{Enter}{Escape}')
    const keys = (args.onKeyDown as ReturnType<typeof fn>).mock.calls.map(
      ([e]) => (e as React.KeyboardEvent).key,
    )
    await expect(keys).toEqual(['ArrowDown', 'Enter', 'Escape'])
    await expect(args.onKeyUp).toHaveBeenCalledTimes(3)
  },
}

/** The error variant is shown the way it is used: in a Field that says what is
 *  wrong, so the red control has a message and `aria-describedby` names it. */
export const Error: Story = {
  args: {variant: 'error', placeholder: 'Invalid content'},
  render: (args) => (
    <Field.Root invalid>
      <Field.Label>Notes</Field.Label>
      <Textarea {...args} />
      <Field.Error>Enter some notes</Field.Error>
    </Field.Root>
  ),
  play: async ({canvas}) => {
    const textarea = canvas.getByPlaceholderText('Invalid content')
    await expect(textarea).toHaveAttribute('aria-invalid', 'true')
    await expect(textarea).toHaveAccessibleDescription('Enter some notes')
  },
}

export const Disabled: Story = {
  args: {placeholder: 'Disabled', disabled: true},
  play: async ({canvas}) => {
    await expect(canvas.getByPlaceholderText('Disabled')).toBeDisabled()
  },
}

export const CustomRows: Story = {
  args: {placeholder: 'Large textarea', rows: 8},
  play: async ({canvas}) => {
    const textarea = canvas.getByPlaceholderText('Large textarea')
    await expect(textarea).toHaveAttribute('rows', '8')
  },
}

const stackStyles = css.create({
  stack: {display: 'flex', flexDirection: 'column', gap: spacing.ms, maxWidth: sizes.panelSm},
})

export const AllVariants: Story = {
  render: () => (
    <html.div style={stackStyles.stack}>
      <Textarea placeholder="Default textarea" />
      <Field.Root invalid>
        <Textarea variant="error" placeholder="Error textarea" aria-label="Error textarea" />
        <Field.Error>Enter a value</Field.Error>
      </Field.Root>
      <Textarea placeholder="Disabled" disabled />
    </html.div>
  ),
  play: async ({canvas}) => {
    const textareas = canvas.getAllByRole('textbox')
    await expect(textareas.length).toBe(3)

    const disabled = canvas.getByPlaceholderText('Disabled')
    await expect(disabled).toBeDisabled()
  },
}

export const AutoGrow: Story = {
  args: {placeholder: 'Grows', autoGrow: true, rows: 2, maxRows: 5},
  play: async ({canvas, userEvent}) => {
    const textarea = canvas.getByPlaceholderText('Grows') as HTMLTextAreaElement
    const empty = textarea.getBoundingClientRect().height

    await userEvent.click(textarea)
    await userEvent.keyboard(
      'a{Shift>}{Enter}{/Shift}b{Shift>}{Enter}{/Shift}c{Shift>}{Enter}{/Shift}d',
    )
    // four lines: taller than empty, nothing to scroll yet
    await waitFor(() => expect(textarea.getBoundingClientRect().height).toBeGreaterThan(empty))
    await expect(textarea.scrollHeight).toBeLessThanOrEqual(textarea.clientHeight)

    // many more lines: the height stops at maxRows, then the field scrolls
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}e'.repeat(10))
    await waitFor(() => expect(textarea.scrollHeight).toBeGreaterThan(textarea.clientHeight))
    const capped = textarea.getBoundingClientRect().height
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}f')
    await expect(textarea.getBoundingClientRect().height).toBe(capped)
    await expect(capped).toBeLessThan(textarea.scrollHeight)
    // the cap is maxRows (5) lines plus the vertical padding and border
    const box = getComputedStyle(textarea)
    const px = (v: string) => parseFloat(v)
    const fiveLines =
      5 * px(box.lineHeight) +
      px(box.paddingTop) +
      px(box.paddingBottom) +
      px(box.borderTopWidth) +
      px(box.borderBottomWidth)
    await expect(Math.abs(capped - fiveLines)).toBeLessThan(1)
  },
}

const FRUITS = ['Apple', 'Apricot', 'Banana', 'Cherry']

// The editor keeps focus while the anchored Listbox filters and selects.
function AnchoredEditor() {
  const id = useId()
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const [text, setText] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const query = text.startsWith('/') ? text.slice(1).toLowerCase() : null
  const matches = query === null ? [] : FRUITS.filter((f) => f.toLowerCase().startsWith(query))
  const open = query !== null && !dismissed && matches.length > 0
  const optionId = useCallback((value: string) => `${id}-${value}`, [id])
  const highlightedId = open ? optionId(matches[Math.min(highlighted, matches.length - 1)]!) : null

  const pick = (value: string) => {
    setText(`${value} `)
    setDismissed(false)
  }

  return (
    <>
      <Textarea
        placeholder="Type / to pick"
        ref={ref}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setHighlighted(0)
          setDismissed(false)
        }}
        onKeyDown={(e) => {
          if (!open) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlighted((i) => (i + 1) % matches.length)
          } else if (e.key === 'Enter') {
            e.preventDefault()
            pick(matches[Math.min(highlighted, matches.length - 1)]!)
          } else if (e.key === 'Escape') {
            setDismissed(true)
          }
        }}
        role="combobox"
        {...Listbox.getAnchorProps({id, open, highlightedId})}
      />
      <Listbox.Root
        id={id}
        open={open}
        anchor={() => ref.current?.getBoundingClientRect()}
        highlightedId={highlightedId}
        onSelect={pick}
        getOptionId={optionId}
        aria-label="Fruits"
      >
        {matches.map((f) => (
          <Listbox.Option key={f} value={f}>
            {f}
          </Listbox.Option>
        ))}
      </Listbox.Root>
    </>
  )
}

export const AnchoredListbox: Story = {
  render: () => <AnchoredEditor />,
  play: async ({canvas, userEvent}) => {
    const editor = canvas.getByRole('combobox')
    await userEvent.click(editor)
    await userEvent.keyboard('/a')
    const list = await within(document.body).findByRole('listbox', {name: 'Fruits'})
    await expect(editor).toHaveFocus()
    await expect(editor).toHaveAttribute('aria-expanded', 'true')
    await expect(editor).toHaveAttribute('aria-controls', list.id)
    await expect(within(list).getAllByRole('option')).toHaveLength(2)

    // filtering narrows the list; focus stays in the editor
    await userEvent.keyboard('pr')
    await waitFor(() => expect(within(list).getAllByRole('option')).toHaveLength(1))
    await expect(editor).toHaveFocus()
    await expect(editor).toHaveAttribute('aria-activedescendant', `${list.id}-Apricot`)

    // selecting by key keeps focus and closes the list
    await userEvent.keyboard('{Enter}')
    await expect(editor).toHaveValue('Apricot ')
    await expect(editor).toHaveFocus()
    await waitFor(() => expect(editor).toHaveAttribute('aria-expanded', 'false'))

    // selecting by pointer keeps focus too
    await userEvent.clear(editor)
    await userEvent.keyboard('/b')
    const banana = await within(document.body).findByRole('option', {name: 'Banana'})
    await userEvent.click(banana)
    await expect(editor).toHaveValue('Banana ')
    await expect(editor).toHaveFocus()
  },
}

/**
 * `onFiles` (web): a file pasted into the field or dropped on it goes to
 * `onFiles`; while files are dragged over it the field shows the drop ring.
 * Pasted text stays text.
 */
export const PasteAndDropFiles: Story = {
  args: {placeholder: 'Paste or drop a screenshot', onFiles: fn()},
  play: async ({canvas, args}) => {
    const field = canvas.getByPlaceholderText('Paste or drop a screenshot')
    const withFile = () => {
      const transfer = new DataTransfer()
      transfer.items.add(new File(['png'], 'shot.png', {type: 'image/png'}))
      return transfer
    }

    field.dispatchEvent(
      new ClipboardEvent('paste', {clipboardData: withFile(), bubbles: true, cancelable: true}),
    )
    await expect(args.onFiles).toHaveBeenCalledTimes(1)
    await expect((args.onFiles as ReturnType<typeof fn>).mock.calls[0][0][0].name).toBe('shot.png')

    const text = new DataTransfer()
    text.setData('text/plain', 'hello')
    field.dispatchEvent(
      new ClipboardEvent('paste', {clipboardData: text, bubbles: true, cancelable: true}),
    )
    await expect(args.onFiles).toHaveBeenCalledTimes(1)

    const ringBefore = getComputedStyle(field).boxShadow
    field.dispatchEvent(
      new DragEvent('dragenter', {dataTransfer: withFile(), bubbles: true, cancelable: true}),
    )
    await waitFor(() => expect(getComputedStyle(field).boxShadow).not.toBe(ringBefore))
    const drop = new DragEvent('drop', {dataTransfer: withFile(), bubbles: true, cancelable: true})
    field.dispatchEvent(drop)
    await expect(drop.defaultPrevented).toBe(true)
    await expect(args.onFiles).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(getComputedStyle(field).boxShadow).toBe(ringBefore))
  },
}

/** What a caller's callback ref saw: `setup` per attach, `cleanup` per detach. */
const refLog: string[] = []

function RefCleanupHarness() {
  useState(() => {
    refLog.length = 0
    return null
  })
  const [value, setValue] = useState('first')
  const [shown, setShown] = useState(true)
  // React 19: a callback ref that returns a cleanup is never called with null.
  const callerRef = useCallback((el: HTMLTextAreaElement | null) => {
    if (el === null) {
      refLog.push('null')
      return
    }
    refLog.push('setup')
    return () => {
      refLog.push('cleanup')
    }
  }, [])
  return (
    <html.div style={stackStyles.stack}>
      {shown ? (
        <Textarea
          placeholder="Ref cleanup"
          ref={callerRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      ) : null}
      <Button onClick={() => setValue('second')}>Change value</Button>
      <Button onClick={() => setShown(false)}>Unmount</Button>
    </html.div>
  )
}

/**
 * A caller's callback ref that returns a cleanup (React 19) gets it run when
 * the field goes away, and only then: a value update re-attaches nothing.
 */
export const RefCleanup: Story = {
  render: () => <RefCleanupHarness />,
  play: async ({canvas, userEvent}) => {
    const field = canvas.getByPlaceholderText('Ref cleanup')
    await expect(refLog).toEqual(['setup'])

    await userEvent.click(canvas.getByRole('button', {name: 'Change value'}))
    await expect(field).toHaveValue('second')
    await expect(refLog).toEqual(['setup'])

    await userEvent.click(canvas.getByRole('button', {name: 'Unmount'}))
    await waitFor(() => expect(canvas.queryByPlaceholderText('Ref cleanup')).toBeNull())
    await expect(refLog).toEqual(['setup', 'cleanup'])
  },
}
