import type {ComponentMeta} from '../component-meta'

export const meta: ComponentMeta = {
  description:
    'Compound form field with label, description, and error display. Inside Form, auto-binds to react-hook-form via name prop. Works standalone with manual invalid prop. A native validation message from an Input or Textarea (required, type, pattern) is shown by Field.Error; explicit Error children and form errors take precedence. Field.Root shows the native message itself when it has no Field.Error. `errorPlacement` (`below` by default) puts the error line in the Field\'s flow, so the Field grows by one line when it shows. `hanging` takes it out of the flow, under the control (`position: absolute` under the Field, or under the content column when `labelPosition="side"`): the Field keeps the height of its label and control, and an `Inline align="end"` row stays aligned on its inputs and its button. The line hangs below the row, so leave room under the row: on the web `paddingBottom: calc(${typeScale.lineHeight1} + ${spacing.xs})` (one error line, which grows with the text size), and `sizes.fieldErrorReserve` (20px, the same at the default text size) where there is no calc, as on native. It is the line only: the gap to the next row still comes from the gap of the container. A message that wraps onto a second line (a narrow Field) reaches past that room and overlaps what follows. A `Field.Description` stays in the flow. The prop is on the Field only; a `Form` does not pass it down as it does `labelPosition`.',
  whenToUse: [
    'Any form input that needs a label and/or error message',
    'Standalone labeled input (without Form) with manual error display',
    'A labelled GROUP of controls (ToggleGroup, CheckboxGroup, RadioGroup): the label names the group via aria-labelledby — detected for a direct child, `group` for a nested one',
  ],
  whenNotToUse: [
    'Bare input without label — use Input directly (rare)',
    'A row of Fields with an `Inline align="end"` button where one shows an error: that is `errorPlacement="hanging"`, not a different layout',
  ],
  anatomy: {
    required: ['Root'],
    optional: ['Label', 'Description', 'Error'],
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

// A row of Fields and a button, aligned on the inputs whatever error lines show
<html.div style={styles.rowReserve /* paddingBottom: calc(lineHeight1 + spacing.xs) */}>
  <Inline gap="sm" align="end">
    <Field.Root invalid={dateInvalid} errorPlacement="hanging">
      <Field.Label>Date</Field.Label>
      <Input />
      <Field.Error>Enter a date</Field.Error>
    </Field.Root>
    <Button>Mark posted</Button>
  </Inline>
</html.div>

// Standalone (manual error)
<Field.Root invalid>
  <Field.Label>Email</Field.Label>
  <Input variant="error" />
  <Field.Error>This email is already taken.</Field.Error>
</Field.Root>`,
}
