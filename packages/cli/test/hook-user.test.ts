import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {describe, expect, it} from 'vitest'
import {
  FIRST_TOUCH_MATCHER,
  runUserInstall,
  runUserUninstall,
  stateDir,
  type UserHookOptions,
} from '../src/commands/hook-user.js'

const mac = {platform: 'darwin', arch: 'arm64'}
const unix = process.platform !== 'win32'

/** A temporary home, a Claude config folder in it, and a packaged binary to install. */
function fixture(extra: Partial<UserHookOptions> = {}) {
  const home = mkdtempSync(join(tmpdir(), 'greenrack-user-hook-'))
  const claude = join(home, 'claude-config')
  const pkg = join(home, 'pkg')
  mkdirSync(pkg)
  const source = join(pkg, 'greenrack-first-touch')
  writeFileSync(source, '#!/bin/sh\n[ "$1" = --protocol ] && echo 1\n')
  chmodSync(source, 0o755)
  const options: UserHookOptions = {
    env: {CLAUDE_CONFIG_DIR: claude, HOME: home},
    home,
    host: mac,
    source: {path: source},
    protocolOf: () => '1',
    now: 2_000_000_000,
    ...extra,
  }
  const settings = join(claude, 'settings.json')
  const binary = join(claude, 'hooks', 'greenrack-first-touch')
  const json = () => JSON.parse(readFileSync(settings, 'utf8')) as {hooks: Record<string, any[]>}
  return {home, claude, source, settings, binary, options, json}
}

const check = (options: UserHookOptions) => runUserInstall({...options, check: true})

describe('greenrack hook install --user', () => {
  it('copies the binary and writes the two exec-form entries, and says to restart', () => {
    const f = fixture()
    const result = runUserInstall(f.options)
    expect(result.exitCode ?? 0).toBe(0)
    expect(result.text).toMatch(
      /installed\n {2}written {2}~\/claude-config\/hooks\/greenrack-first-touch/,
    )
    expect(result.text).toMatch(/restart Claude Code sessions$/)
    expect(readFileSync(f.binary, 'utf8')).toBe(readFileSync(f.source, 'utf8'))
    if (unix) expect(statSync(f.binary).mode & 0o111).not.toBe(0)
    const entry = {type: 'command', command: f.binary, args: [], timeout: 15}
    expect(f.json().hooks.SessionStart).toEqual([{hooks: [entry]}])
    expect(f.json().hooks.PreToolUse).toEqual([{matcher: FIRST_TOUCH_MATCHER, hooks: [entry]}])
    for (const line of result.text.split('\n')) expect(line.length).toBeLessThan(80)
  })

  it('is idempotent: a second run changes nothing and says so', () => {
    const f = fixture()
    runUserInstall(f.options)
    const before = readFileSync(f.settings, 'utf8')
    const again = runUserInstall(f.options)
    expect(again.text).toBe('greenrack first-touch hook: already installed')
    expect(readFileSync(f.settings, 'utf8')).toBe(before)
  })

  it('keeps every other entry and key, and replaces the pasted context entry', () => {
    const f = fixture()
    mkdirSync(f.claude, {recursive: true})
    const other = {type: 'command', command: 'echo other'}
    writeFileSync(
      f.settings,
      JSON.stringify({
        model: 'opus',
        hooks: {
          SessionStart: [
            {
              hooks: [
                other,
                {type: 'command', command: 'npx -y @greenharness/greenrack-cli@^7 context'},
              ],
            },
          ],
          PreToolUse: [{matcher: 'Bash', hooks: [other]}],
          Stop: [{hooks: [other]}],
        },
      }),
    )
    const result = runUserInstall(f.options)
    expect(result.text).toContain('removed  the pasted greenrack-cli context entry')
    const after = f.json() as any
    expect(after.model).toBe('opus')
    expect(after.hooks.Stop).toEqual([{hooks: [other]}])
    expect(after.hooks.SessionStart[0]).toEqual({hooks: [other]})
    expect(after.hooks.SessionStart).toHaveLength(2)
    expect(after.hooks.PreToolUse[0]).toEqual({matcher: 'Bash', hooks: [other]})
    expect(JSON.stringify(after)).not.toContain('greenrack-cli@^7 context')
  })

  it('refuses invalid JSON and changes nothing', () => {
    const f = fixture()
    mkdirSync(f.claude, {recursive: true})
    writeFileSync(f.settings, '{"hooks": ')
    const result = runUserInstall(f.options)
    expect(result.exitCode).toBe(2)
    expect(result.text).toMatch(/not usable .*\n.*Nothing was changed/)
    expect(readFileSync(f.settings, 'utf8')).toBe('{"hooks": ')
    expect(existsSync(f.binary)).toBe(false)
  })

  it('refuses a platform with no binary and writes no hook', () => {
    const f = fixture({source: {error: 'no first-touch binary is built for win32/arm64'}})
    const result = runUserInstall(f.options)
    expect(result.exitCode).toBe(2)
    expect(result.text).toMatch(/Nothing was written/)
    expect(existsSync(f.settings)).toBe(false)
  })

  it.skipIf(!unix)('keeps a symlinked settings.json a link, and its mode', () => {
    const f = fixture()
    mkdirSync(f.claude, {recursive: true})
    const real = join(f.home, 'dotfiles-settings.json')
    writeFileSync(real, '{}\n')
    chmodSync(real, 0o600)
    symlinkSync(real, f.settings)
    runUserInstall(f.options)
    expect(readFileSync(real, 'utf8')).toContain('greenrack-first-touch')
    expect(statSync(real).mode & 0o777).toBe(0o600)
    expect(readFileSync(f.settings, 'utf8')).toBe(readFileSync(real, 'utf8'))
  })

  it('moves a binary aside on Windows before the new one lands, and sweeps it next run', () => {
    const f = fixture({host: {platform: 'win32', arch: 'x64'}})
    const exe = join(f.claude, 'hooks', 'greenrack-first-touch.exe')
    runUserInstall(f.options)
    expect(existsSync(exe)).toBe(true)
    writeFileSync(f.source, 'a newer release\n')
    runUserInstall(f.options)
    expect(readFileSync(exe, 'utf8')).toBe('a newer release\n')
    expect(existsSync(`${exe}.old`)).toBe(true)
    runUserInstall(f.options)
    expect(existsSync(`${exe}.old`)).toBe(false)
  })
})

describe('greenrack hook install --user --check', () => {
  it('exits 1 before an install and 0 after, with a JSON state', () => {
    const f = fixture()
    const before = check(f.options)
    expect(before.exitCode).toBe(1)
    expect(before.data).toMatchObject({state: 'absent'})
    expect(before.text).toMatch(/binary: not at/)
    expect(before.text).toMatch(/SessionStart: not wired/)
    runUserInstall(f.options)
    const after = check(f.options)
    expect(after.exitCode ?? 0).toBe(0)
    expect(after.data).toMatchObject({state: 'present', outdated: false})
  })

  it('reports each entry that drifted, one line each', () => {
    const f = fixture()
    runUserInstall(f.options)
    const edited = f.json()
    edited.hooks.PreToolUse![0].matcher = 'Read'
    edited.hooks.SessionStart![0].hooks[0].timeout = 60
    writeFileSync(f.settings, JSON.stringify(edited))
    const result = check(f.options)
    expect(result.exitCode).toBe(1)
    expect(result.text).toContain('PreToolUse: matcher "Read"')
    expect(result.text).toContain('SessionStart: timeout 60')
  })

  it('reads a binary from another release that speaks the protocol as outdated, still present', () => {
    const f = fixture()
    runUserInstall(f.options)
    writeFileSync(f.source, 'a newer release\n')
    const result = check(f.options)
    expect(result.exitCode ?? 0).toBe(0)
    expect(result.data).toMatchObject({state: 'present', outdated: true})
    expect(result.text).toMatch(/outdated/)
  })

  it('reads another protocol, or a binary that does not run, as absent', () => {
    const f = fixture()
    runUserInstall(f.options)
    const other = check({...f.options, protocolOf: () => '2'})
    expect(other.exitCode).toBe(1)
    expect(other.text).toContain('binary: protocol 2, this CLI speaks 1')
    const dead = check({...f.options, protocolOf: () => null})
    expect(dead.text).toContain('binary: does not run')
  })

  it.skipIf(!unix)('runs the installed binary to read its protocol', () => {
    const f = fixture()
    runUserInstall(f.options)
    const {protocolOf: _, ...real} = f.options
    expect(check(real).data).toMatchObject({state: 'present'})
  })

  it('exits 2 on invalid JSON and on a platform with no build; 3 when unreadable', () => {
    const f = fixture()
    mkdirSync(f.claude, {recursive: true})
    writeFileSync(f.settings, 'nope')
    expect(check(f.options).exitCode).toBe(2)
    expect(check({...f.options, host: {platform: 'win32', arch: 'arm64'}}).exitCode).toBe(2)
    if (unix && process.getuid?.() !== 0) {
      writeFileSync(f.settings, '{}')
      chmodSync(f.settings, 0o000)
      const result = check(f.options)
      expect(result.exitCode).toBe(3)
      expect(result.data).not.toHaveProperty('state')
      chmodSync(f.settings, 0o600)
    }
  })

  it('reports the last failure and a back-off from the binary state', () => {
    const f = fixture()
    runUserInstall(f.options)
    const state = stateDir(f.options.env!, f.home, 'darwin')!
    mkdirSync(join(state, 'failures'), {recursive: true})
    writeFileSync(
      join(state, 'log.jsonl'),
      [
        JSON.stringify({ts: 1_999_999_400, root: '/r', outcome: 'failed: timeout'}),
        JSON.stringify({ts: 1_999_999_900, root: '/r', outcome: 'given'}),
      ].join('\n') + '\n',
    )
    writeFileSync(join(state, 'failures', 'abc'), '3 1999999950.5 exit 1')
    const result = check(f.options)
    expect(result.text).toContain('last failure 10 min ago: failed: timeout')
    expect(result.text).toContain('backing off: 3 failures, last: exit 1')
  })
})

describe('greenrack hook uninstall --user', () => {
  it('removes our two entries and the binary, and nothing else', () => {
    const f = fixture()
    mkdirSync(f.claude, {recursive: true})
    const other = {type: 'command', command: 'echo other'}
    writeFileSync(f.settings, JSON.stringify({hooks: {SessionStart: [{hooks: [other]}]}}))
    runUserInstall(f.options)
    const result = runUserUninstall(f.options)
    expect(result.text).toMatch(/uninstalled\n {2}unwired .*2 entries\n {2}removed .*\nrestart/)
    expect(f.json()).toEqual({hooks: {SessionStart: [{hooks: [other]}]}})
    expect(existsSync(f.binary)).toBe(false)
    expect(runUserUninstall(f.options).text).toBe('greenrack first-touch hook: not installed')
  })
})
