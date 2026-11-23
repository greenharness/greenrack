import {spawnSync} from 'node:child_process'
import {mkdtempSync, readdirSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {describe, expect, it} from 'vitest'
import {loadRegistry} from '../src/registry.js'
import {runContext} from '../src/commands/context.js'
import {
  FIRST_TOUCH_CAP,
  cutAtLine,
  firstTouchOptions,
  runFirstTouch,
} from '../src/commands/first-touch.js'

const registry = loadRegistry()
const bin = fileURLToPath(new URL('../dist/bin.js', import.meta.url))

function consumer(): string {
  const dir = mkdtempSync(join(tmpdir(), 'greenrack-first-touch-'))
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({devDependencies: {'@greenharness/greenrack-ui': '1.0.0'}}),
  )
  return dir
}

function bystander(): string {
  const dir = mkdtempSync(join(tmpdir(), 'greenrack-first-touch-plain-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({name: 'plain'}))
  return dir
}

const cache = () => mkdtempSync(join(tmpdir(), 'greenrack-first-touch-cache-'))

describe('greenrack hook first-touch', () => {
  it('prints nothing without a root, or for a root that is not a consumer', () => {
    expect(runFirstTouch(registry, {event: 'PreToolUse'}).text).toBe('')
    const plain = runFirstTouch(registry, {
      root: bystander(),
      event: 'PreToolUse',
      cacheHome: cache(),
    })
    expect(plain.text).toBe('')
  })

  it('gives PreToolUse one hookSpecificOutput object carrying the labelled index', () => {
    const root = consumer()
    const out = runFirstTouch(registry, {root, event: 'PreToolUse', cacheHome: cache()})
    const parsed = JSON.parse(out.text) as {
      hookSpecificOutput: {hookEventName: string; additionalContext: string}
    }
    expect(parsed.hookSpecificOutput.hookEventName).toBe('PreToolUse')
    const context = parsed.hookSpecificOutput.additionalContext
    expect(context.startsWith(`greenrack index for ${root} (first touch this session)\n`)).toBe(
      true,
    )
    expect(context).toContain('COMPONENTS (')
    expect(context).not.toContain('unavailable')
  })

  it('gives SessionStart plain text, with the earlier failure when the binary passes one', () => {
    const root = consumer()
    const plain = runFirstTouch(registry, {root, event: 'SessionStart', cacheHome: cache()})
    expect(plain.text.startsWith('greenrack index for ')).toBe(true)
    expect(() => JSON.parse(plain.text)).toThrow()
    const after = runFirstTouch(registry, {
      root,
      event: 'SessionStart',
      unavailable: 'timeout',
      cacheHome: cache(),
    })
    const lines = after.text.split('\n')
    expect(lines.slice(1, 5)).toEqual([
      'greenrack index unavailable:',
      '  timeout',
      'check it with:',
      '  npx -y @greenharness/greenrack-cli@^7 hook install --user --check',
    ])
  })

  it('stays under the binary limit, a large doctor block included', () => {
    const root = consumer()
    const cacheHome = cache()
    runContext(registry, {cwd: root, cacheHome})
    const [slot] = readdirSync(join(cacheHome, 'greenrack'))
    const doctor = Array.from({length: 400}, (_, i) => `- [warn] finding ${i}: ${'x'.repeat(40)}`)
    writeFileSync(join(cacheHome, 'greenrack', slot!, 'doctor'), doctor.join('\n'))
    const out = runFirstTouch(registry, {root, event: 'PreToolUse', cacheHome})
    const context = (JSON.parse(out.text) as {hookSpecificOutput: {additionalContext: string}})
      .hookSpecificOutput.additionalContext
    expect(context.length).toBeLessThanOrEqual(FIRST_TOUCH_CAP)
    expect(out.text.length).toBeLessThanOrEqual(9900)
  })

  it('prints nothing for another protocol or event, and gives for its own', () => {
    const root = consumer()
    const base = {root, event: 'PreToolUse' as const, cacheHome: cache()}
    expect(runFirstTouch(registry, {...base, protocol: '2'}).text).toBe('')
    expect(runFirstTouch(registry, {...base, event: undefined}).text).toBe('')
    expect(runFirstTouch(registry, {...base, protocol: '1'}).text).not.toBe('')
    expect(firstTouchOptions({GREENRACK_FIRST_TOUCH_EVENT: 'Stop'}).event).toBeUndefined()
  })

  it('keeps the JSON object under the cap when escapes grow it', () => {
    const root = consumer()
    const cacheHome = cache()
    runContext(registry, {cwd: root, cacheHome})
    const [slot] = readdirSync(join(cacheHome, 'greenrack'))
    // Every quote and backslash doubles inside the JSON string.
    const noisy = '"\\'.repeat(20)
    const doctor = Array.from({length: 600}, (_, i) => `- [warn] "q${i}" ${noisy}`)
    writeFileSync(join(cacheHome, 'greenrack', slot!, 'doctor'), doctor.join('\n'))
    const out = runFirstTouch(registry, {root, event: 'PreToolUse', cacheHome})
    expect(out.text.length).toBeLessThanOrEqual(FIRST_TOUCH_CAP)
    expect(() => JSON.parse(out.text)).not.toThrow()
  })

  it('cuts at a line end and says where the rest is', () => {
    const text = Array.from({length: 200}, (_, i) => `line ${i} ${'y'.repeat(30)}`).join('\n')
    const cut = cutAtLine(text, 1000)
    expect(cut.length).toBeLessThanOrEqual(1000)
    expect(cut.endsWith('\n[truncated; run: greenrack context]')).toBe(true)
    const lines = cut.split('\n')
    expect(lines[lines.length - 2]).toMatch(/^line \d+ y{30}$/)
    expect(cutAtLine('short', 1000)).toBe('short')
  })

  it('runs through the bin from the environment, with no warning on stderr', () => {
    const root = consumer()
    const done = spawnSync(process.execPath, [bin, 'hook', 'first-touch'], {
      cwd: root,
      encoding: 'utf8',
      input: '{"session_id":"s"}',
      env: {
        ...process.env,
        GREENRACK_FIRST_TOUCH_ROOT: root,
        GREENRACK_FIRST_TOUCH_EVENT: 'PreToolUse',
        XDG_CACHE_HOME: cache(),
      },
    })
    expect(done.status).toBe(0)
    expect(done.stderr).toBe('')
    const parsed = JSON.parse(done.stdout) as {hookSpecificOutput: {hookEventName: string}}
    expect(parsed.hookSpecificOutput.hookEventName).toBe('PreToolUse')
  })
})
