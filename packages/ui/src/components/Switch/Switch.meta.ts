import type {ComponentMeta} from '../component-meta'

export const meta: ComponentMeta = {
  description:
    "Toggle switch for on/off settings. Renders a hidden checkbox for form submission + a styled switch button. Inside a Field.Root it reads the Field: Field.Label names it (clicking the label toggles it), Field.Description and Field.Error describe it, and the Field's invalid and disabled reach it. Give it no children there: a child label and Field.Label would both name it. On React Native, Field.Label's text is its accessibility label when it has no aria-label and no children. Inside a Form's Field.Root name, with no checked prop, it binds to the form field as Input does: it shows the field's boolean, sets it on each change (then calls its own onCheckedChange too), marks it touched on blur (on React Native, on each press), and the field's error clears once the value passes; defaultChecked is then unused.",
  whenToUse: [
    'On/off toggles in settings (notifications, dark mode, feature flags)',
    'Immediate-effect toggles where the change applies instantly',
  ],
  whenNotToUse: [
    'Form opt-in checkboxes — use Checkbox',
    'Selecting between multiple options — use Select or ToggleGroup',
  ],
  relatedTo: [
    {
      component: 'Checkbox',
      kind: 'contrast',
      relationship: 'Checkbox for selection/opt-in; Switch for on/off settings',
    },
    {
      component: 'Toggle',
      kind: 'contrast',
      relationship: 'Toggle for toolbar pressed state; Switch for settings',
    },
  ],
  example: `<Switch
  name="notifications"
  defaultChecked={true}
  onCheckedChange={(checked) => console.log(checked)}
>
  Enable notifications
</Switch>`,
}
