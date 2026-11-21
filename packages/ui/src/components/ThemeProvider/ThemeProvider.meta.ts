import type {ComponentMeta} from '../component-meta'

export const meta: ComponentMeta = {
  description:
    'Theme context provider. Must wrap the entire app at the root level. Sets dark, light, or high-contrast theme for all child components via CSS custom properties. overrides replaces colours by token key ({accent: "#ff5a1f"}) and updates in place, without a re-mount; it is the colour alias of tokens. tokens replaces values by group and key ({colors, shadows, typography, typeScale, spacing, layoutSpacing, radii, sizes, borders, duration, easing, effects}, each a partial record of the keys of that group), so an app passes its theme file as is: a scoped rule on the web (values that are not valid for their key are dropped with one development warning), a runtime theme per group on React Native, where useResolvedColors() follows the colours. layers, breakpoints, microSpacing, radii.px6 and radii.full are refused; sizes.touchTarget (44px), borders.focusRing (2px) and borders.focusOffset keep their floors. colors and shadows reset when a nested provider changes theme; every other group inherits. The app loads its own fonts (weights 400, 500, 600 and 700); native takes the first family of a list, unquoted, and is unverified on a device. Keep radii ordered xs <= sm <= md <= lg. Flat values apply in every mode; values per mode sit beside the groups (light: {colors}, dark: {colors}, contrast: {light, dark} under prefers-contrast: more), with the same refused groups, keys and floors, and high-contrast takes the flat values only. Pass them to ColorModeProvider tokens: under system it emits prefers-color-scheme blocks, so the server render is right on every OS before hydration. Give each colour and shadow key in both light and dark: a key given in dark only keeps its dark value on a light OS until hydration. A nested provider is pinned to its own theme, so one that follows the mode with theme={useColorMode().theme} paints dark until hydration under system. Native takes the flat values and the theme mode; contrast does not apply there. A nested provider on the same theme keeps the outer overrides and lays its own over them; on another theme it starts from that theme colours.',
  whenToUse: [
    'App root — required for all greenrack components to render correctly',
    'Theme switching (dark/light mode toggle)',
  ],
  whenNotToUse: ['Never omit — all greenrack components require ThemeProvider'],
  example: `<ThemeProvider theme="dark">
  <App />
</ThemeProvider>`,
}
