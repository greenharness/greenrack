import type {Meta, StoryObj} from '@storybook/react'
import {expect, fn} from 'storybook/test'
import {css, html} from 'react-strict-dom'
import {Switch} from './Switch'
import {Field} from '../Field/Field'
import {spacing} from '@greenharness/greenrack-tokens/tokens/spacing.css'

const meta: Meta<typeof Switch> = {
  title: 'Components/Switch',
  component: Switch,
  args: {
    onCheckedChange: fn(),
  },
  argTypes: {
    checked: {control: 'boolean'},
    disabled: {control: 'boolean'},
    defaultChecked: {control: 'boolean'},
  },
}

export default meta
type Story = StoryObj<typeof Switch>

export const Default: Story = {
  args: {children: 'Enable notifications'},
  play: async ({canvas, userEvent, args}) => {
    const switchEl = canvas.getByRole('switch')
    await expect(switchEl).toBeInTheDocument()
    await expect(switchEl).not.toBeChecked()
    // The hidden input is placed against its own label, never a page ancestor.
    await expect(switchEl.offsetParent).toBe(switchEl.closest('label'))

    await userEvent.click(switchEl)
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true)
  },
}

export const Checked: Story = {
  args: {defaultChecked: true, children: 'Already enabled'},
  play: async ({canvas}) => {
    const switchEl = canvas.getByRole('switch')
    await expect(switchEl).toBeChecked()
  },
}

/** No visible label: a settings row shows the title, and `aria-label` names the switch. */
export const Labelled: Story = {
  args: {'aria-label': 'Analytics'},
  play: async ({canvas, userEvent, args}) => {
    const switchEl = canvas.getByRole('switch', {name: 'Analytics'})
    await userEvent.click(switchEl)
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true)
  },
}

export const Disabled: Story = {
  args: {disabled: true, children: 'Cannot toggle'},
  play: async ({canvas, userEvent, args}) => {
    const switchEl = canvas.getByRole('switch')
    await expect(switchEl).toBeDisabled()

    await userEvent.click(switchEl)
    await expect(args.onCheckedChange).not.toHaveBeenCalled()
  },
}

export const DisabledChecked: Story = {
  args: {disabled: true, defaultChecked: true, children: 'Locked on'},
  play: async ({canvas}) => {
    const switchEl = canvas.getByRole('switch')
    await expect(switchEl).toBeDisabled()
    await expect(switchEl).toBeChecked()
  },
}

export const WithoutLabel: Story = {
  args: {name: 'darkMode'},
  play: async ({canvas}) => {
    await expect(canvas.getByRole('switch')).toBeInTheDocument()
  },
}

const stackStyles = css.create({
  stack: {display: 'flex', flexDirection: 'column', gap: spacing.ms},
})

export const AllVariants: Story = {
  render: () => (
    <html.div style={stackStyles.stack}>
      <Switch>Unchecked</Switch>
      <Switch defaultChecked>Checked</Switch>
      <Switch disabled>Disabled</Switch>
      <Switch disabled defaultChecked>
        Disabled checked
      </Switch>
    </html.div>
  ),
  play: async ({canvas}) => {
    const switches = canvas.getAllByRole('switch')
    await expect(switches.length).toBe(4)
  },
}

/** Inside a Field.Root with no children: Field.Label names the switch, and
 *  the Field's description and error describe it. */
export const InField: Story = {
  render: (args) => (
    <html.div style={stackStyles.stack}>
      <Field.Root invalid>
        <Field.Label>Email alerts</Field.Label>
        <Switch onCheckedChange={args.onCheckedChange} />
        <Field.Description>One email a day at most.</Field.Description>
        <Field.Error>Turn on alerts for on-call staff.</Field.Error>
      </Field.Root>
      <Field.Root disabled>
        <Field.Label>Locked</Field.Label>
        <Switch />
      </Field.Root>
    </html.div>
  ),
  play: async ({canvas, userEvent, args}) => {
    const toggle = canvas.getByRole('switch', {name: 'Email alerts'})
    await expect(toggle).toHaveAccessibleDescription(
      'One email a day at most. Turn on alerts for on-call staff.',
    )
    await expect(toggle).toHaveAttribute('aria-invalid', 'true')
    await userEvent.click(canvas.getByText('Email alerts'))
    await expect(args.onCheckedChange).toHaveBeenLastCalledWith(true)

    await expect(canvas.getByRole('switch', {name: 'Locked'})).toBeDisabled()
  },
}
