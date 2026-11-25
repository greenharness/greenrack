---
'@greenharness/greenrack-ui': patch
---

`Checkbox`, `Switch` and `Slider` bind to their `Form` field, as `Input` does. Inside a `Form`'s `Field.Root name`, a control whose own value prop is unset (`checked` for `Checkbox` and `Switch`, `value` for `Slider`) shows the field's value, writes each change to it as a plain boolean or number, and marks it touched on blur (on React Native, on each press, at the end of a slider drag and on an accessibility step). So a boolean or a number in the schema is submitted as the control was set, the field's error shows on the control, and it clears once the value passes; a submit the schema refuses focuses the first refused one. Before, the three never set the field: the form submitted its default, and the error never cleared from them. While bound, `defaultChecked` and `defaultValue` are unused, except that a `Slider` whose field holds no number shows `defaultValue ?? min`: give the field a default in `defaultValues`.

Unlike `Input`, whose `onChange` replaces the field's, a bound control still calls its own `onChange` / `onCheckedChange` / `onValueChange` after setting the field, so a callback for a side effect does not unbind it. Pass the value prop to leave the field alone.
