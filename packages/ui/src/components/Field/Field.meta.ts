import type {ComponentMeta} from '../component-meta'

export const meta: ComponentMeta = {
  description:
    'Compound form field with label, description, and error display. Inside Form, auto-binds to react-hook-form via name prop. Works standalone with manual invalid prop. A native validation message from an Input or Textarea (required, type, pattern) is shown by Field.Error; explicit Error children and form errors take precedence. Field.Root shows the native message itself when it has no Field.Error. Alone, the error line is in the Field\'s flow, so the Field grows by one line when it shows and what follows moves down (it overlaps nothing). `Field.Row` is a row of Fields (and a button) that wraps on a narrow page and shows every Field\'s error in one line under the whole row, each led by its field\'s name: the inputs and the button never move, a long message wraps instead of covering what follows, and a second error joins the line without re-announcing the first (the line is one live region, `aria-atomic="false"`). `errorLabel` on Field.Root names a Field whose label is not plain text. `errorPlacement="hanging"` takes the error out of the flow, under the control (`position: absolute`), for one short line: leave room under the row (`paddingBottom: calc(${typeScale.lineHeight1} + ${spacing.xs})`, `sizes.fieldErrorReserve` where there is no calc); a message that wraps reaches over what follows, so a row that can show a long message, or more than one error, is a `Field.Row`. On React Native `Field.Row` is a wrapping row and each Field keeps its error below, so a control can shift when an error shows. A `Field.Description` stays in the flow.',
  whenToUse: [
    'Any form input that needs a label and/or error message',
    'Standalone labeled input (without Form) with manual error display',
    'A labelled GROUP of controls (ToggleGroup, CheckboxGroup, RadioGroup): the label names the group via aria-labelledby — detected for a direct child, `group` for a nested one',
  ],
  whenNotToUse: [
    'Bare input without label — use Input directly (rare)',
    'A row of Fields and a button where an error must not move the inputs: that is `Field.Row`, not an `Inline` of Fields with `errorPlacement="hanging"` (hanging is for one short line)',
  ],
  anatomy: {
    required: ['Root'],
    optional: ['Label', 'Description', 'Error', 'Row'],
  },
  relatedTo: [
    {
      component: 'Form',
      kind: 'composition',
      relationship: 'Field.Root auto-binds when name matches schema key',
    },
    {component: 'Input', kind: 'composition', relationship: 'Place Input inside Field.Root'},
    {component: 'Textarea', kind: 'composition', relationship: 'Place Textarea inside Field.Root'},
    {component: 'Select', kind: 'composition', relationship: 'Place Select inside Field.Root'},
    {
      component: 'ToggleGroup',
      kind: 'composition',
      relationship: 'Inside Field.Root the Field.Label names the group',
    },
    {
      component: 'CheckboxGroup',
      kind: 'composition',
      relationship: 'Inside Field.Root the Field.Label names the group',
    },
    {
      component: 'RadioGroup',
      kind: 'composition',
      relationship: 'Inside Field.Root the Field.Label names the group',
    },
  ],
  example: `// Inside Form (auto-binds validation)
<Field.Root name="email">
  <Field.Label>Email</Field.Label>
  <Input type="email" placeholder="you@example.com" />
  <Field.Description>We'll never share your email.</Field.Description>
  <Field.Error />
</Field.Root>

// A group of controls — the label names the group (aria-labelledby).
// A direct ToggleGroup / CheckboxGroup / RadioGroup child is detected;
// pass \`group\` when the group is nested (e.g. inside a Stack).
<Field.Root>
  <Field.Label>Type</Field.Label>
  <ToggleGroup value={[type]} onValueChange={setType}>
    <Toggle value="app">Application</Toggle>
    <Toggle value="platform">Platform</Toggle>
  </ToggleGroup>
</Field.Root>

// A row of Fields and a button: errors show in one line under the whole row,
// the inputs and the button never move
<Field.Row>
  <Field.Root invalid={dateInvalid}>
    <Field.Label>Date</Field.Label>
    <Input />
    <Field.Error>Enter a date</Field.Error>
  </Field.Root>
  <Field.Root>
    <Field.Label>Time</Field.Label>
    <Input />
  </Field.Root>
  <Button>Mark posted</Button>
</Field.Row>

// Standalone (manual error)
<Field.Root invalid>
  <Field.Label>Email</Field.Label>
  <Input variant="error" />
  <Field.Error>This email is already taken.</Field.Error>
</Field.Root>`,
}
