// What ThemeProvider's `tokens` prop and `greenrack mockup seed --overrides` accept,
// in one pure module (no React, web or native imports): the themable groups and
// their keys, the groups and keys that are refused, the value rule of each key,
// the guard rails, and `validateTokens`, which says what is kept and what is
// dropped and why. The UI and the CLI both import this, so there is one rule.

import {
  BORDER_KEYS,
  DURATION_KEYS,
  EASING_KEYS,
  EFFECT_KEYS,
  LAYOUT_SPACING_KEYS,
  RADIUS_KEYS,
  ROOT_FONT_PX,
  SHADOW_KEYS,
  SIZE_KEYS,
  SPACING_KEYS,
  TYPE_SCALE_KEYS,
  TYPOGRAPHY_KEYS,
} from './keys'
import type {ColorToken} from './keys'
import {darkColors} from './raw'
import {GROUP_ALIASES, kebab} from './names'

export {GROUP_ALIASES, kebab}

// Value kinds.

const NUMBER = String.raw`(?:\d+(?:\.\d+)?|\.\d+)`
const LENGTH = String.raw`(?:0|${NUMBER}(?:px|rem))`
const LENGTH_PATTERN = new RegExp(`^${LENGTH}$`)
const VIEWPORT_PATTERN = new RegExp(`^${NUMBER}(?:vw|svh)$`)
const VIEWPORT_SUM_PATTERN = new RegExp(`^${LENGTH}\\s*\\+\\s*${NUMBER}(?:vw|svh)$`)
const LETTER_SPACING_PATTERN = new RegExp(`^(?:0|[+-]?${NUMBER}(?:em|px))$`)
const DURATION_PATTERN = new RegExp(`^${NUMBER}(?:ms|s)$`)
const SIGNED_NUMBER = String.raw`[+-]?${NUMBER}`
const CUBIC_BEZIER_PATTERN = new RegExp(
  `^cubic-bezier\\(\\s*${SIGNED_NUMBER}\\s*,\\s*${SIGNED_NUMBER}\\s*,\\s*${SIGNED_NUMBER}\\s*,\\s*${SIGNED_NUMBER}\\s*\\)$`,
)
const BLUR_PATTERN = new RegExp(`^blur\\(${LENGTH}\\)$`)
const EASING_KEYWORDS = ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out']
const FORBIDDEN_IN_FONT_FAMILY = /[;{}<>\\]|\/\*|\*\/|url\(|var\(|expression\(/i
const FONT_FAMILY_ITEM = /^(?:[A-Za-z_-][\w -]*|"[^"'\\]*"|'[^"'\\]*')$/

/** A value that is a colour and nothing else, so it cannot leave its rule. */
export function isSafeColor(value: string): boolean {
  // The same answer on the server and in the browser (no CSS.supports), so a
  // server-rendered rule hydrates unchanged: a hex, a colour function, or a
  // keyword, with nothing that could close the declaration or the rule.
  if (/[;{}<>"'\\]/.test(value)) return false
  return (
    /^#[0-9a-f]{3,8}$/i.test(value) ||
    /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^()]*\)$/i.test(value) ||
    /^[a-z]+$/i.test(value)
  )
}

/** A comma-separated font-family list: identifiers or balanced quoted names. */
export function isSafeFontFamily(value: string): boolean {
  if (FORBIDDEN_IN_FONT_FAMILY.test(value)) return false
  return value.split(',').every((item) => FONT_FAMILY_ITEM.test(item.trim()))
}

/** `0`, or a non-negative number with `px` or `rem`. */
export function isSafeLength(value: string): boolean {
  return LENGTH_PATTERN.test(value)
}

/** Split on commas outside parentheses: `a, rgba(0, 0, 0, 1)` is two items. */
function splitTopLevel(value: string): string[] {
  const items: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < value.length; index++) {
    const char = value[index]
    if (char === '(') depth++
    else if (char === ')') depth--
    else if (char === ',' && depth === 0) {
      items.push(value.slice(start, index))
      start = index + 1
    }
  }
  items.push(value.slice(start))
  return items.map((item) => item.trim())
}

function isFluidItem(item: string): boolean {
  return LENGTH_PATTERN.test(item) || VIEWPORT_PATTERN.test(item) || VIEWPORT_SUM_PATTERN.test(item)
}

/** A length, or `clamp(` of three lengths, viewport numbers or `<length> + <n>vw|svh` sums. */
function isFluidLength(value: string): boolean {
  if (LENGTH_PATTERN.test(value)) return true
  const clamp = /^clamp\((.*)\)$/.exec(value)
  if (!clamp) return false
  const items = splitTopLevel(clamp[1])
  return items.length === 3 && items.every(isFluidItem)
}

/** One `[inset] <length>{2,4} <colour>` shadow. */
function isShadow(value: string): boolean {
  let rest = value.replace(/^inset\s+/, '')
  let lengths = 0
  for (;;) {
    const match = new RegExp(`^(${LENGTH})\\s+`).exec(rest)
    if (!match) break
    lengths++
    rest = rest.slice(match[0].length)
  }
  return lengths >= 2 && lengths <= 4 && isSafeColor(rest.trim())
}

function isShadowList(value: string): boolean {
  return splitTopLevel(value).every(isShadow)
}

function isLineHeight(value: string): boolean {
  if (!new RegExp(`^${NUMBER}$`).test(value)) return false
  const number = Number(value)
  return number >= 1 && number <= 3
}

function isEasing(value: string): boolean {
  return EASING_KEYWORDS.includes(value) || CUBIC_BEZIER_PATTERN.test(value)
}

type ValueKind =
  | 'color'
  | 'shadow'
  | 'fontFamily'
  | 'length'
  | 'fluidLength'
  | 'letterSpacing'
  | 'fontWeight'
  | 'lineHeight'
  | 'duration'
  | 'easing'
  | 'effect'

/** One rule per kind of value: whether it holds, and the wording of the reason it does not. */
const KINDS: Record<
  ValueKind,
  {isValid: (value: string) => boolean; reason: (value: string) => string}
> = {
  color: {
    isValid: isSafeColor,
    reason: (value) => `"${value}" is not a CSS colour (a hex, a colour function or a keyword)`,
  },
  shadow: {
    isValid: isShadowList,
    reason: (value) =>
      `"${value}" must be a comma-separated list of [inset] <2 to 4 lengths> <colour>`,
  },
  fontFamily: {isValid: isSafeFontFamily, reason: fontFamilyProblem},
  length: {
    isValid: isSafeLength,
    reason: (value) => `"${value}" must be 0 or a non-negative px/rem length`,
  },
  fluidLength: {
    isValid: isFluidLength,
    reason: (value) =>
      `"${value}" must be a px/rem length or clamp() of three lengths, <n>vw|svh or <length> + <n>vw|svh`,
  },
  letterSpacing: {
    isValid: (value) => LETTER_SPACING_PATTERN.test(value),
    reason: (value) => `"${value}" must be 0 or a number with em or px`,
  },
  fontWeight: {
    isValid: (value) => /^[1-9]00$/.test(value),
    reason: (value) => `"${value}" must be a weight from 100 to 900 in steps of 100`,
  },
  lineHeight: {
    isValid: isLineHeight,
    reason: (value) => `"${value}" must be a unitless number from 1 to 3`,
  },
  duration: {
    isValid: (value) => DURATION_PATTERN.test(value),
    reason: (value) => `"${value}" must be a non-negative number with ms or s`,
  },
  easing: {
    isValid: isEasing,
    reason: (value) =>
      `"${value}" must be linear, ease, ease-in, ease-out, ease-in-out or cubic-bezier() of four numbers`,
  },
  effect: {
    isValid: (value) => BLUR_PATTERN.test(value),
    reason: (value) => `"${value}" must be blur(<length>)`,
  },
}

/** The part of a refused font-family list that breaks the rule. */
function fontFamilyProblem(value: string): string {
  const forbidden = FORBIDDEN_IN_FONT_FAMILY.exec(value)
  if (forbidden) return `"${forbidden[0]}" is not allowed in a font-family list`
  const item = value.split(',').find((entry) => !FONT_FAMILY_ITEM.test(entry.trim()))
  const refused = (item ?? value).trim()
  return /["']/.test(refused)
    ? `"${refused}" has an unbalanced or mixed quote in a font-family list`
    : `"${refused}" is not a font name or a quoted name in a font-family list`
}

// The group table.

const COLOR_KEYS = Object.keys(darkColors) as readonly ColorToken[]
const RADIUS_THEMABLE_KEYS = RADIUS_KEYS.filter(
  (key): key is Exclude<(typeof RADIUS_KEYS)[number], 'px6' | 'full'> =>
    key !== 'px6' && key !== 'full',
)

function typographyKind(key: string): ValueKind {
  if (key.startsWith('fontFamily')) return 'fontFamily'
  if (key.startsWith('fontWeight')) return 'fontWeight'
  if (key === 'lineHeight') return 'lineHeight'
  return 'length'
}

function typeScaleKind(key: string): ValueKind {
  if (key.startsWith('display')) return 'fluidLength'
  if (key.startsWith('letterSpacing')) return 'letterSpacing'
  return 'length'
}

interface GroupSpec {
  keys: readonly string[]
  kindOf: (key: string) => ValueKind
  /** Smallest value in px a key may take: a guarantee the design system makes. */
  floors?: Readonly<Record<string, number>>
}

const always = (kind: ValueKind) => () => kind

const SPECS = {
  colors: {keys: COLOR_KEYS, kindOf: always('color')},
  shadows: {keys: SHADOW_KEYS, kindOf: always('shadow')},
  typography: {keys: TYPOGRAPHY_KEYS, kindOf: typographyKind},
  typeScale: {keys: TYPE_SCALE_KEYS, kindOf: typeScaleKind},
  spacing: {keys: SPACING_KEYS, kindOf: always('length')},
  layoutSpacing: {keys: LAYOUT_SPACING_KEYS, kindOf: always('length')},
  radii: {keys: RADIUS_THEMABLE_KEYS, kindOf: always('length')},
  sizes: {keys: SIZE_KEYS, kindOf: always('length'), floors: {touchTarget: 44}},
  borders: {
    keys: BORDER_KEYS,
    kindOf: always('length'),
    floors: {focusRing: 2, focusOffset: 0, focusOffsetSm: 0},
  },
  duration: {keys: DURATION_KEYS, kindOf: always('duration')},
  easing: {keys: EASING_KEYS, kindOf: always('easing')},
  effects: {keys: EFFECT_KEYS, kindOf: always('effect')},
} as const satisfies Record<string, GroupSpec>

/** The groups `tokens` can theme, in the order a rule lists them. */
export type ThemableGroup = keyof typeof SPECS
export const THEMABLE_GROUPS = Object.keys(SPECS) as readonly ThemableGroup[]

/** The keys each themable group accepts. */
export const GROUP_KEYS: {readonly [Group in ThemableGroup]: readonly string[]} =
  Object.fromEntries(THEMABLE_GROUPS.map((group) => [group, SPECS[group].keys])) as {
    readonly [Group in ThemableGroup]: readonly string[]
  }

/** Groups refused whole, with why. */
export const REFUSED_GROUPS: Readonly<Record<string, string>> = {
  layers: 'layers are not themable: they order one stacking context',
  breakpoints: 'breakpoints are not themable: media queries and JS read them',
  microSpacing: 'microSpacing is not themable: its keys are named after their value',
}

/** Keys refused inside a themable group, with why. */
export const REFUSED_KEYS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  radii: {
    px6: 'radii.px6 is not themable: it is named after its value',
    full: 'radii.full is not themable: it is a shape, not a size',
  },
}

/** The value of a themable group, by token key. */
export type ThemeTokens = {
  readonly [Group in ThemableGroup]?: Partial<Record<(typeof SPECS)[Group]['keys'][number], string>>
}

// Validation.

/** One entry that was refused, and the single wording of why. */
export interface DroppedToken {
  /**
   * The group, or null when what was refused is not in a group: a mode entry
   * that is not an object, or a name misplaced inside one (then `key` names it).
   */
  group: string | null
  /** The key, or null when the whole group (or mode entry) is refused. */
  key: string | null
  value: unknown
  reason: string
  /** The mode entry it came from, absent for the flat groups. */
  mode?: ModePath
}

/** Where a mode entry sits in a provider's tokens. */
export type ModePath = 'light' | 'dark' | 'contrast' | 'contrast.light' | 'contrast.dark'

/**
 * `group.key: reason`, or `group: reason` for a whole group; a mode entry is
 * prefixed (`dark.colors.bg: …`, `dark.contrast: …`, `contrast: …`).
 */
export function describeDropped({group, key, reason, mode}: DroppedToken): string {
  const path = [mode, group, key].filter((part) => part != null).join('.')
  return `${path}: ${reason}`
}

function lengthInPx(value: string): number {
  const number = Number.parseFloat(value)
  return value.endsWith('rem') ? number * ROOT_FONT_PX : number
}

/** A caller value as text for a reason: never throws (a cycle, a BigInt). */
function valueText(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Reduce a provider's own tokens to the supported keys with valid values. */
export function validateTokens(own: unknown): {kept: ThemeTokens; dropped: DroppedToken[]} {
  const kept: Record<string, Record<string, string>> = {}
  const dropped: DroppedToken[] = []
  if (own === undefined || own === null) return {kept, dropped}
  if (!isRecord(own)) {
    return {
      kept,
      dropped: [
        {group: 'tokens', key: null, value: own, reason: 'expected an object keyed by token group'},
      ],
    }
  }
  for (const [group, entries] of Object.entries(own)) {
    if (!(THEMABLE_GROUPS as readonly string[]).includes(group)) {
      const refused = REFUSED_GROUPS[group]
      const reason = refused ?? `unknown group (expected ${THEMABLE_GROUPS.join(' | ')})`
      if (isRecord(entries) && refused !== undefined && Object.keys(entries).length > 0) {
        for (const [key, value] of Object.entries(entries)) {
          dropped.push({group, key, value, reason})
        }
      } else {
        dropped.push({group, key: null, value: entries, reason})
      }
      continue
    }
    if (entries === undefined) continue
    if (!isRecord(entries)) {
      dropped.push({group, key: null, value: entries, reason: 'expected an object of token values'})
      continue
    }
    const spec: GroupSpec = SPECS[group as ThemableGroup]
    for (const [key, raw] of Object.entries(entries)) {
      const refusedKey = REFUSED_KEYS[group]?.[key]
      if (refusedKey !== undefined) {
        dropped.push({group, key, value: raw, reason: refusedKey})
      } else if (!spec.keys.includes(key)) {
        dropped.push({
          group,
          key,
          value: raw,
          reason: `unknown token (expected ${spec.keys.join(' | ')})`,
        })
      } else if (typeof raw !== 'string') {
        dropped.push({group, key, value: raw, reason: `${valueText(raw)} must be a string`})
      } else {
        const value = raw.trim()
        const kind = KINDS[spec.kindOf(key)]
        const floor = spec.floors?.[key]
        if (!kind.isValid(value)) {
          dropped.push({group, key, value: raw, reason: kind.reason(value)})
        } else if (floor !== undefined && lengthInPx(value) < floor) {
          dropped.push({
            group,
            key,
            value: raw,
            reason: `${value} is under the ${floor}px floor`,
          })
        } else {
          kept[group] = {...kept[group], [key]: value}
        }
      }
    }
  }
  return {kept: kept as ThemeTokens, dropped}
}

// Values per mode (ADR-0003 revision): `light`, `dark` and `contrast` sit
// beside the flat groups and are reserved names, never groups. They stay
// reserved for good: freeing one for a token group is a major release.

/** The modes a token value can be keyed by. */
export type ModeName = 'light' | 'dark'

/**
 * A provider's tokens with optional values per mode: flat groups apply in
 * every mode, `light` / `dark` lay over them, and `contrast.light` /
 * `contrast.dark` lay over that mode under `prefers-contrast: more`.
 */
export type ThemeTokensByMode = ThemeTokens & {
  readonly light?: ThemeTokens
  readonly dark?: ThemeTokens
  readonly contrast?: {readonly light?: ThemeTokens; readonly dark?: ThemeTokens}
}

/** Validated tokens, split by where they apply. Every part is always present. */
export interface ModeTokens {
  flat: ThemeTokens
  light: ThemeTokens
  dark: ThemeTokens
  contrast: {light: ThemeTokens; dark: ThemeTokens}
}

const RESERVED_NAMES = ['light', 'dark', 'contrast'] as const
const isReserved = (name: string) => (RESERVED_NAMES as readonly string[]).includes(name)

/** Whether `own` carries any per-mode entry (a reserved name at the top). */
export function hasModeEntries(own: unknown): boolean {
  return isRecord(own) && Object.keys(own).some(isReserved)
}

/**
 * Peel the reserved mode entries off a provider's own tokens. The parts are
 * still unvalidated; a reserved name where it does not belong (`dark.contrast`,
 * `contrast.light.dark`), a name `contrast` does not take, or a mode entry
 * that is not an object is dropped here, with its path in `mode` and `key`.
 */
export function splitModes(own: unknown): {
  flat: unknown
  light: unknown
  dark: unknown
  contrast: {light: unknown; dark: unknown}
  dropped: DroppedToken[]
} {
  const dropped: DroppedToken[] = []
  if (!isRecord(own)) {
    return {
      flat: own,
      light: undefined,
      dark: undefined,
      contrast: {light: undefined, dark: undefined},
      dropped,
    }
  }
  const flat: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(own)) if (!isReserved(name)) flat[name] = value

  /** A mode entry with any reserved name inside it dropped. */
  const part = (value: unknown, mode: ModePath): unknown => {
    if (value === undefined) return undefined
    if (!isRecord(value)) {
      dropped.push({
        group: null,
        key: null,
        value,
        reason: 'expected an object keyed by token group',
        mode,
      })
      return undefined
    }
    const kept: Record<string, unknown> = {}
    for (const [name, entries] of Object.entries(value)) {
      if (isReserved(name)) {
        dropped.push({
          group: null,
          key: name,
          value: entries,
          reason: `${name} is a mode, not a group: it goes at the top of the tokens`,
          mode,
        })
      } else {
        kept[name] = entries
      }
    }
    return kept
  }

  const light = part(own.light, 'light')
  const dark = part(own.dark, 'dark')
  const contrast = {light: undefined as unknown, dark: undefined as unknown}
  if (own.contrast !== undefined) {
    if (!isRecord(own.contrast)) {
      dropped.push({
        group: null,
        key: null,
        value: own.contrast,
        reason: 'expected {light?, dark?}',
        mode: 'contrast',
      })
    } else {
      for (const [name, value] of Object.entries(own.contrast)) {
        if (name === 'light' || name === 'dark') {
          contrast[name] = part(value, `contrast.${name}`)
        } else {
          dropped.push({
            group: null,
            key: name,
            value,
            reason: 'expected light or dark: contrast takes values per mode',
            mode: 'contrast',
          })
        }
      }
    }
  }
  return {flat, light, dark, contrast, dropped}
}

/**
 * `validateTokens` for tokens that may carry mode entries: each part is
 * validated on its own, with the same refused groups, keys and floors, and a
 * dropped entry names its mode.
 */
export function validateModeTokens(own: unknown): {kept: ModeTokens; dropped: DroppedToken[]} {
  const split = splitModes(own)
  const dropped = [...split.dropped]
  const check = (value: unknown, mode?: ModePath): ThemeTokens => {
    const validated = validateTokens(value)
    for (const entry of validated.dropped) dropped.push(mode ? {...entry, mode} : entry)
    return validated.kept
  }
  const kept: ModeTokens = {
    flat: check(split.flat),
    light: check(split.light, 'light'),
    dark: check(split.dark, 'dark'),
    contrast: {
      light: check(split.contrast.light, 'contrast.light'),
      dark: check(split.contrast.dark, 'contrast.dark'),
    },
  }
  return {kept, dropped}
}

/** `base` with `over` laid on it, group by group: `over` wins for the same key. */
export function layerTokens(
  base: ThemeTokens | undefined,
  over: ThemeTokens | undefined,
): ThemeTokens {
  const groupsOf = (tokens: ThemeTokens | undefined) =>
    (tokens ?? {}) as Record<string, Record<string, string>>
  const merged: Record<string, Record<string, string>> = {}
  for (const group of new Set([...Object.keys(groupsOf(base)), ...Object.keys(groupsOf(over))])) {
    const entries = {...groupsOf(base)[group], ...groupsOf(over)[group]}
    if (Object.keys(entries).length > 0) merged[group] = entries
  }
  return merged as ThemeTokens
}

/**
 * The mode a theme takes values from: `light` and `dark` their own, and every
 * other theme (`high-contrast`) none, so it takes the flat values only. The
 * one rule both providers and the mockup seed apply.
 */
export function modeOf(theme: string | null): ModeName | null {
  return theme === 'light' || theme === 'dark' ? theme : null
}

/** The values a theme takes outside `prefers-contrast`: the flat groups, then its mode. */
export function tokensForTheme(
  tokens: Pick<ModeTokens, 'flat' | ModeName>,
  theme: string,
): ThemeTokens {
  const mode = modeOf(theme)
  return mode ? layerTokens(tokens.flat, tokens[mode]) : tokens.flat
}
