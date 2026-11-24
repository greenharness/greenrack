import type {Meta, StoryObj} from '@storybook/react'
import {expect, fn, fireEvent} from 'storybook/test'
import {Slider} from './Slider'
import {Field} from '../Field/Field'

const meta: Meta<typeof Slider> = {
  title: 'Components/Slider',
  component: Slider,
  args: {
    onValueChange: fn(),
  },
  argTypes: {
    disabled: {control: 'boolean'},
    showValue: {control: 'boolean'},
  },
}

export default meta
type Story = StoryObj<typeof Slider>

export const Default: Story = {
  args: {children: 'Volume', defaultValue: 40, showValue: true},
  play: async ({canvas}) => {
    const slider = canvas.getByRole('slider', {name: 'Volume'})
    await expect(slider).toHaveAttribute('aria-valuemin', '0')
    await expect(slider).toHaveAttribute('aria-valuemax', '100')
    await expect(slider).toHaveAttribute('aria-valuenow', '40')
    await expect(slider).toHaveAttribute('aria-valuetext', '40')
    await expect(canvas.getByText('40')).toBeInTheDocument()
  },
}

export const Keyboard: Story = {
  args: {'aria-label': 'Opacity', defaultValue: 50, step: 5},
  play: async ({canvas, userEvent, args}) => {
    const slider = canvas.getByRole('slider', {name: 'Opacity'})
    slider.focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(args.onValueChange).toHaveBeenLastCalledWith(55)
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    await expect(args.onValueChange).toHaveBeenLastCalledWith(45)
    await userEvent.keyboard('{PageUp}')
    await expect(args.onValueChange).toHaveBeenLastCalledWith(95)
    await userEvent.keyboard('{PageDown}')
    await expect(args.onValueChange).toHaveBeenLastCalledWith(45)
    await userEvent.keyboard('{Home}')
    await expect(slider).toHaveAttribute('aria-valuenow', '0')
    await userEvent.keyboard('{End}')
    await expect(slider).toHaveAttribute('aria-valuenow', '100')
  },
}

export const FormattedValue: Story = {
  args: {
    children: 'Zoom',
    defaultValue: 25,
    min: 0,
    max: 50,
    showValue: true,
    formatValue: (value: number) => `${value * 2}%`,
  },
  play: async ({canvas}) => {
    const slider = canvas.getByRole('slider', {name: 'Zoom'})
    await expect(slider).toHaveAttribute('aria-valuetext', '50%')
    await expect(canvas.getByText('50%')).toBeInTheDocument()
  },
}

export const PointerDrag: Story = {
  args: {'aria-label': 'Brightness', defaultValue: 0},
  play: async ({canvas, args}) => {
    const slider = canvas.getByRole('slider', {name: 'Brightness'})
    const hit = slider.parentElement as HTMLElement
    const rect = hit.getBoundingClientRect()
    const at = (fraction: number) => ({
      clientX: rect.left + rect.width * fraction,
      clientY: rect.top + rect.height / 2,
      pointerId: 1,
      button: 0,
    })
    await fireEvent.pointerDown(hit, at(0.25))
    await expect(args.onValueChange).toHaveBeenLastCalledWith(25)
    await fireEvent.pointerMove(hit, at(0.75))
    await expect(args.onValueChange).toHaveBeenLastCalledWith(75)
    await expect(slider).toHaveFocus()
  },
}

export const Disabled: Story = {
  args: {'aria-label': 'Locked', defaultValue: 30, disabled: true},
  play: async ({canvas, userEvent, args}) => {
    const slider = canvas.getByRole('slider', {name: 'Locked'})
    await expect(slider).toHaveAttribute('aria-disabled', 'true')
    slider.focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(args.onValueChange).not.toHaveBeenCalled()
  },
}

/** Inside a Field.Root with no children: the thumb is not labelable, so it
 *  names itself from Field.Label by aria-labelledby; the Field's description
 *  and error describe it. */
export const InField: Story = {
  render: (args) => (
    <>
      <Field.Root invalid>
        <Field.Label>Volume</Field.Label>
        <Slider defaultValue={90} onValueChange={args.onValueChange} />
        <Field.Description>Applies to every speaker.</Field.Description>
        <Field.Error>Keep the volume under 80.</Field.Error>
      </Field.Root>
      <Field.Root disabled>
        <Field.Label>Locked</Field.Label>
        <Slider defaultValue={30} />
      </Field.Root>
    </>
  ),
  play: async ({canvas, userEvent, args}) => {
    const slider = canvas.getByRole('slider', {name: 'Volume'})
    await expect(slider).toHaveAccessibleDescription(
      'Applies to every speaker. Keep the volume under 80.',
    )
    await expect(slider).toHaveAttribute('aria-invalid', 'true')
    slider.focus()
    await userEvent.keyboard('{ArrowLeft}')
    await expect(args.onValueChange).toHaveBeenLastCalledWith(89)

    await expect(canvas.getByRole('slider', {name: 'Locked'})).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  },
}
