import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {describe, expect, it} from 'vitest'
import {loadRegistry} from '../src/registry.js'
import {runHook} from '../src/commands/hook.js'
import {
  FIRST_TOUCH_MATCHER,
  INSTALL_COMMAND,
  readStatus,
  runUserInstall,
  runUserUninstall,
  type UserHookOptions,
} from '../src/commands/hook-user.js'

const mac = {platform: 'darwin', arch: 'arm64'}
const unix = process.platform !== 'win32'
const root = unix && process.getuid?.() === 0

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
    statusOf: () => null,
    now: 2_000_000_000,
    ...extra,
  }
  const settings = join(claude, 'settings.json')
  const binary = join(claude, 'hooks', 'greenrack-first-touch')
  const json = () =>
    JSON.parse(readFileSync(settings, 'utf8')) as {hooks: Record<string, any[]>} & Record<
      string,
      unknown
    >
  return {home, claude, source, settings, binary, options, json}
}

const check = (options: UserHookOptions) => runUserInstall({...options, check: true})

/** Every line fits an 80-column terminal. */
function narrow(text: string): void {
  for (const line of text.split('\n')) expect(line.length, line).toBeLessThan(80)
}

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
    narrow(result.text)
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
    const after = f.json()
    expect(after.model).toBe('opus')
    expect(after.hooks.Stop).toEqual([{hooks: [other]}])
    expect(after.hooks.SessionStart![0]).toEqual({hooks: [other]})
    expect(after.hooks.SessionStart).toHaveLength(2)
    expect(after.hooks.PreToolUse![0]).toEqual({matcher: 'Bash', hooks: [other]})
    expect(JSON.stringify(after)).not.toContain('greenrack-cli@^7 context')
  })

  it('refuses invalid JSON, names the fix and the rerun, and changes nothing', () => {
    const f = fixture()
    mkdirSync(f.claude, {recursive: true})
    writeFileSync(f.settings, '{"hooks": ')
    const result = runUserInstall(f.options)
    expect(result.exitCode).toBe(2)
    expect(result.text).toContain('Nothing was changed. Fix the file, then run:')
    expect(result.text).toContain(INSTALL_COMMAND)
    expect(result.text).not.toMatch(/remove/)
    expect(readFileSync(f.settings, 'utf8')).toBe('{"hooks": ')
    expect(existsSync(f.binary)).toBe(false)
    narrow(result.text)
  })

  it('refuses a hook group that is not an object, rather than crash', () => {
    for (const hooks of [
      {SessionStart: [null]},
      {PreToolUse: [{hooks: {}}]},
      {PreToolUse: ['x']},
    ]) {
      const f = fixture()
      mkdirSync(f.claude, {recursive: true})
      const text = JSON.stringify({hooks})
      writeFileSync(f.settings, text)
      const result = runUserInstall(f.options)
      expect(result.exitCode, JSON.stringify(hooks)).toBe(2)
      expect(readFileSync(f.settings, 'utf8')).toBe(text)
      expect(runUserUninstall(f.options).exitCode).toBe(2)
    }
  })

  it('refuses a platform with no binary and writes no hook', () => {
    const f = fixture({
      source: {
        error: '@greenharness/greenrack-first-touch-linux-x64-musl is not installed',
        fix: 'reinstall @greenharness/greenrack-cli without --no-optional',
      },
    })
    const result = runUserInstall(f.options)
    expect(result.exitCode).toBe(2)
    expect(result.text).toMatch(/nothing was written/)
    expect(result.text).toContain('  reinstall @greenharness/greenrack-cli without --no-optional')
    expect(existsSync(f.settings)).toBe(false)
    narrow(result.text)
  })

  it.skipIf(!unix || root)('reports a file it cannot write as exit 3, not a stack trace', () => {
    const f = fixture()
    mkdirSync(join(f.claude, 'hooks'), {recursive: true})
    chmodSync(join(f.claude, 'hooks'), 0o500)
    try {
      const result = runUserInstall(f.options)
      expect(result.exitCode).toBe(3)
      expect(result.data).toMatchObject({kind: 'write-failed', code: 'EACCES'})
      expect(result.text).toMatch(
        /cannot write \(EACCES\):\n {2}~\/claude-config\/hooks\/greenrack-first-touch/,
      )
    } finally {
      chmodSync(join(f.claude, 'hooks'), 0o700)
    }
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
    const hooks = join(f.claude, 'hooks')
    const exe = join(hooks, 'greenrack-first-touch.exe')
    const asides = () => readdirSync(hooks).filter((name) => name.includes('.exe.old-'))
    runUserInstall(f.options)
    expect(existsSync(exe)).toBe(true)
    writeFileSync(f.source, 'a newer release\n')
    runUserInstall(f.options)
    expect(readFileSync(exe, 'utf8')).toBe('a newer release\n')
    expect(asides()).toHaveLength(1)
    runUserInstall(f.options)
    expect(asides()).toHaveLength(0)
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
    expect(before.text).toContain(`run:\n  ${INSTALL_COMMAND}`)
    narrow(before.text)
    runUserInstall(f.options)
    const after = check(f.options)
    expect(after.exitCode ?? 0).toBe(0)
    expect(after.data).toMatchObject({state: 'present', outdated: false})
  })

  it('reports each entry that drifted, one line each, paths with ~', () => {
    const f = fixture()
    runUserInstall(f.options)
    const edited = f.json()
    edited.hooks.PreToolUse![0].matcher = 'Read'
    edited.hooks.SessionStart![0].hooks[0].timeout = 60
    edited.hooks.SessionStart![0].hooks[0].command = join(
      f.home,
      'elsewhere',
      'greenrack-first-touch',
    )
    writeFileSync(f.settings, JSON.stringify(edited))
    const result = check(f.options)
    expect(result.exitCode).toBe(1)
    expect(result.text).toContain('PreToolUse: matcher "Read"')
    expect(result.text).toContain('SessionStart: timeout 60')
    expect(result.text).toContain('SessionStart: runs ~/elsewhere/greenrack-first-touch')
  })

  it('reads a binary from another release that speaks the protocol as outdated, still present', () => {
    const f = fixture()
    runUserInstall(f.options)
    writeFileSync(f.source, 'a newer release\n')
    const result = check(f.options)
    expect(result.exitCode ?? 0).toBe(0)
    expect(result.data).toMatchObject({state: 'present', outdated: true})
    expect(result.text).toMatch(/^greenrack first-touch hook: outdated/)
    narrow(result.text)
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
    if (unix && !root) {
      writeFileSync(f.settings, '{}')
      chmodSync(f.settings, 0o000)
      const result = check(f.options)
      expect(result.exitCode).toBe(3)
      expect(result.data).not.toHaveProperty('state')
      expect(result.text).toContain("Check the file's permissions")
      chmodSync(f.settings, 0o600)
    }
  })

  it("prints the binary's own report: the last failure and a back-off", () => {
    const now = 2_000_000_000
    const f = fixture({
      now,
      statusOf: () => ({
        lastFailure: {ts: now - 600, root: '/r', outcome: 'failed: timeout'},
        backingOff: [{count: 3, ts: now - 50, reason: 'exit 1'}],
      }),
    })
    runUserInstall(f.options)
    const result = check(f.options)
    expect(result.text).toContain('last failure 10 min ago: failed: timeout')
    expect(result.text).toContain('backing off: 3 failures, last: exit 1')
    expect(result.data).toMatchObject({status: {backingOff: [{count: 3}]}})
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

describe('greenrack hook flags', () => {
  const registry = loadRegistry()

  it('refuses uninstall --check rather than uninstall', () => {
    const result = runHook(registry, 'uninstall', {user: true, check: true})
    expect(result.exitCode).toBe(2)
    expect(result.text).toContain(`${INSTALL_COMMAND} --check`)
  })

  it('refuses --user where it means nothing, and uninstall without it', () => {
    expect(runHook(registry, 'session-start', {user: true}).exitCode).toBe(2)
    expect(runHook(registry, 'first-touch', {user: true}).exitCode).toBe(2)
    expect(runHook(registry, 'first-touch', {check: true}).exitCode).toBe(2)
    const repo = runHook(registry, 'uninstall', {})
    expect(repo.exitCode).toBe(2)
    narrow(repo.text)
  })
})

describe('the binary report', () => {
  it('reads a well-formed --status and refuses any other shape, so --check never crashes', () => {
    const good = {lastFailure: {ts: 1, root: '/r', outcome: 'failed: timeout'}, backingOff: []}
    expect(readStatus(good)).toEqual(good)
    expect(readStatus({lastFailure: null})).toEqual({lastFailure: null})
    for (const bad of [
      [],
      'x',
      {backingOff: 'x'},
      {backingOff: [{count: '3', ts: 1}]},
      {lastFailure: {ts: '1', outcome: 'x'}},
      {lastFailure: 'x'},
    ]) {
      expect(readStatus(bad), JSON.stringify(bad)).toBeNull()
    }
  })
})
