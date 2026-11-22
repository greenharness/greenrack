import {createContext} from 'react'
import type {ColorToken} from '@greenharness/greenrack-tokens/keys'
import {
  layerTokens,
  modeOf,
  type ModeName,
  type ModeTokens,
  type ThemeTokens,
  type ThemeTokensByMode,
} from '@greenharness/greenrack-tokens/theme'

/** Colours that replace a theme's own, by token key. */
export type ColorOverrides = Partial<Record<ColorToken, string>>
export type {ThemeTokens, ThemeTokensByMode}
export {modeOf}

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

/** A provider's own validated mode entries. */
export type OwnModes = Omit<ModeTokens, 'flat'>

/** No mode entries of a provider's own. */
export const NO_OWN_MODES: OwnModes = {light: {}, dark: {}, contrast: {light: {}, dark: {}}}

type Groups = Record<string, Record<string, string>>
const groupsOf = (tokens: ThemeTokens | undefined) => (tokens ?? {}) as Groups

/** `tokens` without the keys `shadowed` defines: a lower layer that re-states them now wins. */
function without(tokens: ThemeTokens, ...shadowed: ThemeTokens[]): ThemeTokens {
  const kept: Groups = {}
  for (const [group, entries] of Object.entries(groupsOf(tokens))) {
    const left = Object.fromEntries(
      Object.entries(entries).filter(
        ([key]) => !shadowed.some((tokens) => key in (groupsOf(tokens)[group] ?? {})),
      ),
    )
    if (Object.keys(left).length > 0) kept[group] = left
  }
  return kept as ThemeTokens
}

const isEmpty = (tokens: ThemeTokens) => Object.keys(tokens).length === 0

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
 * Pure: `own` and `ownModes` are already validated (`validateModeTokens`),
 * and warnings are the provider's job, from an effect.
 */
export function mergeOverrides(
  outer: EffectiveOverrides,
  theme: string,
  own: ThemeTokens,
  ownModes: OwnModes,
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
  const effective: EffectiveOverrides = {theme, tokens: merged as ThemeTokens}

  const inheritedModes = outer.modes
  const ownLayers = [ownModes.light, ownModes.dark, ownModes.contrast.light, ownModes.contrast.dark]
  if (!inheritedModes && ownLayers.every(isEmpty)) return effective
  const mode = (name: ModeName) =>
    layerTokens(without(inheritedModes?.[name] ?? {}, own), ownModes[name])
  const contrast = (name: ModeName, key: 'contrastLight' | 'contrastDark') =>
    layerTokens(without(inheritedModes?.[key] ?? {}, own, ownModes[name]), ownModes.contrast[name])
  const modes: ModeLayers = {
    light: mode('light'),
    dark: mode('dark'),
    contrastLight: contrast('light', 'contrastLight'),
    contrastDark: contrast('dark', 'contrastDark'),
  }
  if (Object.values(modes).every(isEmpty)) return effective
  return {...effective, modes}
}

/** The resolved values of a mode outside `prefers-contrast`: the flat tokens, then its mode layer. */
export function stateTokens(effective: EffectiveOverrides, mode: ModeName | null): ThemeTokens {
  if (!mode || !effective.modes) return effective.tokens
  return layerTokens(effective.tokens, effective.modes[mode])
}

/** The resolved values of a mode under `prefers-contrast: more`: its state, then its contrast layer. */
export function contrastStateTokens(effective: EffectiveOverrides, mode: ModeName): ThemeTokens {
  const base = stateTokens(effective, mode)
  if (!effective.modes) return base
  return layerTokens(base, effective.modes[mode === 'light' ? 'contrastLight' : 'contrastDark'])
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
