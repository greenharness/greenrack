import {act, useState} from 'react'
import type {Meta, StoryObj} from '@storybook/react'
import {expect, waitFor} from 'storybook/test'
import {css, html} from 'react-strict-dom'
import {colors} from '@greenharness/greenrack-tokens/tokens/colors.css'
import {sizes} from '@greenharness/greenrack-tokens/tokens/sizes.css'
import {radii, spacing} from '@greenharness/greenrack-tokens/tokens/spacing.css'
import {typography} from '@greenharness/greenrack-tokens/tokens/typography.css'
import {renderToString} from 'react-dom/server'
import {createRoot, hydrateRoot} from 'react-dom/client'
import {
  ThemeProvider,
  type ColorOverrides,
  type ThemeName,
  type ThemeTokensByMode,
} from './ThemeProvider'
import {ColorModeProvider} from '../ColorMode/ColorMode'
import {Button} from '../Button/Button'
import {Badge} from '../Badge/Badge'
import {Tabs} from '../Tabs/Tabs'
import {Select} from '../Select/Select'
import {Text} from '../Text/Text'

const meta: Meta = {
  title: 'Theme/ThemeProvider/Overrides',
}

export default meta

const styles = css.create({
  surface: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.bg,
    // Read the token, as components do, so the font assertions test the theme.
    fontFamily: typography.fontFamily,
  },
})

interface OverrideArgs {
  theme: ThemeName
  bg: string
  accent: string
}

/** Colours replaced by token key; the controls change them in place. */
export const Playground: StoryObj<OverrideArgs> = {
  args: {theme: 'dark', bg: '#1b2433', accent: '#ff5a1f'},
  argTypes: {
    theme: {control: 'inline-radio', options: ['dark', 'light', 'high-contrast']},
    bg: {control: 'color', description: 'overrides.bg'},
    accent: {control: 'color', description: 'overrides.accent'},
  },
  render: ({theme, bg, accent}) => (
    <ThemeProvider theme={theme} overrides={{bg, accent}}>
      <html.div style={styles.surface}>
        <Text>The page background and the primary fill come from overrides.</Text>
        <Button>Primary</Button>
      </html.div>
    </ThemeProvider>
  ),
}

const A: ColorOverrides = {bg: 'rgb(27, 36, 51)', accent: 'rgb(255, 90, 31)'}
const B: ColorOverrides = {bg: 'rgb(10, 60, 30)', accent: 'rgb(30, 144, 255)'}
const STEPS: readonly (ColorOverrides | undefined)[] = [A, B, A, undefined]

/** Steps through A, B, A and none, with a nested provider under each. */
function Stepper() {
  const [step, setStep] = useState(0)
  const overrides = STEPS[step]
  return (
    <ThemeProvider overrides={overrides}>
      <html.div data-testid="outer" style={styles.surface}>
        <Button onClick={() => setStep((s) => Math.min(s + 1, STEPS.length - 1))}>Next</Button>
        <ThemeProvider>
          <html.div data-testid="inherits" style={styles.surface} />
        </ThemeProvider>
        <ThemeProvider overrides={{bg: 'rgb(60, 10, 60)', accent: 'red} body{background:red'}}>
          <html.div data-testid="inner" style={styles.surface} />
        </ThemeProvider>
      </html.div>
    </ThemeProvider>
  )
}

const bgOf = (el: Element) => getComputedStyle(el).backgroundColor
const aliasOf = (el: Element) => getComputedStyle(el).getPropertyValue('--gr-color-bg').trim()

export const OverridesUpdateInPlace: StoryObj = {
  render: () => <Stepper />,
  play: async ({canvas, userEvent}) => {
    const outer = canvas.getByTestId('outer')
    const inherits = canvas.getByTestId('inherits')
    const inner = canvas.getByTestId('inner')
    const next = canvas.getByRole('button', {name: 'Next'})

    // The outer provider's scope while it has overrides.
    const provider = outer.parentElement!
    await waitFor(() => expect(provider.getAttribute('data-gr-theme')).toBeTruthy())
    const scope = provider.getAttribute('data-gr-theme')!

    for (const step of [A, B, A]) {
      await waitFor(() => expect(bgOf(outer)).toBe(step.bg))
      // Button's fill eases between colours: wait for it to settle.
      await waitFor(() => expect(getComputedStyle(next).backgroundColor).toBe(step.accent))
      // The --gr-* alias follows the override.
      await expect(aliasOf(outer)).toBe(step.bg)
      // A nested provider with no overrides, same theme: the outer's colours.
      await expect(bgOf(inherits)).toBe(step.bg)
      await expect(aliasOf(inherits)).toBe(step.bg)
      // A nested provider with its own: its colours inside, the outer's outside.
      await expect(bgOf(inner)).toBe('rgb(60, 10, 60)')
      await userEvent.click(next)
    }

    // No overrides: the theme's own colours, and no outer rule left.
    await waitFor(() => expect(bgOf(outer)).toBe('rgb(15, 15, 15)'))
    const rules = [...document.querySelectorAll('style')].map((s) => s.textContent ?? '')
    await expect(provider.hasAttribute('data-gr-theme')).toBe(false)
    await expect(rules.filter((r) => r.includes(`"${scope}"`))).toHaveLength(0)
    // The invalid value never reaches a rule, and nothing leaked onto body.
    await expect(rules.some((r) => r.includes('body{'))).toBe(false)
    await expect(getComputedStyle(document.body).backgroundColor).not.toBe('rgb(255, 0, 0)')
  },
}

const SANS_STACK = "'JetBrains Mono', ui-monospace, Menlo, monospace"
const MONO_STACK = "'Courier New', Courier, monospace"
const unquoted = (value: string) => value.replace(/["']/g, '')

const probe = css.create({
  mono: {fontFamily: typography.fontFamilyMono},
  width: {width: sizes.dialogSm},
  target: {minHeight: sizes.touchTarget},
  corner: {borderRadius: radii.sm},
  themedCorner: {borderRadius: radii.md},
  // A readout is set small: at 16px, eight mono digits need about 77px,
  // more than timeReadoutW (74px).
  timeReadout: {width: sizes.timeReadoutW, fontSize: typography.fontSizeSm},
})

/**
 * Tokens of several groups replaced by key: a size, a spacing, a radius and
 * two font families. A nested provider on another theme keeps them; a value
 * that is unsafe, or under a floor, leaves the default.
 */
export const Tokens: StoryObj = {
  render: () => (
    <ThemeProvider
      tokens={{
        typography: {fontFamily: SANS_STACK, fontFamilyMono: MONO_STACK},
        radii: {md: '2px', sm: '-1px'},
        spacing: {md: '20px'},
        sizes: {dialogSm: '300px', touchTarget: '40px'},
      }}
    >
      <html.div data-testid="outer" style={styles.surface}>
        <Button>Primary</Button>
        <Badge>New</Badge>
        <Tabs.Root defaultValue="one">
          <Tabs.List>
            <Tabs.Tab value="one">One</Tabs.Tab>
            <Tabs.Tab value="two">Two</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
        <Select.Root defaultValue="alpha">
          <Select.Trigger aria-label="Pick one">
            <Select.Value />
            <Select.Icon />
          </Select.Trigger>
          <Select.Popup>
            <Select.Item value="alpha">
              <Select.ItemText>Alpha</Select.ItemText>
            </Select.Item>
          </Select.Popup>
        </Select.Root>
        <html.div data-testid="mono" style={probe.mono}>
          mono
        </html.div>
        <html.div data-testid="width" style={probe.width} />
        <html.div data-testid="target" style={probe.target} />
        <html.div data-testid="corner" style={probe.corner} />
        <html.div data-testid="themed-corner" style={probe.themedCorner} />
        <html.div data-testid="readout" style={probe.timeReadout}>
          00:00:00
        </html.div>
        <ThemeProvider theme="light">
          <html.div data-testid="nested" style={styles.surface}>
            <html.div data-testid="nested-width" style={probe.width} />
          </html.div>
        </ThemeProvider>
      </html.div>
    </ThemeProvider>
  ),
  play: async ({canvas}) => {
    const outer = canvas.getByTestId('outer')
    const nested = canvas.getByTestId('nested')
    const button = canvas.getByRole('button', {name: 'Primary'})
    await waitFor(() =>
      expect(unquoted(getComputedStyle(outer).fontFamily)).toMatch(/^JetBrains Mono/),
    )
    await expect(unquoted(getComputedStyle(nested).fontFamily)).toMatch(/^JetBrains Mono/)
    // A distinct mono family, not the sans one.
    await expect(unquoted(getComputedStyle(canvas.getByTestId('mono')).fontFamily)).toMatch(
      /^Courier New/,
    )
    await expect(getComputedStyle(canvas.getByTestId('themed-corner')).borderRadius).toBe('2px')
    await expect(getComputedStyle(outer).padding).toBe('20px')
    await expect(getComputedStyle(canvas.getByTestId('width')).width).toBe('300px')
    // A nested provider on another theme keeps the size.
    await expect(getComputedStyle(canvas.getByTestId('nested-width')).width).toBe('300px')
    // A value under its floor, or below zero, leaves the default.
    await expect(getComputedStyle(canvas.getByTestId('target')).minHeight).toBe('44px')
    await expect(getComputedStyle(canvas.getByTestId('corner')).borderRadius).toBe('8px')
    for (const el of [
      button,
      ...canvas.getAllByRole('tab'),
      canvas.getByRole('combobox', {name: 'Pick one'}),
      canvas.getByText('New'),
      canvas.getByTestId('readout'),
    ]) {
      await expect(el.scrollWidth).toBeLessThanOrEqual(el.clientWidth)
    }
  },
}

/** Values per mode: light and dark palettes, and a contrast layer per mode. */
const BY_MODE: ThemeTokensByMode = {
  typography: {fontFamily: SANS_STACK},
  light: {colors: {bg: '#faf7f1', text: '#1a1a1a'}},
  dark: {colors: {bg: '#14120d', text: '#ece6da'}},
  contrast: {light: {colors: {text: '#000000'}}, dark: {colors: {text: '#ffffff'}}},
}

const RGB = {
  '#faf7f1': 'rgb(250, 247, 241)',
  '#14120d': 'rgb(20, 18, 13)',
  '#1a1a1a': 'rgb(26, 26, 26)',
  '#ece6da': 'rgb(236, 230, 218)',
  '#000000': 'rgb(0, 0, 0)',
  '#ffffff': 'rgb(255, 255, 255)',
} as const

const TEST_ONLY = ['!dev', '!autodocs']

/**
 * Tokens per mode under a ColorModeProvider on `system`: the values follow
 * the browser's own `prefers-color-scheme` and `prefers-contrast`, whichever
 * the runner has, and a nested provider pinned to dark keeps the dark values.
 */
export const ByMode: StoryObj = {
  render: () => (
    <ColorModeProvider defaultPreference="system" storageKey={null} tokens={BY_MODE}>
      <html.div data-testid="system" style={styles.surface}>
        <Text>Follows the OS</Text>
        <ThemeProvider theme="dark">
          <html.div data-testid="island" style={styles.surface}>
            <Text>Pinned dark</Text>
          </html.div>
        </ThemeProvider>
      </html.div>
    </ColorModeProvider>
  ),
  play: async ({canvas}) => {
    const expected = expectedForRunner()
    const system = canvas.getByTestId('system')
    await waitFor(() => expect(getComputedStyle(system).backgroundColor).toBe(expected.bg))
    await expect(getComputedStyle(system).color).toBe(expected.text)
    const island = canvas.getByTestId('island')
    await expect(getComputedStyle(island).backgroundColor).toBe(RGB['#14120d'])
  },
}

/** The values the runner's own `prefers-color-scheme` and `prefers-contrast` pick from BY_MODE. */
function expectedForRunner() {
  const mode = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  const more = matchMedia('(prefers-contrast: more)').matches
  const bg = mode === 'dark' ? '#14120d' : '#faf7f1'
  const text = more
    ? mode === 'dark'
      ? '#ffffff'
      : '#000000'
    : mode === 'dark'
      ? '#ece6da'
      : '#1a1a1a'
  return {bg: RGB[bg], text: RGB[text]}
}

/**
 * The server render under `system` carries the scheme and contrast blocks, a
 * pinned preference and a nested provider carry no scheme block, two renders
 * give the same markup, and the markup alone (before hydration, no script
 * run) paints the runner's scheme. Then hydration reports nothing. It
 * replaces the canvas's content, so it runs as a test only.
 */
export const ServerRender: StoryObj = {
  tags: TEST_ONLY,
  render: () => <html.div data-ssr-host="" />,
  play: async ({canvasElement}) => {
    const host = canvasElement.querySelector('[data-ssr-host]') as HTMLElement
    const tree = (
      <ColorModeProvider defaultPreference="system" storageKey={null} tokens={BY_MODE}>
        <html.div data-testid="ssr-surface" style={styles.surface}>
          <ThemeProvider theme="dark" tokens={{dark: {colors: {accent: '#ff5a1f'}}}}>
            <html.div data-testid="ssr-island" style={styles.surface} />
          </ThemeProvider>
        </html.div>
      </ColorModeProvider>
    )
    const markup = renderToString(tree)
    await expect(renderToString(tree)).toBe(markup)
    const styleTexts = [...markup.matchAll(/<style>(.*?)<\/style>/g)].map((match) => match[1])
    await expect(styleTexts).toHaveLength(2)
    const [follower, island] = styleTexts
    const at = (query: string) => follower.indexOf(query)
    await expect(at('(prefers-color-scheme: light)')).toBeGreaterThan(-1)
    await expect(at('(prefers-color-scheme: dark)')).toBeGreaterThan(
      at('(prefers-color-scheme: light)'),
    )
    await expect(at('(prefers-contrast: more) and (prefers-color-scheme: light)')).toBeGreaterThan(
      at('(prefers-color-scheme: dark)'),
    )
    await expect(island).not.toContain('prefers-color-scheme')

    const pinned = renderToString(
      <ColorModeProvider defaultPreference="light" storageKey={null} tokens={BY_MODE}>
        <html.div />
      </ColorModeProvider>,
    )
    await expect(pinned).not.toContain('prefers-color-scheme')
    await expect(pinned).toContain('@media (prefers-contrast: more)')

    // Under applyTheme={false}, every provider directly under the
    // ColorModeProvider follows the scheme, siblings included (documented).
    const siblings = renderToString(
      <ColorModeProvider defaultPreference="system" storageKey={null} applyTheme={false}>
        <ThemeProvider theme="dark" tokens={BY_MODE}>
          <html.div />
        </ThemeProvider>
        <ThemeProvider theme="dark" tokens={BY_MODE}>
          <html.div />
        </ThemeProvider>
      </ColorModeProvider>,
    )
    // Each carries the DS light theme's block and its own mode block.
    await expect(siblings.split('@media (prefers-color-scheme: light)').length - 1).toBe(4)

    // No `tokens` at all: the DS light theme's own values paint the runner's
    // scheme from the markup alone (a key the app leaves out).
    const bare = renderToString(
      <ColorModeProvider defaultPreference="system" storageKey={null}>
        <html.div data-testid="bare-surface" style={styles.surface} />
      </ColorModeProvider>,
    )
    host.innerHTML = bare
    const bareLight = matchMedia('(prefers-color-scheme: light)').matches
    const bareSurface = host.querySelector('[data-testid="bare-surface"]') as HTMLElement
    await expect(getComputedStyle(bareSurface).backgroundColor).toBe(
      bareLight ? 'rgb(255, 255, 255)' : 'rgb(15, 15, 15)',
    )
    await expect(getComputedStyle(bareSurface).color).toBe(
      bareLight ? 'rgb(26, 26, 26)' : 'rgb(229, 229, 229)',
    )

    // The markup alone, with no script run on it yet: the media blocks paint
    // the runner's scheme on the follower, and the island stays dark.
    host.innerHTML = markup
    const expected = expectedForRunner()
    const surface = host.querySelector('[data-testid="ssr-surface"]') as HTMLElement
    const islandSurface = host.querySelector('[data-testid="ssr-island"]') as HTMLElement
    await expect(getComputedStyle(surface).backgroundColor).toBe(expected.bg)
    await expect(getComputedStyle(surface).color).toBe(expected.text)
    await expect(getComputedStyle(islandSurface).backgroundColor).toBe(RGB['#14120d'])

    const errors: unknown[] = []
    const consoleError = console.error
    console.error = (...args: unknown[]) => {
      errors.push(args)
      consoleError(...args)
    }
    const actEnvironment = globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}
    const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
    let root: ReturnType<typeof hydrateRoot> | undefined
    try {
      await act(async () => {
        root = hydrateRoot(host, tree, {onRecoverableError: (error) => errors.push(error)})
      })
      await expect(errors).toEqual([])
      await expect(getComputedStyle(surface).backgroundColor).toBe(expected.bg)
    } finally {
      console.error = consoleError
      root?.unmount()
      actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment
    }
  },
}

/**
 * A bad value in a mode entry is dropped, and the provider itself warns with
 * the mode in the path (the effect, not only the helper).
 */
export const WarnsDroppedModeValue: StoryObj = {
  tags: TEST_ONLY,
  render: () => <html.div data-warn-host="" />,
  play: async ({canvasElement}) => {
    const host = canvasElement.querySelector('[data-warn-host]') as HTMLElement
    const warnings: string[] = []
    const consoleWarn = console.warn
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '))
    }
    const root = createRoot(host)
    try {
      // A value no other story or test uses: the warning is once per process.
      root.render(
        <ThemeProvider theme="dark" tokens={{dark: {colors: {bg: 'warn-story-bad;'}}}}>
          <html.div />
        </ThemeProvider>,
      )
      await waitFor(() =>
        expect(warnings.some((line) => line.includes('dark.colors.bg'))).toBe(true),
      )
    } finally {
      console.warn = consoleWarn
      root.unmount()
    }
  },
}
