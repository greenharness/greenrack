import type {ComponentMeta} from '../component-meta'

export const meta: ComponentMeta = {
  description:
    "Checkbox input with optional visible label. Supports controlled and uncontrolled modes. Inside a Field.Root it reads the Field: Field.Label names it (its `for` reaches the input, so clicking the label toggles it), Field.Description and Field.Error describe it, and the Field's invalid and disabled reach it. Give it no children there: a child label and Field.Label would both name it. On React Native, Field.Label's text is its accessibility label when it has no aria-label and no children. Inside a Form's Field.Root name, with no checked prop, it binds to the form field as Input does: it shows the field's boolean, sets it on each change (then calls its own onChange too), marks it touched on blur (on React Native, on each press), and the field's error clears once the value passes; defaultChecked is then unused.",
  whenToUse: [
    'Boolean opt-in/opt-out (terms acceptance, feature toggle)',
    'Multi-select from a list (inside a Fieldset)',
  ],
  whenNotToUse: [
    'Binary toggle in settings — prefer Switch for on/off semantics',
    'Selecting one of several options — use Select or ToggleGroup',
  ],
  relatedTo: [
    {
      component: 'Switch',
      kind: 'contrast',
      relationship: 'Switch for on/off settings; Checkbox for opt-in/selection',
    },
    {
      component: 'Toggle',
      kind: 'contrast',
      relationship: 'Toggle for toolbar actions; Checkbox for form input',
    },
  ],
  example: `<Checkbox name="terms" onChange={(e) => console.log(e.target.checked)}>
  I agree to the terms and conditions
</Checkbox>`,
}
