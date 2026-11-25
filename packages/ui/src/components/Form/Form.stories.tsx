import {useState} from 'react'
import type {Meta, StoryObj} from '@storybook/react'
import {expect, fn, userEvent, waitFor} from 'storybook/test'
import {css, html} from 'react-strict-dom'
import {Schema} from 'effect'
import {Form} from './Form'
import {Field} from '../Field/Field'
import {Input} from '../Input/Input'
import {Textarea} from '../Textarea/Textarea'
import {Fieldset} from '../Fieldset/Fieldset'
import {Button} from '../Button/Button'
import {Checkbox} from '../Checkbox/Checkbox'
import {Switch} from '../Switch/Switch'
import {Slider} from '../Slider/Slider'
import {sizes} from '@greenharness/greenrack-tokens/tokens/sizes.css'

const meta: Meta = {
  title: 'Components/Form',
}

export default meta
type Story = StoryObj

// --- Schemas ---

const LoginSchema = Schema.Struct({
  username: Schema.String.pipe(
    Schema.minLength(3, {message: () => 'Username must be at least 3 characters'}),
  ),
  password: Schema.String.pipe(
    Schema.minLength(8, {message: () => 'Password must be at least 8 characters'}),
  ),
})

const FeedbackSchema = Schema.Struct({
  email: Schema.String.pipe(
    Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {message: () => 'Enter a valid email address'}),
  ),
  message: Schema.String.pipe(
    Schema.minLength(10, {message: () => 'Message must be at least 10 characters'}),
  ),
})

const ProfileSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.minLength(2, {message: () => 'Name must be at least 2 characters'}),
  ),
  email: Schema.String.pipe(
    Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {message: () => 'Enter a valid email'}),
  ),
  bio: Schema.String,
})

const wrapStyles = css.create({
  wrap: {maxWidth: sizes.dialogSm},
  wrapWide: {maxWidth: sizes.pageSm},
})

// --- Stories ---

export const Default: Story = {
  render: () => {
    const handleSubmit = fn()
    return (
      <html.div style={wrapStyles.wrap}>
        <Form
          schema={LoginSchema}
          defaultValues={{username: '', password: ''}}
          onSubmit={handleSubmit}
        >
          {() => (
            <Fieldset.Root gap="md">
              <Field.Root name="username">
                <Field.Label>Username</Field.Label>
                <Input placeholder="Enter username" />
                <Field.Description>3-32 characters</Field.Description>
                <Field.Error />
              </Field.Root>

              <Field.Root name="password">
                <Field.Label>Password</Field.Label>
                <Input type="password" placeholder="Enter password" />
                <Field.Error />
              </Field.Root>

              <Button type="submit">Log in</Button>
            </Fieldset.Root>
          )}
        </Form>
      </html.div>
    )
  },
  play: async ({canvas, userEvent}) => {
    // The submit button is never disabled by validity: an empty submit says what is
    // wrong (one message per field) and focuses the first field to fix.
    const button = canvas.getByRole('button', {name: 'Log in'})
    await expect(button).toBeEnabled()
    await userEvent.click(button)
    await waitFor(() => expect(canvas.getAllByRole('alert')).toHaveLength(2))
    await expect(canvas.getByPlaceholderText('Enter username')).toHaveFocus()

    // Labels and inputs rendered
    await expect(canvas.getByText('Username')).toBeInTheDocument()
    await expect(canvas.getByText('Password')).toBeInTheDocument()
    await expect(canvas.getByPlaceholderText('Enter username')).toBeInTheDocument()
    await expect(canvas.getByPlaceholderText('Enter password')).toBeInTheDocument()
  },
}

export const ValidationOnBlur: Story = {
  name: 'Validation — on blur',
  render: () => (
    <html.div style={wrapStyles.wrap}>
      <Form schema={LoginSchema} defaultValues={{username: '', password: ''}} onSubmit={fn()}>
        <Fieldset.Root gap="md">
          <Field.Root name="username">
            <Field.Label>Username</Field.Label>
            <Input placeholder="Enter username" />
            <Field.Error />
          </Field.Root>

          <Field.Root name="password">
            <Field.Label>Password</Field.Label>
            <Input type="password" placeholder="Enter password" />
            <Field.Error />
          </Field.Root>

          <Button type="submit">Log in</Button>
        </Fieldset.Root>
      </Form>
    </html.div>
  ),
  play: async ({canvas, step}) => {
    const usernameInput = canvas.getByPlaceholderText('Enter username')
    const passwordInput = canvas.getByPlaceholderText('Enter password')

    await step('No errors before interaction', async () => {
      expect(canvas.queryByRole('alert')).not.toBeInTheDocument()
    })

    await step('Type short username then blur — error appears', async () => {
      await userEvent.type(usernameInput, 'ab')
      await userEvent.tab() // blur
      const alert = await canvas.findByRole('alert')
      await expect(alert).toHaveTextContent('Username must be at least 3 characters')
    })

    await step(
      'Fix username by typing more — error clears (reValidateMode: onChange)',
      async () => {
        await userEvent.type(usernameInput, 'c') // now "abc"
        expect(canvas.queryByText('Username must be at least 3 characters')).not.toBeInTheDocument()
      },
    )

    await step('Blur empty password — error appears', async () => {
      await userEvent.click(passwordInput)
      await userEvent.tab()
      const alerts = canvas.getAllByRole('alert')
      const pwAlert = alerts.find((el) => el.textContent?.includes('Password'))
      await expect(pwAlert).toBeDefined()
    })
  },
}

export const WithTextarea: Story = {
  name: 'With Textarea',
  render: () => (
    <html.div style={wrapStyles.wrap}>
      <Form schema={FeedbackSchema} defaultValues={{email: '', message: ''}} onSubmit={fn()}>
        {() => (
          <Fieldset.Root gap="md">
            <Field.Root name="email">
              <Field.Label>Email</Field.Label>
              <Input type="email" placeholder="you@example.com" />
              <Field.Error />
            </Field.Root>

            <Field.Root name="message">
              <Field.Label>Message</Field.Label>
              <Textarea placeholder="Tell us what you think..." rows={4} />
              <Field.Description>At least 10 characters</Field.Description>
              <Field.Error />
            </Field.Root>

            <Button type="submit">Send feedback</Button>
          </Fieldset.Root>
        )}
      </Form>
    </html.div>
  ),
  play: async ({canvas}) => {
    await expect(canvas.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    await expect(canvas.getByPlaceholderText('Tell us what you think...')).toBeInTheDocument()

    await expect(canvas.getByRole('button', {name: 'Send feedback'})).toBeEnabled()
  },
}

export const SuccessfulSubmit: Story = {
  name: 'Successful submit',
  render: () => {
    const onSubmit = fn()
    return (
      <html.div style={wrapStyles.wrap}>
        <Form schema={LoginSchema} defaultValues={{username: '', password: ''}} onSubmit={onSubmit}>
          <Fieldset.Root gap="md">
            <Field.Root name="username">
              <Field.Label>Username</Field.Label>
              <Input placeholder="Enter username" />
              <Field.Error />
            </Field.Root>

            <Field.Root name="password">
              <Field.Label>Password</Field.Label>
              <Input type="password" placeholder="Enter password" />
              <Field.Error />
            </Field.Root>

            <Button type="submit">Log in</Button>
          </Fieldset.Root>
        </Form>
      </html.div>
    )
  },
  play: async ({canvas}) => {
    const usernameInput = canvas.getByPlaceholderText('Enter username')
    const passwordInput = canvas.getByPlaceholderText('Enter password')

    // Fill valid values
    await userEvent.type(usernameInput, 'johndoe')
    await userEvent.type(passwordInput, 'supersecret1')

    // No errors should be present
    expect(canvas.queryByRole('alert')).not.toBeInTheDocument()
  },
}

const PreferencesSchema = Schema.Struct({
  terms: Schema.Boolean.pipe(
    Schema.filter((accepted) => accepted || 'Accept the terms to continue'),
  ),
  updates: Schema.Boolean.pipe(Schema.filter((on) => on || 'Turn on updates to continue')),
  volume: Schema.Number.pipe(
    Schema.greaterThanOrEqualTo(50, {message: () => 'Set the volume to 50 or more'}),
  ),
})

const preferencesSubmit = fn()

// Checkbox, Switch and Slider inside a Field.Root name bind to the form field
// as Input does: the schema's boolean and number are what they were set to.
export const CheckboxSwitchSliderBind: Story = {
  name: 'Checkbox, Switch and Slider bind',
  render: () => (
    <html.div style={wrapStyles.wrap}>
      <Form
        schema={PreferencesSchema}
        defaultValues={{terms: false, updates: false, volume: 0}}
        onSubmit={preferencesSubmit}
      >
        <Fieldset.Root gap="md">
          <Field.Root name="terms">
            <Field.Label>I accept the terms</Field.Label>
            <Checkbox />
            <Field.Error />
          </Field.Root>

          <Field.Root name="updates">
            <Field.Label>Email me updates</Field.Label>
            <Switch />
            <Field.Error />
          </Field.Root>

          <Field.Root name="volume">
            <Field.Label>Volume</Field.Label>
            <Slider step={10} showValue />
            <Field.Error />
          </Field.Root>

          <Button type="submit">Save</Button>
        </Fieldset.Root>
      </Form>
    </html.div>
  ),
  play: async ({canvas}) => {
    preferencesSubmit.mockClear()
    await userEvent.click(canvas.getByRole('button', {name: 'Save'}))

    // The schema refuses the defaults: each control shows its own error.
    await expect(await canvas.findByText('Accept the terms to continue')).toBeInTheDocument()
    await expect(canvas.getByText('Turn on updates to continue')).toBeInTheDocument()
    await expect(canvas.getByText('Set the volume to 50 or more')).toBeInTheDocument()
    await expect(preferencesSubmit).not.toHaveBeenCalled()

    const terms = canvas.getByRole('checkbox', {name: 'I accept the terms'})
    await expect(terms).toHaveAttribute('aria-invalid', 'true')

    // Setting each control clears its error.
    await userEvent.click(terms)
    await userEvent.click(canvas.getByRole('switch', {name: 'Email me updates'}))
    const volume = canvas.getByRole('slider', {name: 'Volume'})
    volume.focus()
    await userEvent.keyboard('{End}')
    await expect(volume).toHaveAttribute('aria-valuenow', '100')
    await waitFor(() => expect(canvas.queryByRole('alert')).not.toBeInTheDocument())
    await waitFor(() =>
      expect(canvas.queryByText('Set the volume to 50 or more')).not.toBeInTheDocument(),
    )
    await expect(terms).not.toHaveAttribute('aria-invalid')

    // The form submits the values they were set to.
    await userEvent.click(canvas.getByRole('button', {name: 'Save'}))
    await waitFor(() => expect(preferencesSubmit).toHaveBeenCalledTimes(1))
    await expect(preferencesSubmit.mock.calls[0]?.[0]).toEqual({
      terms: true,
      updates: true,
      volume: 100,
    })
  },
}

export const StandaloneFieldStillWorks: Story = {
  name: 'Standalone Field (no Form)',
  render: () => (
    <html.div style={wrapStyles.wrap}>
      <Field.Root invalid>
        <Field.Label>Email</Field.Label>
        <Input variant="error" placeholder="Enter email" />
        <Field.Error>Manual error — no Form wrapper needed.</Field.Error>
      </Field.Root>
    </html.div>
  ),
  play: async ({canvas}) => {
    // Standalone usage still works without Form context
    const input = canvas.getByPlaceholderText('Enter email')
    await expect(input).toHaveAttribute('aria-invalid', 'true')

    const alert = canvas.getByRole('alert')
    await expect(alert).toHaveTextContent('Manual error — no Form wrapper needed.')
  },
}

// --- New feature stories ---

export const NecessityIndicatorIcon: Story = {
  name: 'Necessity indicator — icon',
  render: () => (
    <html.div style={wrapStyles.wrap}>
      <Form
        schema={ProfileSchema}
        defaultValues={{name: '', email: '', bio: ''}}
        onSubmit={fn()}
        necessityIndicator="icon"
      >
        <Fieldset.Root gap="md">
          <Field.Root name="name" required>
            <Field.Label>Full name</Field.Label>
            <Input placeholder="Jane Doe" />
            <Field.Error />
          </Field.Root>

          <Field.Root name="email" required>
            <Field.Label>Email</Field.Label>
            <Input type="email" placeholder="you@example.com" />
            <Field.Error />
          </Field.Root>

          <Field.Root name="bio">
            <Field.Label>Bio</Field.Label>
            <Textarea placeholder="Tell us about yourself..." rows={3} />
          </Field.Root>

          <Button type="submit">Save</Button>
        </Fieldset.Root>
      </Form>
    </html.div>
  ),
  play: async ({canvas}) => {
    // Required fields show asterisk
    const nameLabel = canvas.getByText('Full name')
    await expect(nameLabel.closest('label')?.textContent).toContain('*')

    const emailLabel = canvas.getByText('Email')
    await expect(emailLabel.closest('label')?.textContent).toContain('*')

    // Optional field has no asterisk
    const bioLabel = canvas.getByText('Bio')
    await expect(bioLabel.closest('label')?.textContent).not.toContain('*')
  },
}

export const NecessityIndicatorLabel: Story = {
  name: 'Necessity indicator — label',
  render: () => (
    <html.div style={wrapStyles.wrap}>
      <Form
        schema={ProfileSchema}
        defaultValues={{name: '', email: '', bio: ''}}
        onSubmit={fn()}
        necessityIndicator="label"
      >
        <Fieldset.Root gap="md">
          <Field.Root name="name" required>
            <Field.Label>Full name</Field.Label>
            <Input placeholder="Jane Doe" />
            <Field.Error />
          </Field.Root>

          <Field.Root name="email" required>
            <Field.Label>Email</Field.Label>
            <Input type="email" placeholder="you@example.com" />
            <Field.Error />
          </Field.Root>

          <Field.Root name="bio">
            <Field.Label>Bio</Field.Label>
            <Textarea placeholder="Tell us about yourself..." rows={3} />
          </Field.Root>

          <Button type="submit">Save</Button>
        </Fieldset.Root>
      </Form>
    </html.div>
  ),
  play: async ({canvas}) => {
    // Required fields show "(required)" — there are two
    const requiredIndicators = canvas.getAllByText('(required)')
    await expect(requiredIndicators).toHaveLength(2)

    // Optional field shows "(optional)"
    await expect(canvas.getByText('(optional)')).toBeInTheDocument()
  },
}

export const FocusFirstInvalid: Story = {
  name: 'Focus first invalid on submit',
  render: () => (
    <html.div style={wrapStyles.wrap}>
      <Form schema={LoginSchema} defaultValues={{username: '', password: ''}} onSubmit={fn()}>
        <Fieldset.Root gap="md">
          <Field.Root name="username">
            <Field.Label>Username</Field.Label>
            <Input placeholder="Enter username" />
            <Field.Error />
          </Field.Root>

          <Field.Root name="password">
            <Field.Label>Password</Field.Label>
            <Input type="password" placeholder="Enter password" />
            <Field.Error />
          </Field.Root>

          <Button type="submit">Log in</Button>
        </Fieldset.Root>
      </Form>
    </html.div>
  ),
  play: async ({canvas}) => {
    // Submit the form with empty fields
    const button = canvas.getByRole('button', {name: 'Log in'})
    await userEvent.click(button)

    // First invalid field (username) should be focused
    const usernameInput = canvas.getByPlaceholderText('Enter username')
    await expect(usernameInput).toHaveFocus()
  },
}

export const FormDisabled: Story = {
  name: 'Form disabled',
  render: () => (
    <html.div style={wrapStyles.wrap}>
      <Form
        schema={LoginSchema}
        defaultValues={{username: 'johndoe', password: 'supersecret1'}}
        onSubmit={fn()}
        disabled
      >
        <Fieldset.Root gap="md">
          <Field.Root name="username">
            <Field.Label>Username</Field.Label>
            <Input placeholder="Enter username" />
          </Field.Root>

          <Field.Root name="password">
            <Field.Label>Password</Field.Label>
            <Input type="password" placeholder="Enter password" />
          </Field.Root>

          <Button type="submit">Log in</Button>
        </Fieldset.Root>
      </Form>
    </html.div>
  ),
  play: async ({canvas}) => {
    const usernameInput = canvas.getByPlaceholderText('Enter username')
    const passwordInput = canvas.getByPlaceholderText('Enter password')
    await expect(usernameInput).toBeDisabled()
    await expect(passwordInput).toBeDisabled()
  },
}

export const LabelPositionSide: Story = {
  name: 'Label position — side',
  render: () => (
    <html.div style={wrapStyles.wrapWide}>
      <Form
        schema={ProfileSchema}
        defaultValues={{name: '', email: '', bio: ''}}
        onSubmit={fn()}
        labelPosition="side"
        necessityIndicator="icon"
      >
        {() => (
          <Fieldset.Root gap="md">
            <Field.Root name="name" required>
              <Field.Label>Full name</Field.Label>
              <Input placeholder="Jane Doe" />
              <Field.Error />
            </Field.Root>

            <Field.Root name="email" required>
              <Field.Label>Email</Field.Label>
              <Input type="email" placeholder="you@example.com" />
              <Field.Description>We will never share your email.</Field.Description>
              <Field.Error />
            </Field.Root>

            <Field.Root name="bio">
              <Field.Label>Bio</Field.Label>
              <Textarea placeholder="Tell us about yourself..." rows={3} />
            </Field.Root>

            <Button type="submit">Save profile</Button>
          </Fieldset.Root>
        )}
      </Form>
    </html.div>
  ),
  play: async ({canvas}) => {
    await expect(canvas.getByPlaceholderText('Jane Doe')).toBeInTheDocument()
    await expect(canvas.getByPlaceholderText('you@example.com')).toBeInTheDocument()
  },
}

export const ServerValidationErrors: Story = {
  name: 'Server validation errors',
  render: () => {
    function ServerErrorDemo() {
      const [serverErrors, setServerErrors] = useState<
        Partial<Record<'username' | 'password', string>>
      >({})

      return (
        <html.div style={wrapStyles.wrap}>
          <Form
            schema={LoginSchema}
            defaultValues={{username: '', password: ''}}
            onSubmit={() => {
              // Simulate server response with errors
              setServerErrors({username: 'This username is already taken'})
            }}
            validationErrors={serverErrors}
          >
            <Fieldset.Root gap="md">
              <Field.Root name="username">
                <Field.Label>Username</Field.Label>
                <Input placeholder="Enter username" />
                <Field.Error />
              </Field.Root>

              <Field.Root name="password">
                <Field.Label>Password</Field.Label>
                <Input type="password" placeholder="Enter password" />
                <Field.Error />
              </Field.Root>

              <Button type="submit">Register</Button>
            </Fieldset.Root>
          </Form>
        </html.div>
      )
    }

    return <ServerErrorDemo />
  },
  play: async ({canvas}) => {
    const usernameInput = canvas.getByPlaceholderText('Enter username')
    const passwordInput = canvas.getByPlaceholderText('Enter password')

    // Fill valid values and submit
    await userEvent.type(usernameInput, 'johndoe')
    await userEvent.type(passwordInput, 'supersecret1')

    const button = canvas.getByRole('button', {name: 'Register'})
    await userEvent.click(button)

    // Server error appears
    const alert = await canvas.findByRole('alert')
    await expect(alert).toHaveTextContent('This username is already taken')
    // The server refused the submit: focus goes to the field it names.
    await waitFor(() => expect(usernameInput).toHaveFocus())
    await expect(usernameInput).toHaveAccessibleDescription('This username is already taken')
    // Refused again: focus returns to that field each time, not only the first.
    await userEvent.click(passwordInput)
    await userEvent.click(button)
    await waitFor(() => expect(usernameInput).toHaveFocus())
  },
}

export const ServerValidationErrorsClearedFirst: Story = {
  name: 'Server validation errors, cleared when the submit starts',
  render: () => {
    function ServerErrorDemo() {
      const [serverErrors, setServerErrors] = useState<
        Partial<Record<'username' | 'password', string>>
      >({})

      return (
        <html.div style={wrapStyles.wrap}>
          <Form
            schema={LoginSchema}
            defaultValues={{username: '', password: ''}}
            onSubmit={() => {
              // The app clears the errors when a submit starts, and sets the
              // server's when it answers.
              setServerErrors({})
              setTimeout(() => setServerErrors({username: 'This username is already taken'}), 50)
            }}
            validationErrors={serverErrors}
          >
            <Fieldset.Root gap="md">
              <Field.Root name="username">
                <Field.Label>Username</Field.Label>
                <Input placeholder="Enter username" />
                <Field.Error />
              </Field.Root>

              <Field.Root name="password">
                <Field.Label>Password</Field.Label>
                <Input type="password" placeholder="Enter password" />
                <Field.Error />
              </Field.Root>

              <Button type="submit">Register</Button>
            </Fieldset.Root>
          </Form>
        </html.div>
      )
    }

    return <ServerErrorDemo />
  },
  play: async ({canvas}) => {
    const usernameInput = canvas.getByPlaceholderText('Enter username')
    const passwordInput = canvas.getByPlaceholderText('Enter password')

    // Fill valid values and submit
    await userEvent.type(usernameInput, 'johndoe')
    await userEvent.type(passwordInput, 'supersecret1')

    const button = canvas.getByRole('button', {name: 'Register'})
    await userEvent.click(button)

    // Server error appears
    const alert = await canvas.findByRole('alert')
    await expect(alert).toHaveTextContent('This username is already taken')
    // The server refused the submit: focus goes to the field it names.
    await waitFor(() => expect(usernameInput).toHaveFocus())
    await expect(usernameInput).toHaveAccessibleDescription('This username is already taken')
  },
}
