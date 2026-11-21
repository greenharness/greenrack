import {afterEach, describe, expect, it, vi} from 'vitest'
import {validateModeTokens, validateTokens} from '@greenharness/greenrack-tokens/theme'
import {
  contrastStateTokens,
  mergeOverrides,
  modeOf,
  NO_OWN_MODES,
  ownTokens,
  stateTokens,
  type EffectiveOverrides,
} from '../src/components/ThemeProvider/overrides'
import {modeRules, overrideRule} from '../src/components/ThemeProvider/overrideRule'
import {nativeThemeInputs, resolvedColors} from '../src/components/ThemeProvider/nativeInputs'
import {warnDropped} from '../src/components/ThemeProvider/warnDropped'

const none: EffectiveOverrides = {theme: null, tokens: {}}
const merge = (outer: EffectiveOverrides, theme: string, own: unknown) =>
  mergeOverrides(outer, theme, validateTokens(own).kept, NO_OWN_MODES)

afterEach(() => vi.restoreAllMocks())

describe('mergeOverrides', () => {
  it('is pure: it prints nothing, even for an invalid entry', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    merge(none, 'dark', {radii: {md: '-1px'}, sizes: {touchTarget: '40px'}})
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it('resets colours and shadows on a theme change and inherits every other group', () => {
    const outer = merge(none, 'dark', {
      colors: {accent: '#fff'},
      shadows: {sm: '0 1px 2px rgba(0, 0, 0, 0.3)'},
      typography: {fontFamily: 'Menlo'},
      radii: {md: '6px'},
      sizes: {dialogSm: '300px'},
      duration: {base: '250ms'},
    })
    const other = merge(outer, 'light', undefined)
    expect(other.tokens).toEqual({
      typography: {fontFamily: 'Menlo'},
      radii: {md: '6px'},
      sizes: {dialogSm: '300px'},
      duration: {base: '250ms'},
    })
    const same = merge(outer, 'dark', {colors: {bg: '#000'}})
    expect(same.tokens.colors).toEqual({accent: '#fff', bg: '#000'})
    expect(same.tokens.shadows).toEqual({sm: '0 1px 2px rgba(0, 0, 0, 0.3)'})
  })

  it('leaves the inherited value where the child entry is invalid', () => {
    const outer = merge(none, 'dark', {radii: {md: '6px'}})
    const inner = merge(outer, 'dark', {radii: {md: '-1px', sm: '2px'}})
    expect(inner.tokens.radii).toEqual({md: '6px', sm: '2px'})
    expect(merge(inner, 'dark', undefined).tokens.radii).toEqual({md: '6px', sm: '2px'})
  })

  it('refuses px6 and full, layers and breakpoints at runtime', () => {
    const merged = merge(none, 'dark', {
      radii: {px6: '1px', full: '1px', xs: '1px'},
      layers: {modal: '5'},
      breakpoints: {md: '10px'},
    })
    expect(merged.tokens).toEqual({radii: {xs: '1px'}})
  })
})

describe('ownTokens', () => {
  it('takes overrides as the colour alias, and tokens.colors wins on a clash', () => {
    expect(
      ownTokens({bg: '#111', accent: '#222'}, {colors: {accent: '#333'}, radii: {md: '0'}}),
    ).toEqual({colors: {bg: '#111', accent: '#333'}, radii: {md: '0'}})
    expect(ownTokens(undefined, undefined)).toEqual({})
  })
})

describe('nativeThemeInputs', () => {
  it('builds one input per group, with the first family unquoted', () => {
    const effective = merge(none, 'dark', {
      colors: {accent: '#fff'},
      typography: {fontFamilyMono: '"JetBrains Mono", monospace', fontSizeMd: '1.25rem'},
      radii: {md: '6px'},
    })
    expect(nativeThemeInputs(effective)).toEqual({
      colors: {accent: '#fff'},
      typography: {fontFamilyMono: 'JetBrains Mono', fontSizeMd: '1.25rem'},
      radii: {md: '6px'},
    })
  })

  it('resolves colours from the palette plus the colour overrides only', () => {
    const palette = {bg: '#000', accent: '#00f', text: '#eee'}
    const inputs = nativeThemeInputs(
      merge(none, 'dark', {colors: {accent: '#fff'}, radii: {md: '6px'}}),
    )
    const resolved = resolvedColors(palette, inputs.colors)
    expect(resolved.bg).toBe('#000')
    expect(resolved.accent).toBe('#fff')
    expect(Object.keys(resolved).sort()).toEqual(['accent', 'bg', 'text'])
  })

  it('leaves out a group with no entries, and its colours stay colours only', () => {
    const inputs = nativeThemeInputs(merge(none, 'dark', {colors: {accent: '#fff'}}))
    expect(Object.keys(inputs)).toEqual(['colors'])
    expect(inputs.colors).toEqual({accent: '#fff'})
  })
})

describe('overrideRule', () => {
  const variableOf = (group: string, key: string) => `--${group}-${key}`
  const tokens = validateTokens({
    colors: {bg: '#1b2433'},
    shadows: {sm: '0 1px 2px rgba(0, 0, 0, 0.3)'},
    typography: {fontFamily: 'Menlo, monospace'},
    typeScale: {displaySm: 'clamp(2rem, 1rem + 2vw, 3rem)'},
    spacing: {md: '20px'},
    layoutSpacing: {stackMd: '1rem'},
    radii: {md: '6px'},
    sizes: {dialogSm: '300px'},
    borders: {focusRing: '3px'},
    duration: {base: '250ms'},
    easing: {standard: 'ease-in-out'},
    effects: {overlayBlur: 'blur(4px)'},
  }).kept

  it('emits a variable for every group, identically on repeat', () => {
    const first = overrideRule('s', tokens, variableOf)
    expect(first).toBe(
      '[data-gr-theme="s"][data-gr-theme="s"] { --colors-bg: #1b2433; ' +
        '--shadows-sm: 0 1px 2px rgba(0, 0, 0, 0.3); --typography-fontFamily: Menlo, monospace; ' +
        '--typeScale-displaySm: clamp(2rem, 1rem + 2vw, 3rem); --spacing-md: 20px; ' +
        '--layoutSpacing-stackMd: 1rem; --radii-md: 6px; --sizes-dialogSm: 300px; ' +
        '--borders-focusRing: 3px; --duration-base: 250ms; --easing-standard: ease-in-out; ' +
        '--effects-overlayBlur: blur(4px); }',
    )
    expect(overrideRule('s', tokens, variableOf)).toBe(first)
  })

  it('builds on the server, where there is no CSS global', () => {
    expect(typeof (globalThis as {CSS?: unknown}).CSS).toBe('undefined')
    expect(overrideRule('«r1»', {colors: {bg: '#1b2433'}}, variableOf)).toBe(
      '[data-gr-theme="«r1»"][data-gr-theme="«r1»"] { --colors-bg: #1b2433; }',
    )
  })

  it('drops a value that could leave its declaration or rule, and renders nothing for none', () => {
    for (const bg of ['red} body{background:red', 'red; color: blue', 'url("x")']) {
      expect(overrideRule('s', {colors: {bg}}, variableOf)).toBeNull()
    }
    expect(overrideRule('s', {radii: {md: '6px; x:y'}}, variableOf)).toBeNull()
    expect(overrideRule('s', {}, variableOf)).toBeNull()
  })

  it('skips a key with no compiled variable', () => {
    expect(overrideRule('s', {colors: {bg: '#fff'}}, () => null)).toBeNull()
  })
})

describe('warnDropped', () => {
  it('warns once per distinct dropped entry, naming group, key and reason', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const {dropped} = validateTokens({sizes: {touchTarget: '41px'}})
    warnDropped(dropped)
    warnDropped(dropped)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain(
      'sizes.touchTarget: 41px is under the 44px floor',
    )
  })
})

describe('per-mode tokens', () => {
  const mergeModes = (outer: EffectiveOverrides, theme: string, own: unknown) => {
    const {kept} = validateModeTokens(own)
    return mergeOverrides(outer, theme, kept.flat, kept)
  }
  const app = {
    typography: {fontFamily: 'Menlo'},
    light: {colors: {bg: '#fff', accent: '#111'}},
    dark: {colors: {bg: '#000', accent: '#eee'}},
    contrast: {dark: {colors: {accent: '#fff'}}},
  }

  it('resolves a state as flat, then its mode, then its contrast layer', () => {
    const root = mergeModes(none, 'dark', app)
    expect(stateTokens(root, 'dark')).toEqual({
      typography: {fontFamily: 'Menlo'},
      colors: {bg: '#000', accent: '#eee'},
    })
    expect(contrastStateTokens(root, 'dark').colors).toEqual({bg: '#000', accent: '#fff'})
    expect(stateTokens(root, modeOf('high-contrast'))).toEqual({typography: {fontFamily: 'Menlo'}})
  })

  it('lets a child flat value beat an inherited mode value, through a grandchild', () => {
    const root = mergeModes(none, 'dark', app)
    const child = mergeModes(root, 'dark', {colors: {accent: '#0f0'}})
    expect(stateTokens(child, 'dark').colors).toEqual({bg: '#000', accent: '#0f0'})
    expect(stateTokens(child, 'light').colors).toEqual({bg: '#fff', accent: '#0f0'})
    // The child's own flat value also beats the inherited contrast layer.
    expect(contrastStateTokens(child, 'dark').colors?.accent).toBe('#0f0')
    const grandchild = mergeModes(child, 'dark', undefined)
    expect(stateTokens(grandchild, 'dark').colors).toEqual({bg: '#000', accent: '#0f0'})
    // A child's own mode value beats the inherited contrast value for the same key.
    const moded = mergeModes(root, 'dark', {dark: {colors: {accent: '#00f'}}})
    expect(contrastStateTokens(moded, 'dark').colors?.accent).toBe('#00f')
  })

  it("gives a dark island the same rule under a pinned and a system outer, and outer's theme does not matter", () => {
    const variableOf = (group: string, key: string) => `--${group}-${key}`
    const islandRule = (outerTheme: string) => {
      const outer = mergeModes(none, outerTheme, app)
      const island = mergeModes(outer, 'dark', undefined)
      // A nested provider is always pinned (the context reset).
      return [
        overrideRule('i', stateTokens(island, modeOf('dark')), variableOf),
        modeRules('i', island.modes, 'dark', 'pinned', variableOf),
      ].join(' ')
    }
    expect(islandRule('light')).toBe(islandRule('dark'))
    expect(islandRule('dark')).toContain('--colors-bg: #000;')
    expect(islandRule('dark')).not.toContain('prefers-color-scheme')
  })

  // warnDropped dedupes per process: each test uses a value no other test does.
  it('warns once per mode for the same bad value in light and dark', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const {dropped} = validateModeTokens({
      light: {colors: {bg: 'nope('}},
      dark: {colors: {bg: 'nope('}},
    })
    warnDropped(dropped)
    expect(warn).toHaveBeenCalledTimes(2)
    expect(String(warn.mock.calls[0][0])).toContain('light.colors.bg')
    expect(String(warn.mock.calls[1][0])).toContain('dark.colors.bg')
  })

  it('warns for a value JSON cannot hold, without throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const {dropped} = validateModeTokens({dark: {colors: {bg: cyclic}}, light: {colors: {bg: 10n}}})
    expect(() => warnDropped(dropped)).not.toThrow()
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('keeps no mode layers for flat-only tokens', () => {
    expect(mergeModes(none, 'dark', {colors: {bg: '#000'}}).modes).toBeUndefined()
  })
})
