import type {Meta, StoryObj} from '@storybook/react'
import {expect, fn} from 'storybook/test'
import {css, html} from 'react-strict-dom'
import {Checkbox} from './Checkbox'
import {Field} from '../Field/Field'
import {spacing} from '@greenharness/greenrack-tokens/tokens/spacing.css'

const meta: Meta<typeof Checkbox> = {
  title: 'Components/Checkbox',
  component: Checkbox,
  args: {
    onChange: fn(),
  },
  argTypes: {
    checked: {control: 'boolean'},
    disabled: {control: 'boolean'},
    defaultChecked: {control: 'boolean'},
  },
}

export default meta
type Story = StoryObj<typeof Checkbox>

export const Default: Story = {
  args: {children: 'Accept terms and conditions'},
  play: async ({canvas, userEvent, args}) => {
    const checkbox = canvas.getByRole('checkbox')
    await expect(checkbox).toBeInTheDocument()
    await expect(checkbox).toBeEnabled()
    // The hidden input is placed against its own label, never a page ancestor.
    await expect(checkbox.offsetParent).toBe(checkbox.closest('label'))

    await userEvent.click(checkbox)
    await expect(args.onChange).toHaveBeenCalledTimes(1)
  },
}

export const Checked: Story = {
  args: {defaultChecked: true, children: 'Already checked'},
  play: async ({canvas}) => {
    const checkbox = canvas.getByRole('checkbox')
    await expect(checkbox).toBeChecked()
  },
}

export const Disabled: Story = {
  args: {disabled: true, children: 'Disabled option'},
  play: async ({canvas, userEvent, args}) => {
    const checkbox = canvas.getByRole('checkbox')
    await expect(checkbox).toBeDisabled()

    await userEvent.click(checkbox)
    await expect(args.onChange).not.toHaveBeenCalled()
  },
}

export const DisabledChecked: Story = {
  args: {disabled: true, defaultChecked: true, children: 'Disabled checked'},
  play: async ({canvas}) => {
    const checkbox = canvas.getByRole('checkbox')
    await expect(checkbox).toBeDisabled()
    await expect(checkbox).toBeChecked()
  },
}

export const WithoutLabel: Story = {
  args: {name: 'solo'},
  play: async ({canvas}) => {
    await expect(canvas.getByRole('checkbox')).toBeInTheDocument()
  },
}

const stackStyles = css.create({
  stack: {display: 'flex', flexDirection: 'column', gap: spacing.ms},
})

export const AllVariants: Story = {
  render: () => (
    <html.div style={stackStyles.stack}>
      <Checkbox>Unchecked</Checkbox>
      <Checkbox defaultChecked>Checked</Checkbox>
      <Checkbox disabled>Disabled</Checkbox>
      <Checkbox disabled defaultChecked>
        Disabled checked
      </Checkbox>
    </html.div>
  ),
  play: async ({canvas}) => {
    const checkboxes = canvas.getAllByRole('checkbox')
    await expect(checkboxes.length).toBe(4)
  },
}

/** Inside a Field.Root with no children: Field.Label names the checkbox, and
 *  the Field's description and error describe it. */
export const InField: Story = {
  render: (args) => (
    <html.div style={stackStyles.stack}>
      <Field.Root invalid>
        <Field.Label>Accept the terms</Field.Label>
        <Checkbox onChange={args.onChange} />
        <Field.Description>You can withdraw at any time.</Field.Description>
        <Field.Error>Accept the terms to continue.</Field.Error>
      </Field.Root>
      <Field.Root disabled>
        <Field.Label>Locked</Field.Label>
        <Checkbox />
      </Field.Root>
    </html.div>
  ),
  play: async ({canvas, userEvent, args}) => {
    const checkbox = canvas.getByRole('checkbox', {name: 'Accept the terms'})
    await expect(checkbox).toHaveAccessibleDescription(
      'You can withdraw at any time. Accept the terms to continue.',
    )
    await expect(checkbox).toHaveAttribute('aria-invalid', 'true')
    // Clicking the Field.Label toggles it: its `for` reaches the input.
    await userEvent.click(canvas.getByText('Accept the terms'))
    await expect(checkbox).toBeChecked()
    await expect(args.onChange).toHaveBeenCalledTimes(1)

    await expect(canvas.getByRole('checkbox', {name: 'Locked'})).toBeDisabled()
  },
}
