import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {describe, expect, it} from 'vitest'
import {isGreenrackConsumer, runDoctor, type DoctorFinding} from '../src/commands/doctor.js'
interface ScopeFixture {
  ui: string
  tokens: string
}

/** The scope this CLI recognises. */
const GREENRACK: ScopeFixture = {
  ui: '@greenharness/greenrack-ui',
  tokens: '@greenharness/greenrack-tokens',
}

/** The retired scope, spelled out: nothing detects it any more. */
const RETIRED: ScopeFixture = {ui: '@duro-app/ui', tokens: '@duro-app/tokens'}

const inRegex = (name: string) => name.replace(/\//g, '\\/')

function write(root: string, files: Record<string, string>): string {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), {recursive: true})
    writeFileSync(join(root, path), content)
  }
  return root
}

/** An SSR app that compiles its tokens package through Babel, unless told otherwise. */
function app(scope: ScopeFixture, options: {compileTokens?: boolean; inline?: boolean} = {}) {
  const {compileTokens = true, inline = true} = options
  const lines = [
    `import {reactRouter} from '@react-router/dev/vite'`,
    `import babel from 'vite-plugin-babel'`,
    `const preset = ['react-strict-dom/babel-preset', {dev: true, platform: 'web'}]`,
    `export default {`,
    `  plugins: [`,
    `    reactRouter(),`,
    `    babel({filter: /\\/app\\/.*\\.[jt]sx?$/, babelConfig: {presets: [preset]}}),`,
    ...(compileTokens
      ? [
          `    babel({filter: /node_modules\\/${inRegex(scope.tokens)}\\/.*\\.[jt]sx?$/, babelConfig: {presets: [preset]}}),`,
        ]
      : []),
    `  ],`,
    `  ssr: {noExternal: ['react-strict-dom'${inline ? `, '${scope.tokens}'` : ''}]},`,
    `}`,
    '',
  ]
  return write(mkdtempSync(join(tmpdir(), 'doctor-scopes-')), {
    'package.json': JSON.stringify({name: 'app', dependencies: {[scope.ui]: '^1.0.0'}}),
    'vite.config.ts': lines.join('\n'),
    'postcss.config.mjs': `export default {plugins: {'react-strict-dom/postcss-plugin': {include: ['app/**']}}}\n`,
    'app/root.tsx': `import '${scope.ui}/dist/index.css'\nimport './styles/strict.css'\n`,
    'app/styles/strict.css': `@react-strict-dom;\n`,
  })
}

const findings = (root: string) =>
  (runDoctor({cwd: root}).data as {findings: DoctorFinding[]}).findings

describe('greenrack doctor', () => {
  const scope = GREENRACK

  it('is a consumer', () => {
    expect(isGreenrackConsumer(app(scope))).toBe(true)
  })

  it('finds nothing in a healthy app', () => {
    expect(findings(app(scope))).toEqual([])
  })

  it('wants the stylesheet of its own scope', () => {
    const root = app(scope)
    const other = RETIRED
    write(root, {'app/root.tsx': `import '${other.ui}/dist/index.css'\n`})
    expect(findings(root)).toEqual([
      expect.objectContaining({
        rule: 'css-imported',
        fix: expect.stringContaining(`'${scope.ui}/dist/index.css'`),
      }),
    ])
  })

  it('reports tokens that are never compiled, naming its own package', () => {
    const [finding] = findings(app(scope, {compileTokens: false}))
    expect(finding).toMatchObject({rule: 'tokens-compiled'})
    expect(finding!.fix).toContain(`node_modules/${scope.tokens} `)
    expect(finding!.fix).toContain(inRegex(scope.tokens))
  })

  it('reports tokens missing from SSR noExternal, naming its own package', () => {
    const [finding] = findings(app(scope, {inline: false}))
    expect(finding).toMatchObject({rule: 'tokens-compiled'})
    expect(finding!.fix).toContain(`'${scope.tokens}'`)
  })

  it('does not take the other scope tokens for its own', () => {
    const other = RETIRED
    const root = app(scope, {compileTokens: false, inline: false})
    write(root, {
      'vite.config.ts': `${`import babel from 'vite-plugin-babel'\nconst a = '${other.tokens}'\n`}export default {plugins: [babel({filter: /x/, babelConfig: {presets: ['react-strict-dom/babel-preset']}})], ssr: {noExternal: ['${other.tokens}']}}\n`,
    })
    expect(findings(root).map(({rule}) => rule)).toContain('tokens-compiled')
  })

  it('names the scope in a banner under 80 columns', () => {
    const root = app(scope, {inline: false})
    const session = runDoctor({cwd: root, session: true}).text
    const plain = runDoctor({cwd: root}).text
    for (const text of [session, plain]) {
      // The scope is named in the banner or the line under it, every line within 80 columns.
      const [banner, next] = text.split('\n')
      expect(`${banner}\n${next}`).toContain(scope.ui)
      expect(banner!.length).toBeLessThan(80)
      expect(next!.length).toBeLessThan(80)
    }
    expect(runDoctor({cwd: app(scope)}).text.split('\n')[0]).toContain(scope.ui)
  })

  it('is not a consumer of the retired scope, and says how to become one', () => {
    const root = app(RETIRED)
    expect(isGreenrackConsumer(root)).toBe(false)
    const result = runDoctor({cwd: root})
    expect(result.exitCode).toBeUndefined()
    expect(result.data).toMatchObject({ok: true, findings: [], packages: [], scopes: []})
    expect(result.text).toBe('')
    expect(result.notes).toEqual([expect.stringContaining('pnpm add @greenharness/greenrack-ui')])
    expect(result.notes![0]!.length).toBeLessThanOrEqual(80)
  })

  it('says nothing to a session hook in an app on the retired scope', () => {
    const result = runDoctor({cwd: app(RETIRED), session: true})
    expect(result.text).toBe('')
    expect(result.notes).toEqual([])
  })
})
