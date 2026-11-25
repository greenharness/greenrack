/**
 * The web ThemeProvider's override rules, pure: they run the same on the
 * server and in the browser (no `CSS` global), so a server-rendered rule
 * hydrates.
 */
import {isSafeColor, THEMABLE_GROUPS, validateTokens} from '@greenharness/greenrack-tokens/theme'
import type {ModeName, ThemableGroup, ThemeTokens} from '@greenharness/greenrack-tokens/theme'
import {lightColors, lightShadows} from '@greenharness/greenrack-tokens/raw'
import type {SchemeSource} from './schemeSource'
import type {ModeLayers} from './overrides'

export {isSafeColor}

/** `var(--bg-x1y2)` → `--bg-x1y2`: the compiled variable a token reference names. */
export function variableFromReference(reference: unknown): string | null {
  const match = /^var\((--[\w-]+)\)$/.exec(String(reference ?? ''))
  return match ? match[1] : null
}

type VariableOf = (group: ThemableGroup, key: string) => string | null

/** `--x: v;` for each valid entry with a compiled variable. Values are validated again here. */
function declarations(tokens: ThemeTokens, variableOf: VariableOf): string[] {
  const {kept} = validateTokens(tokens)
  return THEMABLE_GROUPS.flatMap((group) =>
    Object.entries(kept[group] ?? {}).flatMap(([key, value]) => {
      const variable = variableOf(group, key)
      return variable ? [`${variable}: ${value};`] : []
    }),
  )
}

// Doubled, so it outranks the theme classes (one class each) wherever the
// stylesheets land. useId output holds neither a quote nor a backslash: safe
// inside quotes.
const selectorOf = (scope: string) => `[data-gr-theme="${scope}"][data-gr-theme="${scope}"]`

/**
 * The scoped rule for a provider's tokens, or null when it has none. Values
 * are validated again here, so the rule is safe whatever the caller passed.
 */
export function overrideRule(
  scope: string,
  tokens: ThemeTokens,
  variableOf: VariableOf,
): string | null {
  const lines = declarations(tokens, variableOf)
  if (lines.length === 0) return null
  return `${selectorOf(scope)} { ${lines.join(' ')} }`
}

/**
 * The DS light theme's own values under `prefers-color-scheme: light`, for a
 * provider that follows the system: its server render carries the dark theme
 * (the server cannot see the OS), so a key the tokens leave out would paint
 * dark on a light OS until hydration. A key the flat tokens set is left out:
 * the flat value holds in every mode and the base rule already carries it.
 * Emit it before `modeRules`, which lays the app's light values over it.
 */
export function systemLightRule(
  scope: string,
  flat: ThemeTokens,
  variableOf: VariableOf,
): string | null {
  const lines = (['colors', 'shadows'] as const).flatMap((group) => {
    const values: Record<string, string> = group === 'colors' ? lightColors : lightShadows
    const set = (flat[group] ?? {}) as Record<string, unknown>
    return Object.entries(values).flatMap(([key, value]) => {
      const variable = key in set ? null : variableOf(group, key)
      return variable ? [`${variable}: ${value};`] : []
    })
  })
  return lines.length === 0
    ? null
    : `@media (prefers-color-scheme: light) { ${selectorOf(scope)} { ${lines.join(' ')} } }`
}

/**
 * The conditional blocks that follow `overrideRule`, or null when there are
 * none. Same selector, so source order decides: under a `system` source the
 * `prefers-color-scheme` blocks (light, then dark), then the
 * `prefers-contrast: more` blocks for each scheme; under a pinned source the
 * one `prefers-contrast: more` block of the theme's mode. Each block holds
 * only its layer. Under `system` the base rule must carry the flat values
 * only (the server cannot know the mode), so each scheme block lays its mode
 * on them; pinned, the base rule carries the flat values and the theme's own
 * mode. `mode` null (the `high-contrast` theme) emits nothing.
 */
export function modeRules(
  scope: string,
  modes: ModeLayers | undefined,
  mode: ModeName | null,
  source: SchemeSource,
  variableOf: VariableOf,
): string | null {
  if (!modes || !mode) return null
  const selector = selectorOf(scope)
  const block = (query: string, tokens: ThemeTokens) => {
    const lines = declarations(tokens, variableOf)
    return lines.length === 0 ? [] : [`@media ${query} { ${selector} { ${lines.join(' ')} } }`]
  }
  const blocks =
    source === 'system'
      ? [
          ...block('(prefers-color-scheme: light)', modes.light),
          ...block('(prefers-color-scheme: dark)', modes.dark),
          ...block(
            '(prefers-contrast: more) and (prefers-color-scheme: light)',
            modes.contrastLight,
          ),
          ...block('(prefers-contrast: more) and (prefers-color-scheme: dark)', modes.contrastDark),
        ]
      : block(
          '(prefers-contrast: more)',
          mode === 'light' ? modes.contrastLight : modes.contrastDark,
        )
  return blocks.length === 0 ? null : blocks.join(' ')
}
