import {describe, expect, it} from 'vitest'
import {isSafeColor, modeRules, overrideRule} from '../src/components/ThemeProvider/overrideRule'

const variableOf = (_group: string, key: string) =>
  key === 'bg' ? '--bg-x1' : key === 'accent' ? '--accent-x2' : null

describe('ThemeProvider override rule', () => {
  it('builds on the server, where there is no CSS global', () => {
    expect(typeof (globalThis as {CSS?: unknown}).CSS).toBe('undefined')
    expect(
      overrideRule('«r1»', {colors: {bg: '#1b2433', accent: 'rgb(255, 90, 31)'}}, variableOf),
    ).toBe(
      '[data-gr-theme="«r1»"][data-gr-theme="«r1»"] { --bg-x1: #1b2433; --accent-x2: rgb(255, 90, 31); }',
    )
  })

  it('drops a value that could leave its declaration or rule', () => {
    expect(overrideRule('s', {colors: {bg: 'red} body{background:red'}}, variableOf)).toBeNull()
    expect(overrideRule('s', {colors: {bg: 'red; color: blue'}}, variableOf)).toBeNull()
    expect(overrideRule('s', {colors: {bg: 'url("x")'}}, variableOf)).toBeNull()
  })

  it('accepts hex, colour functions and keywords', () => {
    for (const ok of ['#fff', '#1b2433cc', 'rgba(0, 0, 0, 0.4)', 'oklch(70% 0.1 250)', 'tomato']) {
      expect(isSafeColor(ok)).toBe(true)
    }
    for (const bad of ['', 'calc(1px)', 'var(--x)', 'rgb(1, 2, 3) red', '12px']) {
      expect(isSafeColor(bad)).toBe(false)
    }
  })

  it('renders nothing for keys that are not colour tokens', () => {
    expect(overrideRule('s', {colors: {unknown: '#fff'}} as never, variableOf)).toBeNull()
  })
})

describe('ThemeProvider mode rules', () => {
  const sel = '[data-gr-theme="s"][data-gr-theme="s"]'
  const modes = {
    light: {colors: {bg: '#fff'}},
    dark: {colors: {bg: '#000'}},
    contrastLight: {colors: {accent: '#111'}},
    contrastDark: {colors: {accent: '#eee'}},
  }

  it('emits nothing without mode layers, so a flat-only rule is unchanged', () => {
    expect(modeRules('s', undefined, 'dark', 'system', variableOf)).toBeNull()
  })

  it('under system: the scheme blocks, light then dark, then the contrast blocks per scheme', () => {
    expect(modeRules('s', modes, 'dark', 'system', variableOf)).toBe(
      `@media (prefers-color-scheme: light) { ${sel} { --bg-x1: #fff; } } ` +
        `@media (prefers-color-scheme: dark) { ${sel} { --bg-x1: #000; } } ` +
        `@media (prefers-contrast: more) and (prefers-color-scheme: light) { ${sel} { --accent-x2: #111; } } ` +
        `@media (prefers-contrast: more) and (prefers-color-scheme: dark) { ${sel} { --accent-x2: #eee; } }`,
    )
  })

  it('pinned: one plain contrast block for the theme mode, no scheme block', () => {
    const pinned = modeRules('s', modes, 'light', 'pinned', variableOf)
    expect(pinned).toBe(`@media (prefers-contrast: more) { ${sel} { --accent-x2: #111; } }`)
    expect(pinned).not.toContain('prefers-color-scheme')
  })

  it('emits nothing for high-contrast, and leaves out an empty block', () => {
    expect(modeRules('s', modes, null, 'system', variableOf)).toBeNull()
    const partial = {...modes, contrastLight: {}, contrastDark: {}}
    expect(modeRules('s', partial, 'dark', 'system', variableOf)).not.toContain('prefers-contrast')
    expect(modeRules('s', partial, 'dark', 'pinned', variableOf)).toBeNull()
  })
})
