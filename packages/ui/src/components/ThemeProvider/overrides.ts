import {createContext} from 'react'
import type {ColorToken} from '@greenharness/greenrack-tokens/keys'
import type {ModeName, ThemeTokens, ThemeTokensByMode} from '@greenharness/greenrack-tokens/theme'

/** Colours that replace a theme's own, by token key. */
export type ColorOverrides = Partial<Record<ColorToken, string>>
export type {ThemeTokens, ThemeTokensByMode}

/**
 * The per-mode layers in force at a provider. A state's values are the flat
 * tokens, then its mode layer, then (under `prefers-contrast: more`) its
 * contrast layer, so a layer only holds what differs from the one under it.
 */
export interface ModeLayers {
  light: ThemeTokens
  dark: ThemeTokens
  contrastLight: ThemeTokens
  contrastDark: ThemeTokens
}

/** The tokens in force at a provider, and the theme they were made for. */
export interface EffectiveOverrides {
  theme: string | null
  /** The flat tokens: every mode. */
  tokens: ThemeTokens
  /** The per-mode layers; absent when no provider above gave any. */
  modes?: ModeLayers
}

export const OverridesContext = createContext<EffectiveOverrides>({theme: null, tokens: {}})

type Groups = Record<string, Record<string, string>>
const groupsOf = (tokens: ThemeTokens | undefined) => (tokens ?? {}) as Groups

/** `base` with `over` laid on it, group by group. */
function layer(base: ThemeTokens | undefined, over: ThemeTokens | undefined): ThemeTokens {
  const merged: Groups = {}
  for (const group of new Set([...Object.keys(groupsOf(base)), ...Object.keys(groupsOf(over))])) {
    const entries = {...groupsOf(base)[group], ...groupsOf(over)[group]}
    if (Object.keys(entries).length > 0) merged[group] = entries
  }
  return merged as ThemeTokens
}

/** `tokens` without the keys `shadowed` defines: a lower layer that re-states them now wins. */
function without(tokens: ThemeTokens, ...shadowed: ThemeTokens[]): ThemeTokens {
  const kept: Groups = {}
  for (const [group, entries] of Object.entries(groupsOf(tokens))) {
    const left = Object.fromEntries(
      Object.entries(entries).filter(
        ([key]) => !shadowed.some((s) => key in (groupsOf(s)[group] ?? {})),
      ),
    )
    if (Object.keys(left).length > 0) kept[group] = left
  }
  return kept as ThemeTokens
}

const isEmpty = (tokens: ThemeTokens) => Object.keys(tokens).length === 0

/** A provider's own validated mode entries. */
export interface OwnModes {
  light: ThemeTokens
  dark: ThemeTokens
  contrast: {light: ThemeTokens; dark: ThemeTokens}
}

/**
 * One rule on both platforms: colours and shadows are defined by every theme,
 * so a provider on the same theme as the one above it keeps that one's and
 * lays its own over them, and a provider on another theme starts from its own
 * theme's. Every other group is not tied to a theme: it always inherits, and
 * the child's entries lay over it.
 *
 * Mode layers are keyed by mode, so they are inherited whatever the outer
 * theme. The inherited state is resolved first and the child's own entries
 * laid over it: a child's flat value beats an inherited mode value for the
 * same key, and a child's mode value beats an inherited contrast value.
 * Pure: `own` is already validated (`validateModeTokens`), and warnings are
 * the provider's job, from an effect.
 */
export function mergeOverrides(
  outer: EffectiveOverrides,
  theme: string,
  own: ThemeTokens,
  ownModes?: OwnModes,
): EffectiveOverrides {
  const sameTheme = outer.theme === theme
  const merged: Groups = {}
  const groups = new Set<string>([...Object.keys(outer.tokens), ...Object.keys(own)])
  for (const group of groups) {
    const resetsOnThemeChange = group === 'colors' || group === 'shadows'
    const inherited =
      resetsOnThemeChange && !sameTheme
        ? {}
        : (outer.tokens as Record<string, Record<string, string> | undefined>)[group]
    const ownEntries = (own as Record<string, Record<string, string> | undefined>)[group]
    const entries = {...inherited, ...ownEntries}
    if (Object.keys(entries).length > 0) merged[group] = entries
  }
  const result: EffectiveOverrides = {theme, tokens: merged as ThemeTokens}

  const inheritedModes = outer.modes
  const hasOwn =
    ownModes !== undefined &&
    [ownModes.light, ownModes.dark, ownModes.contrast.light, ownModes.contrast.dark].some(
      (tokens) => !isEmpty(tokens),
    )
  if (!inheritedModes && !hasOwn) return result
  const mode = (name: ModeName) =>
    layer(without(inheritedModes?.[name] ?? {}, own), ownModes?.[name])
  const contrast = (name: ModeName, key: 'contrastLight' | 'contrastDark') =>
    layer(
      without(inheritedModes?.[key] ?? {}, own, ownModes?.[name] ?? {}),
      ownModes?.contrast[name],
    )
  const modes: ModeLayers = {
    light: mode('light'),
    dark: mode('dark'),
    contrastLight: contrast('light', 'contrastLight'),
    contrastDark: contrast('dark', 'contrastDark'),
  }
  if (Object.values(modes).every(isEmpty)) return result
  return {...result, modes}
}

/** The mode a theme takes values from: `high-contrast` takes the flat tokens only. */
export function modeOf(theme: string | null): ModeName | null {
  return theme === 'light' || theme === 'dark' ? theme : null
}

/** The resolved values of one state: flat, then the mode layer, then its contrast layer. */
export function stateTokens(
  effective: EffectiveOverrides,
  mode: ModeName | null,
  contrast = false,
): ThemeTokens {
  if (!mode || !effective.modes) return effective.tokens
  const withMode = layer(effective.tokens, effective.modes[mode])
  if (!contrast) return withMode
  return layer(withMode, effective.modes[mode === 'light' ? 'contrastLight' : 'contrastDark'])
}

/**
 * A provider's own tokens, as `validateModeTokens` takes them: `overrides` is
 * the colour alias and `tokens.colors` wins on a clash. Mode entries pass
 * through untouched.
 */
export function ownTokens(
  overrides: ColorOverrides | undefined,
  tokens: ThemeTokensByMode | undefined,
): ThemeTokensByMode {
  if (!overrides) return tokens ?? {}
  return {...tokens, colors: {...overrides, ...tokens?.colors}}
}
