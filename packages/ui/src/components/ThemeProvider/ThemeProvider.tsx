import {createContext, type ReactNode, useContext, useEffect, useId, useMemo, useState} from 'react'
import {css, html} from 'react-strict-dom'
import {validateModeTokens, type ThemableGroup} from '@greenharness/greenrack-tokens/theme'
import {colors} from '@greenharness/greenrack-tokens/tokens/colors.css'
import {lightTheme, lightShadows} from '@greenharness/greenrack-tokens/themes/light.css'
import {
  highContrastTheme,
  highContrastShadows,
} from '@greenharness/greenrack-tokens/themes/high-contrast.css'
import {layers} from '@greenharness/greenrack-tokens/tokens/layers.css'
import {
  mergeOverrides,
  modeOf,
  OverridesContext,
  ownTokens,
  stateTokens,
  type ColorOverrides,
  type ThemeTokens,
  type ThemeTokensByMode,
} from './overrides'
import {modeRules, overrideRule, systemLightRule, variableFromReference} from './overrideRule'
import {SchemeSourceContext} from './schemeSource'
import {TOKEN_GROUPS} from './tokenGroups'
import {warnDropped} from './warnDropped'

export type ThemeName = 'dark' | 'light' | 'high-contrast'
export type {ColorOverrides, ThemeTokens, ThemeTokensByMode}

interface ThemeProviderProps {
  theme?: ThemeName
  /**
   * Colours that replace the theme's own, by token key (`{accent: '#ff5a1f'}`).
   * They update in place, without a re-mount. A nested provider on the same
   * theme keeps these and lays its own over them.
   */
  overrides?: ColorOverrides
  /**
   * Token values that replace the theme's own, keyed by group: `colors`,
   * `shadows`, `typography`, `typeScale`, `spacing`, `layoutSpacing`, `radii`,
   * `sizes`, `borders`, `duration`, `easing` and `effects`, each a partial
   * record of that group's keys (`{radii: {md: '6px'}}`). An app passes its
   * theme file as is. `layers`, `breakpoints`, `microSpacing`, `radii.px6` and
   * `radii.full` are refused, and `sizes.touchTarget` (44px),
   * `borders.focusRing` (2px) and `borders.focusOffset` keep their floors.
   * Invalid entries are dropped with one development warning. `colors` and
   * `shadows` reset when a nested provider changes theme; every other group
   * inherits. The app loads its own fonts; on native only the first family
   * applies (a face the app has loaded, at weights 400, 500, 600 and 700).
   * Keep `radii` ordered `xs <= sm <= md <= lg`. Native is unverified on a
   * device.
   *
   * Values per mode sit beside the groups: `light` and `dark` lay over the
   * flat groups in that mode, and `contrast.light` / `contrast.dark` lay over
   * that mode under `prefers-contrast: more`
   * (`{colors: {…}, light: {colors: {…}}, dark: {colors: {…}}, contrast: {dark: {colors: {…}}}}`).
   * The same refused groups, keys and floors hold inside each mode entry.
   * The `high-contrast` theme takes the flat groups only. Under a
   * ColorModeProvider on `system` the server cannot see the OS scheme, so the
   * provider it drives holds the flat values in its base rule and lays each
   * mode on them in a `prefers-color-scheme` block, so every value it sets is
   * right before hydration; a nested provider is pinned to its own theme. A
   * colour or shadow key the tokens leave out takes the DS light theme's value
   * under `prefers-color-scheme: light` and the dark theme's otherwise, also
   * before hydration. A nested provider
   * that follows the mode (`theme={useColorMode().theme}`) paints `dark` until
   * hydration under `system`: pass the tokens to ColorModeProvider instead.
   * Native takes the flat groups and the theme's mode; `contrast` does not
   * apply there.
   */
  tokens?: ThemeTokensByMode
  children: ReactNode
}

const themeMap: Partial<Record<ThemeName, readonly [typeof lightTheme, typeof lightShadows]>> = {
  light: [lightTheme, lightShadows],
  'high-contrast': [highContrastTheme, highContrastShadows],
}

const styles = css.create({
  root: {
    display: 'contents',
    color: colors.text,
  },
  // Sibling overlay where floating popups (Combobox, Menu, Tooltip) portal to.
  // Lives inside ThemeProvider so theme tokens cascade. Fixed + inset 0 so
  // popups can position freely with viewport coords; pointer-events: none lets
  // clicks fall through except where children re-enable them.
  portalMount: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    // The stacking context the layers scale orders: Dialog, Drawer, the
    // popups and toasts all portal in here.
    zIndex: layers.portal,
  },
})

// react-strict-dom's style prop rejects Theme<VarGroup<{named keys}>> because the
// concrete VarGroup lacks the generic index signature. This is a known typing gap.
type DivStyle = Parameters<typeof html.div>[0]['style']

const PortalMountContext = createContext<HTMLElement | null>(null)

export function usePortalMount(): HTMLElement | null {
  return useContext(PortalMountContext)
}

/** `var(--bg-x1y2)` → `--bg-x1y2`: the compiled variable a token key names. */
function variableOf(group: ThemableGroup, key: string): string | null {
  return variableFromReference((TOKEN_GROUPS[group] as Record<string, unknown>)[key])
}

export function ThemeProvider({theme = 'dark', overrides, tokens, children}: ThemeProviderProps) {
  const themeStyles = themeMap[theme]
  const style = [themeStyles?.[0], themeStyles?.[1], styles.root] as DivStyle
  const [mount, setMount] = useState<HTMLElement | null>(null)
  const scope = useId()
  const outer = useContext(OverridesContext)
  const source = useContext(SchemeSourceContext)
  const checked = useMemo(
    () => validateModeTokens(ownTokens(overrides, tokens)),
    [overrides, tokens],
  )
  useEffect(() => warnDropped(checked.dropped), [checked])
  const effective = useMemo(
    () => mergeOverrides(outer, theme, checked.kept.flat, checked.kept),
    [outer, theme, checked],
  )
  const rule = useMemo(() => {
    const mode = modeOf(theme)
    // Under `system` the server cannot see the OS scheme, so the base rule
    // holds the flat values only and each scheme block lays its mode on them.
    const base = source === 'system' && mode ? effective.tokens : stateTokens(effective, mode)
    const rules = [
      overrideRule(scope, base, variableOf),
      source === 'system' && mode ? systemLightRule(scope, effective.tokens, variableOf) : null,
      modeRules(scope, effective.modes, mode, source, variableOf),
    ].filter((part): part is string => part !== null)
    return rules.length === 0 ? null : rules.join(' ')
  }, [scope, effective, theme, source])

  return (
    <html.div data-theme={theme} data-gr-theme={rule ? scope : undefined} style={style}>
      {/* A plain, updating <style> (react-strict-dom has no html.style): no
          href or precedence, which would make React hoist it once and ignore
          later changes. */}
      {rule ? <style>{rule}</style> : null}
      <OverridesContext.Provider value={effective}>
        {/* Every nested provider is pinned to its own theme. */}
        <SchemeSourceContext.Provider value="pinned">
          <PortalMountContext.Provider value={mount}>{children}</PortalMountContext.Provider>
        </SchemeSourceContext.Provider>
      </OverridesContext.Provider>
      <html.div ref={setMount} data-portal-mount style={styles.portalMount} />
    </html.div>
  )
}
