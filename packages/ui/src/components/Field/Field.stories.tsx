import type {Meta, StoryObj} from '@storybook/react'
import {useState} from 'react'
import {Schema} from 'effect'
import {expect, fn, waitFor, within} from 'storybook/test'
import {css, html} from 'react-strict-dom'
import {Field} from './Field'
import {Input} from '../Input/Input'
import {Textarea} from '../Textarea/Textarea'
import {Select} from '../Select/Select'
import {Combobox} from '../Combobox/Combobox'
import {Button} from '../Button/Button'
import {Form} from '../Form/Form'
import {ToggleGroup} from '../ToggleGroup/ToggleGroup'
import {Toggle} from '../Toggle/Toggle'
import {CheckboxGroup} from '../CheckboxGroup/CheckboxGroup'
import {RadioGroup} from '../RadioGroup/RadioGroup'
import {Checkbox} from '../Checkbox/Checkbox'
import {Stack} from '../Stack/Stack'
import {Inline} from '../Inline/Inline'
import {Fieldset} from '../Fieldset/Fieldset'
import {Popover} from '../Popover/Popover'
import {spacing} from '@greenharness/greenrack-tokens/tokens/spacing.css'
import {sizes} from '@greenharness/greenrack-tokens/tokens/sizes.css'
import {typeScale} from '@greenharness/greenrack-tokens/tokens/typography.css'

const meta: Meta = {
  title: 'Components/Field',
  argTypes: {
    invalid: {
      control: 'boolean',
      description: 'Whether the field is in an invalid/error state',
    },
  },
}

export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => (
    <Field.Root>
      <Field.Label>Username</Field.Label>
      <Input placeholder="Enter username" />
      <Field.Description>3-32 characters, letters and numbers only.</Field.Description>
    </Field.Root>
  ),
  play: async ({canvas}) => {
    // Label is associated with input via htmlFor/id
    const input = canvas.getByPlaceholderText('Enter username')
    await expect(input).toBeInTheDocument()

    const label = canvas.getByText('Username')
    await expect(label).toBeInTheDocument()
    await expect(label.tagName).toBe('LABEL')

    // Description text is present
    await expect(canvas.getByText('3-32 characters, letters and numbers only.')).toBeInTheDocument()

    // Input should reference description via aria-describedby
    await expect(input).toHaveAttribute('aria-describedby')
  },
}

export const WithError: Story = {
  render: () => (
    <Field.Root invalid>
      <Field.Label>Email</Field.Label>
      <Input variant="error" placeholder="Enter email" />
      <Field.Error>Please enter a valid email address.</Field.Error>
    </Field.Root>
  ),
  play: async ({canvas}) => {
    const input = canvas.getByPlaceholderText('Enter email')
    await expect(input).toHaveAttribute('aria-invalid', 'true')

    // Error message with alert role
    const error = canvas.getByRole('alert')
    await expect(error).toBeInTheDocument()
    await expect(error).toHaveTextContent('Please enter a valid email address.')
  },
}

// Every control in a Field names only ids that are mounted (follow-up f04).
function expectNoDanglingDescribedBy(element: HTMLElement) {
  const ids = element.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? []
  for (const id of ids) expect(document.getElementById(id)).not.toBeNull()
}

function DescribedControls({invalid}: {invalid?: boolean}) {
  return (
    <Stack gap="md">
      <Field.Root invalid={invalid}>
        <Field.Label>Name</Field.Label>
        <Input placeholder="Name" />
      </Field.Root>
      <Field.Root invalid={invalid}>
        <Field.Label>Bio</Field.Label>
        <Textarea placeholder="Bio" />
      </Field.Root>
      <Field.Root invalid={invalid}>
        <Field.Label>Language</Field.Label>
        <Select.Root defaultValue="en">
          <Select.Trigger>
            <Select.Value />
            <Select.Icon />
          </Select.Trigger>
          <Select.Popup>
            <Select.Item value="en">
              <Select.ItemText>English</Select.ItemText>
            </Select.Item>
          </Select.Popup>
        </Select.Root>
      </Field.Root>
      <Field.Root invalid={invalid}>
        <Field.Label>Fruit</Field.Label>
        <Combobox.Root>
          <Combobox.Input />
          <Combobox.Popup label="Fruit">
            <Combobox.Item value="apple">
              <Combobox.ItemText>Apple</Combobox.ItemText>
            </Combobox.Item>
          </Combobox.Popup>
        </Combobox.Root>
      </Field.Root>
      <Field.Root invalid={invalid}>
        <Field.Label>Plan</Field.Label>
        <RadioGroup.Root defaultValue="free">
          <RadioGroup.Item value="free">Free</RadioGroup.Item>
        </RadioGroup.Root>
      </Field.Root>
    </Stack>
  )
}

async function expectControlsDescribedByNothing(canvas: {
  getByPlaceholderText: (text: string) => HTMLElement
  getByRole: (role: string, options: {name: string}) => HTMLElement
}) {
  const controls = [
    canvas.getByPlaceholderText('Name'),
    canvas.getByPlaceholderText('Bio'),
    canvas.getByRole('combobox', {name: 'Language'}),
    canvas.getByRole('combobox', {name: 'Fruit'}),
    canvas.getByRole('radiogroup', {name: 'Plan'}),
  ]
  for (const control of controls) {
    expectNoDanglingDescribedBy(control)
    await expect(control).not.toHaveAttribute('aria-describedby')
  }
}

export const WithoutDescriptionDescribesNothing: Story = {
  render: () => <DescribedControls />,
  play: async ({canvas}) => {
    await expectControlsDescribedByNothing(canvas)
  },
}

export const InvalidWithoutErrorDescribesNothing: Story = {
  render: () => <DescribedControls invalid />,
  play: async ({canvas}) => {
    await expect(canvas.getByPlaceholderText('Name')).toHaveAttribute('aria-invalid', 'true')
    await expectControlsDescribedByNothing(canvas)
  },
}

function DescriptionMounts() {
  const [shown, setShown] = useState(true)
  return (
    <Stack gap="md">
      <Field.Root invalid>
        <Field.Label>Handle</Field.Label>
        <Input placeholder="Handle" />
        {shown && <Field.Description>Letters and numbers only.</Field.Description>}
        <Field.Error>Choose another handle.</Field.Error>
      </Field.Root>
      <Button onClick={() => setShown(false)}>Hide description</Button>
    </Stack>
  )
}

export const DescribedByFollowsMountedParts: Story = {
  render: () => <DescriptionMounts />,
  play: async ({canvas, userEvent}) => {
    const input = canvas.getByPlaceholderText('Handle')
    await expect(input).toHaveAccessibleDescription(
      'Letters and numbers only. Choose another handle.',
    )
    await userEvent.click(canvas.getByRole('button', {name: 'Hide description'}))
    await waitFor(() => expect(input).toHaveAccessibleDescription('Choose another handle.'))
    expectNoDanglingDescribedBy(input)
  },
}

const stackStyles = css.create({
  stack: {display: 'flex', flexDirection: 'column', gap: spacing.md, maxWidth: sizes.dialogSm},
  stackWide: {display: 'flex', flexDirection: 'column', gap: spacing.md, maxWidth: sizes.pageSm},
})

export const FormExample: Story = {
  render: () => (
    <html.div style={stackStyles.stack}>
      <Field.Root>
        <Field.Label>Username</Field.Label>
        <Input placeholder="johndoe" />
        <Field.Description>Must be unique.</Field.Description>
      </Field.Root>
      <Field.Root>
        <Field.Label>Password</Field.Label>
        <Input type="password" placeholder="At least 12 characters" />
        <Field.Description>Minimum 12 characters.</Field.Description>
      </Field.Root>
      <Field.Root invalid>
        <Field.Label>Confirm Password</Field.Label>
        <Input type="password" variant="error" />
        <Field.Error>Passwords do not match.</Field.Error>
      </Field.Root>
    </html.div>
  ),
  play: async ({canvas}) => {
    // All labels rendered
    await expect(canvas.getByText('Username')).toBeInTheDocument()
    await expect(canvas.getByText('Password')).toBeInTheDocument()
    await expect(canvas.getByText('Confirm Password')).toBeInTheDocument()

    // Error field has alert
    const alert = canvas.getByRole('alert')
    await expect(alert).toHaveTextContent('Passwords do not match.')
  },
}

export const WithNecessityIcon: Story = {
  name: 'With necessity indicator (standalone)',
  render: () => (
    <html.div style={stackStyles.stack}>
      <Field.Root required>
        <Field.Label>Email</Field.Label>
        <Input placeholder="you@example.com" />
        <Field.Description>
          Required field with no Form context — indicator needs Form.
        </Field.Description>
      </Field.Root>
    </html.div>
  ),
  play: async ({canvas}) => {
    // Without Form context, no indicator shows (necessityIndicator comes from Form)
    const label = canvas.getByText('Email')
    await expect(label).toBeInTheDocument()
  },
}

export const LabelSide: Story = {
  name: 'Label position — side (standalone)',
  render: () => (
    <html.div style={stackStyles.stackWide}>
      <Field.Root labelPosition="side">
        <Field.Label>Username</Field.Label>
        <Input placeholder="Enter username" />
        <Field.Description>3-32 characters, letters and numbers only.</Field.Description>
      </Field.Root>

      <Field.Root labelPosition="side" invalid>
        <Field.Label>Email</Field.Label>
        <Input variant="error" placeholder="Enter email" />
        <Field.Error>Please enter a valid email address.</Field.Error>
      </Field.Root>
    </html.div>
  ),
  play: async ({canvas}) => {
    await expect(canvas.getByPlaceholderText('Enter username')).toBeInTheDocument()
    await expect(canvas.getByPlaceholderText('Enter email')).toBeInTheDocument()
    await expect(canvas.getByRole('alert')).toHaveTextContent('Please enter a valid email address.')
  },
}

export const Disabled: Story = {
  name: 'Disabled field (standalone)',
  render: () => (
    <html.div style={stackStyles.stack}>
      <Field.Root disabled>
        <Field.Label>Username</Field.Label>
        <Input placeholder="Enter username" />
        <Field.Description>This field is disabled.</Field.Description>
      </Field.Root>
    </html.div>
  ),
  play: async ({canvas}) => {
    const input = canvas.getByPlaceholderText('Enter username')
    await expect(input).toBeDisabled()
  },
}

export const GroupControls: Story = {
  name: 'Group controls named by the label',
  render: () => (
    <html.div style={stackStyles.stack}>
      {/* a direct ToggleGroup / CheckboxGroup / RadioGroup child is detected */}
      <Field.Root>
        <Field.Label>Type</Field.Label>
        <ToggleGroup defaultValue={['app']}>
          <Toggle value="app">Application</Toggle>
          <Toggle value="platform">Platform</Toggle>
        </ToggleGroup>
        <Field.Description>What the record describes.</Field.Description>
      </Field.Root>
      <Field.Root>
        <Field.Label>Channels</Field.Label>
        <CheckboxGroup.Root defaultValue={['mail']}>
          <CheckboxGroup.Item value="mail">Mail</CheckboxGroup.Item>
          <CheckboxGroup.Item value="sms">SMS</CheckboxGroup.Item>
        </CheckboxGroup.Root>
      </Field.Root>
      <Field.Root>
        <Field.Label>Plan</Field.Label>
        <RadioGroup.Root defaultValue="free">
          <RadioGroup.Item value="free">Free</RadioGroup.Item>
          <RadioGroup.Item value="pro">Pro</RadioGroup.Item>
        </RadioGroup.Root>
      </Field.Root>
      {/* a group that is not a direct child (here inside a Stack) says so */}
      <Field.Root group>
        <Field.Label>Technologies</Field.Label>
        <Stack gap="sm">
          <CheckboxGroup.Root orientation="horizontal">
            <CheckboxGroup.Item value="pg">PostgreSQL</CheckboxGroup.Item>
            <CheckboxGroup.Item value="kafka">Kafka</CheckboxGroup.Item>
          </CheckboxGroup.Root>
        </Stack>
      </Field.Root>
    </html.div>
  ),
  play: async ({canvas}) => {
    // each group control carries the Field.Label's text as its accessible name
    await expect(canvas.getByRole('toolbar', {name: 'Type'})).toBeInTheDocument()
    await expect(canvas.getByRole('group', {name: 'Channels'})).toBeInTheDocument()
    await expect(canvas.getByRole('radiogroup', {name: 'Plan'})).toBeInTheDocument()
    await expect(canvas.getByRole('group', {name: 'Technologies'})).toBeInTheDocument()
    // the description reaches the group too
    await expect(canvas.getByRole('toolbar', {name: 'Type'})).toHaveAccessibleDescription(
      'What the record describes.',
    )
    // a group's label is not a <label for> pointing at nothing
    for (const text of ['Type', 'Channels', 'Plan', 'Technologies']) {
      const label = canvas.getByText(text)
      await expect(label.tagName).not.toBe('LABEL')
      await expect(label.id).not.toBe('')
    }
  },
}

export const SingleControlStillLabelled: Story = {
  name: 'A single input keeps its <label for>',
  render: () => (
    <Field.Root>
      <Field.Label>Name</Field.Label>
      <Input placeholder="Name" />
    </Field.Root>
  ),
  play: async ({canvas}) => {
    const label = canvas.getByText('Name')
    await expect(label.tagName).toBe('LABEL')
    await expect(canvas.getByRole('textbox', {name: 'Name'})).toBeInTheDocument()
  },
}

export const FieldsetLegendNamesTheGroup: Story = {
  name: 'Fieldset legend names its group',
  render: () => (
    <Fieldset.Root>
      <Fieldset.Legend>Notifications</Fieldset.Legend>
      <Checkbox value="a">Weekly digest</Checkbox>
    </Fieldset.Root>
  ),
  play: async ({canvas}) => {
    await expect(canvas.getByRole('group', {name: 'Notifications'})).toBeInTheDocument()
  },
}

export const NativeValidation: Story = {
  render: () => (
    <html.form>
      <Field.Root>
        <Field.Label>Website</Field.Label>
        <Input type="url" required placeholder="https://example.com" />
        <Field.Error />
      </Field.Root>
      <Button type="submit">Submit</Button>
    </html.form>
  ),
  play: async ({canvas, userEvent}) => {
    const input = canvas.getByPlaceholderText('https://example.com') as HTMLInputElement
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}))
    const alert = await canvas.findByRole('alert')
    await expect(alert).toBeInTheDocument()
    await expect(alert.textContent).not.toBe('')
    await expect(alert.textContent).toBe(input.validationMessage)
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(input.getAttribute('aria-describedby')).toContain(alert.id)

    await userEvent.type(input, 'https://example.com')
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument()
  },
}

const websitePlaceholder = 'https://example.com'

export const NativeValidationWithoutFieldError: Story = {
  render: () => (
    <html.form>
      <Field.Root>
        <Field.Label>Website</Field.Label>
        <Input type="url" required placeholder={websitePlaceholder} />
      </Field.Root>
      <Button type="submit">Submit</Button>
    </html.form>
  ),
  play: async ({canvas, userEvent}) => {
    const input = canvas.getByPlaceholderText(websitePlaceholder) as HTMLInputElement
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}))
    const alert = await canvas.findByRole('alert')
    await expect(canvas.getAllByRole('alert')).toHaveLength(1)
    await expect(alert.textContent).toBe(input.validationMessage)
    await expect(input.getAttribute('aria-describedby')).toContain(alert.id)
    // The reason changes ("fill out" becomes "enter a URL"): the line clears
    // rather than rewriting the alert, which would announce it again.
    await userEvent.type(input, 'n')
    await waitFor(() => expect(canvas.queryByRole('alert')).not.toBeInTheDocument())
  },
}

function ErrorMounts() {
  const [mounted, setMounted] = useState(false)
  return (
    <html.form>
      <Field.Root>
        <Field.Label>Website</Field.Label>
        <Input type="url" required placeholder={websitePlaceholder} />
        {mounted ? <Field.Error /> : null}
      </Field.Root>
      <Button type="submit">Submit</Button>
      <Button type="button" onClick={() => setMounted((previous) => !previous)}>
        Toggle error
      </Button>
    </html.form>
  )
}

export const NativeValidationErrorMounts: Story = {
  render: () => <ErrorMounts />,
  play: async ({canvas, canvasElement, userEvent}) => {
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}))
    await canvas.findByRole('alert')
    // Count alerts at each mutation batch: never two after any toggle settles.
    let most = 0
    const observer = new MutationObserver(() => {
      most = Math.max(most, canvasElement.querySelectorAll('[role="alert"]').length)
    })
    observer.observe(canvasElement, {childList: true, subtree: true})
    const toggle = canvas.getByRole('button', {name: 'Toggle error'})
    try {
      await userEvent.click(toggle)
      await waitFor(() => expect(canvas.getAllByRole('alert')).toHaveLength(1))
      await userEvent.click(toggle)
      await waitFor(() => expect(canvas.getAllByRole('alert')).toHaveLength(1))
    } finally {
      observer.disconnect()
    }
    await expect(most).toBeLessThanOrEqual(1)
  },
}

function ProgrammaticClear() {
  const [text, setText] = useState('')
  return (
    <html.form>
      <Field.Root>
        <Field.Label>Website</Field.Label>
        <Input
          type="url"
          placeholder={websitePlaceholder}
          value={text}
          onChange={(event: {currentTarget: {value: string}}) => setText(event.currentTarget.value)}
        />
        <Field.Error />
      </Field.Root>
      <Button type="submit">Submit</Button>
      <Button type="button" onClick={() => setText('')}>
        Clear value
      </Button>
    </html.form>
  )
}

export const NativeValidationProgrammaticClear: Story = {
  render: () => <ProgrammaticClear />,
  play: async ({canvas, userEvent}) => {
    const input = canvas.getByLabelText('Website') as HTMLInputElement
    await userEvent.type(input, 'nope')
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}))
    await canvas.findByRole('alert')
    // The value changes to '' with no input event: the message must go.
    await userEvent.click(canvas.getByRole('button', {name: 'Clear value'}))
    await waitFor(() => expect(canvas.queryByRole('alert')).not.toBeInTheDocument())
  },
}

export const NativeValidationFormReset: Story = {
  render: () => (
    <html.form>
      <Field.Root>
        <Field.Label>Website</Field.Label>
        <Input type="url" required placeholder={websitePlaceholder} />
      </Field.Root>
      <Button type="submit">Submit</Button>
    </html.form>
  ),
  play: async ({canvas, userEvent}) => {
    const input = canvas.getByPlaceholderText(websitePlaceholder) as HTMLInputElement
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}))
    await canvas.findByRole('alert')
    // react-strict-dom keeps no type="reset" on a button; reset the form itself.
    input.form?.reset()
    await waitFor(() => expect(canvas.queryByRole('alert')).not.toBeInTheDocument())
    await expect(input).not.toHaveAttribute('aria-invalid')
  },
}

function ConstraintChange() {
  const [required, setRequired] = useState(true)
  return (
    <html.form>
      <Field.Root>
        <Field.Label>Name</Field.Label>
        <Input required={required} placeholder="Jane Doe" />
      </Field.Root>
      <Button type="submit">Submit</Button>
      <Button type="button" onClick={() => setRequired(false)}>
        Not required
      </Button>
    </html.form>
  )
}

export const NativeValidationConstraintChange: Story = {
  render: () => <ConstraintChange />,
  play: async ({canvas, userEvent}) => {
    const input = canvas.getByLabelText('Name')
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}))
    await canvas.findByRole('alert')
    await userEvent.click(canvas.getByRole('button', {name: 'Not required'}))
    await waitFor(() => expect(canvas.queryByRole('alert')).not.toBeInTheDocument())
    await expect(input).not.toHaveAttribute('aria-invalid')
  },
}

export const NativeValidationDefaultValue: Story = {
  render: () => (
    <html.form>
      <Field.Root>
        <Field.Label>Website</Field.Label>
        <Input type="url" defaultValue="nope" placeholder={websitePlaceholder} />
      </Field.Root>
      <Button type="submit">Submit</Button>
    </html.form>
  ),
  play: async ({canvas, userEvent}) => {
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}))
    const alert = await canvas.findByRole('alert')
    // Let the commit after the invalid event run its effects (two frames, no
    // wall clock): a value no input event set must not read as a change.
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)
    await expect(canvas.getAllByRole('alert')).toHaveLength(1)
    await expect(alert.textContent).toBe(
      (canvas.getByLabelText('Website') as HTMLInputElement).validationMessage,
    )
  },
}

const nativeFormSchema = Schema.Struct({name: Schema.String})

export const NativeValidationInForm: Story = {
  render: () => {
    const onSubmit = fn()
    return (
      <Form schema={nativeFormSchema} defaultValues={{name: ''}} onSubmit={onSubmit}>
        {(methods) => (
          <>
            <Field.Root name="name">
              <Field.Label>Name</Field.Label>
              <Input required placeholder="Jane Doe" />
            </Field.Root>
            <Button type="submit">Submit</Button>
            <Button
              type="button"
              onClick={() => methods.setError('name', {type: 'server', message: 'Taken'})}
            >
              Set error
            </Button>
            <Button type="button" onClick={() => methods.clearErrors('name')}>
              Clear errors
            </Button>
          </>
        )}
      </Form>
    )
  },
  play: async ({canvas, userEvent}) => {
    const input = canvas.getByLabelText('Name') as HTMLInputElement
    await userEvent.click(canvas.getByRole('button', {name: 'Submit'}))
    const alert = await canvas.findByRole('alert')
    await expect(alert.textContent).toBe(input.validationMessage)
    // Blur first: the blur runs the resolver, which would clear a server error
    // set in the same click.
    await userEvent.tab()
    await userEvent.click(canvas.getByRole('button', {name: 'Set error'}))
    await waitFor(() => expect(canvas.getByRole('alert').textContent).toBe('Taken'))
    await expect(canvas.getAllByRole('alert')).toHaveLength(1)
    await userEvent.click(canvas.getByRole('button', {name: 'Clear errors'}))
    await waitFor(() => expect(canvas.getByRole('alert').textContent).toBe(input.validationMessage))
    await expect(canvas.getAllByRole('alert')).toHaveLength(1)
  },
}

// --- A row of Fields and a button, aligned on the inputs ---

const rowStyles = css.create({
  // The room one hanging error line takes under the row.
  // One error line, scaling with the text: the web form of sizes.fieldErrorReserve.
  reserve: {paddingBottom: `calc(${typeScale.lineHeight1} + ${spacing.xs})`},
  // As wide as the page lets it, never past the viewport.
  frame: {width: '100%', maxWidth: sizes.pageXs},
  narrow: {width: sizes.fieldMinWSm},
  // A phone: the row wraps in it, and nothing may scroll sideways.
  phone: {width: sizes.panelSm},
})

function bottomSpread(canvas: ReturnType<typeof within>) {
  const bottoms = [
    ...canvas.getAllByRole('textbox'),
    canvas.getByRole('button', {name: 'Mark posted'}),
  ].map((element) => element.getBoundingClientRect().bottom)
  return Math.max(...bottoms) - Math.min(...bottoms)
}

/** The Date input and the button sit on one line (a Field.Row wraps when the
 *  page is narrow), and then they are aligned on their bottoms. */
function expectAlignedWhenOnOneLine(canvas: ReturnType<typeof within>) {
  const input = canvas.getAllByRole('textbox')[0].getBoundingClientRect()
  const button = canvas.getByRole('button', {name: 'Mark posted'}).getBoundingClientRect()
  if (button.top < input.bottom)
    expect(Math.abs(button.bottom - input.bottom)).toBeLessThanOrEqual(0.5)
}

/** No story or row scrolls the page sideways. */
function expectNoHorizontalOverflow() {
  const root = document.documentElement
  expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth)
}

function InlineRow({
  errorPlacement,
  message = 'Required',
}: {
  errorPlacement: 'below' | 'hanging'
  message?: string
}) {
  const [invalid, setInvalid] = useState(false)
  return (
    <html.div style={rowStyles.frame}>
      <html.div style={errorPlacement === 'hanging' && rowStyles.reserve}>
        <Inline gap="sm" align="end">
          <Field.Root invalid={invalid} errorPlacement={errorPlacement}>
            <Field.Label>Date</Field.Label>
            <Input placeholder="2026-11-24" />
            {invalid && <Field.Error>{message}</Field.Error>}
          </Field.Root>
          <Button>Mark posted</Button>
        </Inline>
      </html.div>
      <html.p>Next row</html.p>
      <Button variant="secondary" onClick={() => setInvalid((value) => !value)}>
        Toggle error
      </Button>
    </html.div>
  )
}

/** `errorPlacement="hanging"`: the error line sits under the control, out of the
 *  Field's flow, so the inputs and the button stay on one line with or without it.
 *  For one short line; a row whose messages can wrap is a `Field.Row`. */
export const InlineRowWithError: Story = {
  render: () => <InlineRow errorPlacement="hanging" />,
  play: async ({canvas, userEvent}) => {
    await expect(bottomSpread(canvas)).toBeLessThanOrEqual(0.5)
    await userEvent.click(canvas.getByRole('button', {name: 'Toggle error'}))
    const alert = await canvas.findByRole('alert')
    await expect(alert).toBeVisible()
    const input = canvas.getAllByRole('textbox')[0]
    await expect(input.getAttribute('aria-describedby')).toContain(alert.id)
    await waitFor(() => expect(bottomSpread(canvas)).toBeLessThanOrEqual(0.5))
    // Under its input, and clear of the next row.
    const box = alert.getBoundingClientRect()
    await expect(box.top).toBeGreaterThanOrEqual(input.getBoundingClientRect().bottom)
    await expect(box.bottom).toBeLessThanOrEqual(
      canvas.getByText('Next row').getBoundingClientRect().top + 0.5,
    )
    expectNoHorizontalOverflow()
    await userEvent.click(canvas.getByRole('button', {name: 'Toggle error'}))
    await waitFor(() => expect(canvas.queryByRole('alert')).not.toBeInTheDocument())
    await waitFor(() => expect(bottomSpread(canvas)).toBeLessThanOrEqual(0.5))
  },
}

/** The default `errorPlacement="below"`: the error line is in the Field's flow,
 *  so the Field grows and its input lifts above the others. The contrast that
 *  shows the test above can fail. */
export const InlineRowWithErrorBelow: Story = {
  render: () => <InlineRow errorPlacement="below" />,
  play: async ({canvas, userEvent}) => {
    await expect(bottomSpread(canvas)).toBeLessThanOrEqual(0.5)
    await userEvent.click(canvas.getByRole('button', {name: 'Toggle error'}))
    await canvas.findByRole('alert')
    await waitFor(() => expect(bottomSpread(canvas)).toBeGreaterThan(10))
  },
}

/** With the label at the side the error hangs under the control, not the label,
 *  and the Field fits the viewport. */
export const HangingErrorSideLabel: Story = {
  render: () => (
    <html.div style={rowStyles.frame}>
      <Field.Root invalid labelPosition="side" errorPlacement="hanging">
        <Field.Label>Date</Field.Label>
        <Input placeholder="2026-11-24" />
        <Field.Error>Required</Field.Error>
      </Field.Root>
    </html.div>
  ),
  play: async ({canvas}) => {
    const alert = await canvas.findByRole('alert')
    const input = canvas.getByRole('textbox')
    await expect(
      Math.abs(alert.getBoundingClientRect().left - input.getBoundingClientRect().left),
    ).toBeLessThanOrEqual(0.5)
    await expect(alert.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      input.getBoundingClientRect().bottom,
    )
    expectNoHorizontalOverflow()
    await expect(input.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth)
  },
}

// --- Field.Row: a row's errors in one line under the whole row ---

function RowDemo({
  dateMessage = 'Enter a date',
  timeMessage = 'Enter a time',
  frame = rowStyles.frame,
}: {
  dateMessage?: string
  timeMessage?: string
  frame?: typeof rowStyles.frame | typeof rowStyles.phone
}) {
  const [date, setDate] = useState(false)
  const [time, setTime] = useState(false)
  return (
    <html.div style={frame}>
      <Field.Row>
        <Field.Root invalid={date}>
          <Field.Label>Date</Field.Label>
          <Input placeholder="2026-11-24" />
          <Field.Error>{dateMessage}</Field.Error>
        </Field.Root>
        <Field.Root invalid={time}>
          <Field.Label>Time</Field.Label>
          <Input placeholder="09:30" />
          <Field.Error>{timeMessage}</Field.Error>
        </Field.Root>
        <Button>Mark posted</Button>
      </Field.Row>
      <html.p>Next row</html.p>
      <Button variant="secondary" onClick={() => setDate((value) => !value)}>
        Toggle date
      </Button>
      <Button variant="secondary" onClick={() => setTime((value) => !value)}>
        Toggle time
      </Button>
    </html.div>
  )
}

/** The row's line: a region mounted from the start, empty until an error. */
function rowLine(canvas: ReturnType<typeof within>) {
  const line = canvas
    .getAllByRole('alert')
    .find((alert: HTMLElement) => alert.ariaAtomic === 'false')
  if (!line) throw new Error('no row line')
  return line
}

/** `Field.Row`: each error shows in one line under the whole row, led by its
 *  field's name, in the row's own flow. The inputs and the button never move,
 *  nothing is covered, and the control's `aria-describedby` names its message. */
export const RowErrorsOneLine: Story = {
  render: () => <RowDemo />,
  play: async ({canvas, userEvent}) => {
    await expect(rowLine(canvas)).toBeEmptyDOMElement()
    expectAlignedWhenOnOneLine(canvas)
    const [dateInput] = canvas.getAllByRole('textbox')
    const before = dateInput.getBoundingClientRect().top
    await userEvent.click(canvas.getByRole('button', {name: 'Toggle date'}))
    await waitFor(() => expect(rowLine(canvas).textContent?.trim()).toBe('Date: Enter a date.'))
    // The message is the element the input describes, once.
    const id = dateInput.getAttribute('aria-describedby')
    await expect(id).toBeTruthy()
    await expect(document.querySelectorAll(`[id="${id}"]`)).toHaveLength(1)
    await expect(document.getElementById(id as string)?.textContent?.trim()).toBe(
      'Date: Enter a date.',
    )
    await expect(dateInput).toBeInvalid()
    // Nothing moved; the line is under the row and clear of what follows.
    await expect(dateInput.getBoundingClientRect().top).toBe(before)
    expectAlignedWhenOnOneLine(canvas)
    const line = rowLine(canvas).getBoundingClientRect()
    await expect(line.top).toBeGreaterThanOrEqual(
      canvas.getByRole('button', {name: 'Mark posted'}).getBoundingClientRect().bottom,
    )
    await expect(line.bottom).toBeLessThanOrEqual(
      canvas.getByText('Next row').getBoundingClientRect().top + 0.5,
    )
    expectNoHorizontalOverflow()
    await userEvent.click(canvas.getByRole('button', {name: 'Toggle date'}))
    await waitFor(() => expect(rowLine(canvas)).toBeEmptyDOMElement())
    await expect(dateInput.getAttribute('aria-describedby')).toBeNull()
  },
}

/** A second error joins the line without rewriting the first message (which a
 *  live region would read again), in the order the Fields sit, whichever erred
 *  first. */
export const RowSecondErrorJoinsLine: Story = {
  render: () => <RowDemo />,
  play: async ({canvas, userEvent}) => {
    await userEvent.click(canvas.getByRole('button', {name: 'Toggle time'}))
    await waitFor(() => expect(rowLine(canvas).textContent?.trim()).toBe('Time: Enter a time.'))
    const timeSpan = rowLine(canvas).firstElementChild
    await userEvent.click(canvas.getByRole('button', {name: 'Toggle date'}))
    await waitFor(() =>
      expect(rowLine(canvas).textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Date: Enter a date. Time: Enter a time.',
      ),
    )
    // The first message is the same node, in place; the line announces only changes.
    await expect(rowLine(canvas).lastElementChild).toBe(timeSpan)
    await expect(rowLine(canvas).getAttribute('aria-atomic')).toBe('false')
  },
}

/** A long message wraps inside the row's width, below the row, and covers nothing:
 *  the case `hanging` could not hold. At 390 the controls wrap and the page does
 *  not scroll sideways. */
export const RowLongMessage: Story = {
  render: () => (
    <RowDemo
      frame={rowStyles.phone}
      dateMessage="Enter the date the post went out, as year-month-day, for example 2026-11-24, and the time it went out, as hours and minutes on the 24-hour clock."
    />
  ),
  play: async ({canvas, userEvent}) => {
    await userEvent.click(canvas.getByRole('button', {name: 'Toggle date'}))
    await waitFor(() => expect(rowLine(canvas).textContent).toContain('Date: Enter the date'))
    const line = rowLine(canvas).getBoundingClientRect()
    await expect(line.height).toBeGreaterThan(24)
    await expect(line.bottom).toBeLessThanOrEqual(
      canvas.getByText('Next row').getBoundingClientRect().top + 0.5,
    )
    // In a phone-wide frame the controls wrap, the line stays inside the frame, and
    // the frame does not scroll sideways.
    const frame = canvas.getByText('Next row').parentElement as HTMLElement
    await expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth)
    await expect(line.right).toBeLessThanOrEqual(frame.getBoundingClientRect().right + 0.5)
    expectNoHorizontalOverflow()
  },
}

/** The browser's own message, shown by the Field itself (no `Field.Error`), in a
 *  narrow Field: in the row's line, in full, covering nothing. */
export const RowNativeMessage: Story = {
  render: () => (
    <html.form>
      <Field.Row>
        <html.div style={rowStyles.narrow}>
          <Field.Root>
            <Field.Label>Date</Field.Label>
            <Input required placeholder="2026-11-24" />
          </Field.Root>
        </html.div>
        <Button type="submit">Mark posted</Button>
      </Field.Row>
      <html.p>Next row</html.p>
    </html.form>
  ),
  play: async ({canvas, userEvent}) => {
    const input = canvas.getByRole('textbox') as HTMLInputElement
    await userEvent.click(canvas.getByRole('button', {name: 'Mark posted'}))
    await waitFor(() =>
      expect(rowLine(canvas).textContent?.trim()).toBe(`Date: ${input.validationMessage}`),
    )
    await expect(input.getAttribute('aria-describedby')).toBe(rowLine(canvas).firstElementChild?.id)
    await expect(rowLine(canvas).getBoundingClientRect().bottom).toBeLessThanOrEqual(
      canvas.getByText('Next row').getBoundingClientRect().top + 0.5,
    )
    await expect(canvas.getByRole('textbox')).toHaveFocus()
    expectNoHorizontalOverflow()
  },
}

/** The default placement, for contrast with a row: the error line is in the
 *  Field's flow. It overlaps nothing, the control above it stays where it was,
 *  and what follows moves down by the line. */
export const ErrorInFlowOverlapsNothing: Story = {
  render: () => {
    function Demo() {
      const [invalid, setInvalid] = useState(false)
      return (
        <html.div style={rowStyles.frame}>
          <Field.Root invalid={invalid}>
            <Field.Label>Date</Field.Label>
            <Input placeholder="2026-11-24" />
            {invalid && <Field.Error>Enter a date</Field.Error>}
          </Field.Root>
          <html.p>Next row</html.p>
          <Button variant="secondary" onClick={() => setInvalid((value) => !value)}>
            Toggle error
          </Button>
        </html.div>
      )
    }
    return <Demo />
  },
  play: async ({canvas, userEvent}) => {
    const input = canvas.getByRole('textbox')
    const next = canvas.getByText('Next row')
    const inputTop = input.getBoundingClientRect().top
    const nextTop = next.getBoundingClientRect().top
    await userEvent.click(canvas.getByRole('button', {name: 'Toggle error'}))
    const alert = await canvas.findByRole('alert')
    await expect(input.getBoundingClientRect().top).toBe(inputTop)
    await expect(alert.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      input.getBoundingClientRect().bottom,
    )
    await expect(alert.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      next.getBoundingClientRect().top + 0.5,
    )
    await expect(next.getBoundingClientRect().top).toBeGreaterThan(nextTop)
    await expect(input).toHaveAccessibleDescription('Enter a date')
  },
}

/** A Field named only by its control's `aria-label` (no `Field.Label`) still
 *  leads its message with that name in the row's line. */
export const RowFieldNamedByAriaLabel: Story = {
  render: () => (
    <html.div style={rowStyles.frame}>
      <Field.Row>
        <Field.Root invalid>
          <Input aria-label="Date" placeholder="2026-11-24" />
          <Field.Error>Enter a date</Field.Error>
        </Field.Root>
        <Button>Mark posted</Button>
      </Field.Row>
    </html.div>
  ),
  play: async ({canvas}) => {
    await waitFor(() => expect(rowLine(canvas).textContent?.trim()).toBe('Date: Enter a date.'))
  },
}

/** A Field in the popup of a Popover opened from the row reads the row through
 *  the portal but is not in it: its error stays in the popup, and the row's line
 *  stays empty. */
export const RowPopoverFieldKeepsOwnError: Story = {
  render: () => (
    <html.div style={rowStyles.frame}>
      <Field.Row>
        <Popover.Root>
          <Popover.Trigger>Add note</Popover.Trigger>
          <Popover.Popup label="Add note">
            <Field.Root invalid>
              <Field.Label>Note</Field.Label>
              <Input placeholder="A note" />
              <Field.Error>Enter a note</Field.Error>
            </Field.Root>
          </Popover.Popup>
        </Popover.Root>
        <Button>Mark posted</Button>
      </Field.Row>
    </html.div>
  ),
  play: async ({canvas, userEvent}) => {
    await userEvent.click(canvas.getByRole('button', {name: 'Add note'}))
    const popup = within(await within(document.body).findByRole('dialog'))
    const message = await popup.findByText('Enter a note')
    await expect(message).toHaveAttribute('role', 'alert')
    await expect(rowLine(canvas)).toBeEmptyDOMElement()
  },
}
