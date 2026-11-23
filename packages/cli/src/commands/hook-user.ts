import {execFileSync} from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import {homedir} from 'node:os'
import {basename, dirname, join, resolve} from 'node:path'
import {
  FIRST_TOUCH_BIN,
  type FoundBinary,
  type Host,
  currentHost,
  firstTouchBinary,
  targetFor,
} from '../native.js'
import type {CommandResult} from './lookup.js'

/**
 * The protocol this CLI speaks with the `greenrack-first-touch` binary: the
 * event on stdin; the root, the event name and the protocol in
 * GREENRACK_FIRST_TOUCH_* variables; the index on stdout; `--status` as JSON.
 * These names are a public contract for the 7.x line. `--check` reinstalls a
 * binary speaking another protocol; one from another release that speaks this
 * one is only `outdated`. `hook first-touch` prints nothing for a protocol it
 * does not speak.
 */
export const FIRST_TOUCH_PROTOCOL = '1'
export const FIRST_TOUCH_MATCHER = 'Read|Edit|Write|MultiEdit|NotebookEdit|Bash'
/** Seconds Claude Code gives the hook: the binary's own limit is 10. */
export const FIRST_TOUCH_TIMEOUT = 15
/** The npx form: a grh or npx setup has no `greenrack` on PATH. */
export const INSTALL_COMMAND = 'npx -y @greenharness/greenrack-cli@^7 hook install --user'
const UNINSTALL_COMMAND = 'npx -y @greenharness/greenrack-cli@^7 hook uninstall --user'
const RESTART = 'restart Claude Code sessions'
const WIDTH = 79

/** What `greenrack-first-touch --status` prints: the binary owns its state files. */
export interface BinaryStatus {
  lastFailure?: {ts: number; root: string; outcome: string} | null
  backingOff?: Array<{count: number; ts: number; reason: string | null}>
}

export interface UserHookOptions {
  /** Report, change nothing. */
  check?: boolean
  env?: NodeJS.ProcessEnv
  home?: string
  host?: Host
  /** The packaged binary; resolved from the platform package when absent. */
  source?: FoundBinary
  /** Runs `<binary> --protocol`; null when it does not run. */
  protocolOf?: (path: string) => string | null
  /** Runs `<binary> --status`; null when it does not run or answers no JSON. */
  statusOf?: (path: string) => BinaryStatus | null
  /** Seconds since the epoch, for "N min ago". */
  now?: number
}

type Entry = Record<string, unknown> & {command?: unknown; args?: unknown; timeout?: unknown}
type Group = Record<string, unknown> & {matcher?: unknown; hooks?: Entry[]}
type Settings = Record<string, unknown> & {hooks?: Record<string, Group[]>}

interface Wiring {
  event: string
  matcher?: string
}

const WIRINGS: Wiring[] = [
  {event: 'SessionStart'},
  {event: 'PreToolUse', matcher: FIRST_TOUCH_MATCHER},
]

/** `$CLAUDE_CONFIG_DIR`, else the home's `.claude`. */
export function claudeDir(env: NodeJS.ProcessEnv, home: string): string {
  return env.CLAUDE_CONFIG_DIR || join(home, '.claude')
}

interface Where {
  host: Host
  env: NodeJS.ProcessEnv
  home: string
  settings: string
  binary: string
}

function where(options: UserHookOptions): Where {
  const env = options.env ?? process.env
  const host = options.host ?? currentHost()
  const home = options.home ?? homedir()
  const claude = claudeDir(env, home)
  const exe = host.platform === 'win32' ? `${FIRST_TOUCH_BIN}.exe` : FIRST_TOUCH_BIN
  return {
    host,
    env,
    home,
    settings: join(claude, 'settings.json'),
    binary: join(claude, 'hooks', exe),
  }
}

/** A path for a person to read: the home folder as `~`. */
function shown(path: string, home: string): string {
  return path.startsWith(home + '/') || path.startsWith(home + '\\')
    ? `~${path.slice(home.length)}`
    : path
}

/** One line of a report, cut to the terminal's 80 columns. */
function clip(line: string): string {
  return line.length <= WIDTH ? line : `${line.slice(0, WIDTH - 1)}…`
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function ours(entry: Entry): boolean {
  if (typeof entry.command !== 'string') return false
  const name = entry.command.trim().replace(/^"|"$/g, '').split(/[\\/]/).pop()
  return name === FIRST_TOUCH_BIN || name === `${FIRST_TOUCH_BIN}.exe`
}

/** The SessionStart entry the README once had people paste by hand. */
function pasted(entry: Entry): boolean {
  return (
    typeof entry.command === 'string' &&
    /@greenharness\/greenrack-cli(@\S*)?\s+context\b/.test(entry.command)
  )
}

function wanted(binary: string): Entry {
  // Exec form: no shell runs it, so a path with spaces or on Windows works.
  return {type: 'command', command: binary, args: [], timeout: FIRST_TOUCH_TIMEOUT}
}

type Loaded =
  | {kind: 'ok'; settings: Settings; target: string; exists: boolean}
  | {kind: 'invalid'; reason: string}
  | {kind: 'unreadable'; reason: string}

function code(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code
}

/** settings.json, followed through a symlink, with every part this edits checked. */
function load(path: string): Loaded {
  let target = path
  try {
    if (lstatSync(path).isSymbolicLink()) {
      try {
        target = realpathSync(path)
      } catch {
        // A dangling link: write where it points.
        target = resolve(dirname(path), readlinkSync(path))
      }
    }
  } catch (error) {
    if (code(error) !== 'ENOENT') return {kind: 'unreadable', reason: String(code(error) ?? error)}
  }
  let raw: string | null = null
  try {
    raw = readFileSync(target, 'utf8')
  } catch (error) {
    if (code(error) !== 'ENOENT') return {kind: 'unreadable', reason: String(code(error) ?? error)}
  }
  let parsed: unknown = {}
  if (raw !== null && raw.trim() !== '') {
    try {
      parsed = JSON.parse(raw)
    } catch (error) {
      return {kind: 'invalid', reason: error instanceof Error ? error.message : String(error)}
    }
  }
  if (!isObject(parsed)) return {kind: 'invalid', reason: 'the file is not a JSON object'}
  const hooks = parsed.hooks
  if (hooks !== undefined) {
    if (!isObject(hooks)) return {kind: 'invalid', reason: '"hooks" is not an object'}
    for (const {event} of WIRINGS) {
      const groups = hooks[event]
      if (groups === undefined) continue
      if (!Array.isArray(groups)) {
        return {kind: 'invalid', reason: `"hooks.${event}" is not an array`}
      }
      for (const [i, group] of groups.entries()) {
        if (!isObject(group)) {
          return {kind: 'invalid', reason: `"hooks.${event}[${i}]" is not an object`}
        }
        const entries = group.hooks
        if (entries !== undefined && !(Array.isArray(entries) && entries.every(isObject))) {
          return {kind: 'invalid', reason: `"hooks.${event}[${i}].hooks" is not a list of objects`}
        }
      }
    }
  }
  return {kind: 'ok', settings: parsed as Settings, target, exists: raw !== null}
}

/** Through a temp file beside the target, keeping the target's mode. */
function save(target: string, settings: Settings, existed: boolean): void {
  mkdirSync(dirname(target), {recursive: true})
  const temp = `${target}.tmp-${process.pid}`
  try {
    writeFileSync(temp, JSON.stringify(settings, null, 2) + '\n', 'utf8')
    if (existed) chmodSync(temp, statSync(target).mode & 0o7777)
    renameSync(temp, target)
  } catch (error) {
    rmSync(temp, {force: true})
    throw error
  }
}

/** What differs from the two entries install writes; empty when wired. */
function drift(settings: Settings, binary: string, home: string): string[] {
  const found: string[] = []
  for (const wiring of WIRINGS) {
    const groups = settings.hooks?.[wiring.event] ?? []
    const mine = groups.flatMap((group) =>
      (group.hooks ?? []).filter(ours).map((entry) => ({group, entry})),
    )
    if (mine.length === 0) {
      found.push(`${wiring.event}: not wired`)
    } else if (mine.length > 1) {
      found.push(`${wiring.event}: ${mine.length} entries run the hook`)
    } else {
      const {group, entry} = mine[0]!
      if (entry.command !== binary) {
        found.push(`${wiring.event}: runs ${shown(String(entry.command), home)}`)
      }
      if ((group.matcher ?? '') !== (wiring.matcher ?? '')) {
        found.push(`${wiring.event}: matcher "${String(group.matcher ?? '')}"`)
      }
      if (entry.timeout !== FIRST_TOUCH_TIMEOUT) {
        found.push(`${wiring.event}: timeout ${String(entry.timeout ?? 'unset')}`)
      }
      if (!Array.isArray(entry.args)) found.push(`${wiring.event}: not in exec form`)
    }
    if (wiring.event === 'SessionStart' && groups.some((g) => (g.hooks ?? []).some(pasted))) {
      found.push('SessionStart: a pasted greenrack-cli context entry')
    }
  }
  return found
}

/**
 * A copy without the entries `drop` names. A group or an event list this
 * empties goes; one that was empty before stays.
 */
function without(
  settings: Settings,
  drop: (event: string, entry: Entry) => boolean,
): {next: Settings; removed: number} {
  const next = structuredClone(settings)
  let removed = 0
  const hooks = next.hooks
  if (hooks === undefined) return {next, removed}
  for (const {event} of WIRINGS) {
    const groups = hooks[event]
    if (groups === undefined) continue
    const kept: Group[] = []
    for (const group of groups) {
      const entries = group.hooks ?? []
      const left = entries.filter((entry) => !drop(event, entry))
      removed += entries.length - left.length
      if (left.length === entries.length) kept.push(group)
      else if (left.length > 0) kept.push({...group, hooks: left})
    }
    if (kept.length === 0 && groups.length > 0) delete hooks[event]
    else hooks[event] = kept
  }
  if (Object.keys(hooks).length === 0 && removed > 0) delete next.hooks
  return {next, removed}
}

/** Uninstall's cut: our entries only. */
function withoutOurs(settings: Settings): {next: Settings; removed: number} {
  return without(settings, (_event, entry) => ours(entry))
}

/** Install's cut: our entries and the hand-pasted one it replaces. */
function withoutOursOrPasted(settings: Settings): Settings {
  return without(
    settings,
    (event, entry) => ours(entry) || (event === 'SessionStart' && pasted(entry)),
  ).next
}

function wire(settings: Settings, binary: string): Settings {
  const next = withoutOursOrPasted(settings)
  const hooks = (next.hooks ??= {})
  for (const wiring of WIRINGS) {
    const group: Group = wiring.matcher === undefined ? {} : {matcher: wiring.matcher}
    group.hooks = [wanted(binary)]
    ;(hooks[wiring.event] ??= []).push(group)
  }
  return next
}

function same(a: string, b: string): boolean {
  try {
    return readFileSync(a).equals(readFileSync(b))
  } catch {
    return false
  }
}

/** A unique name to move a binary aside to; `sweepAside` removes them. */
function aside(binary: string): string {
  return `${binary}.old-${process.pid}-${Date.now()}`
}

/** Remove what earlier runs moved aside; one still running stays until the next run. */
function sweepAside(binary: string): void {
  const dir = dirname(binary)
  const prefix = `${basename(binary)}.old`
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return
  }
  for (const name of names) {
    if (!name.startsWith(prefix)) continue
    try {
      rmSync(join(dir, name), {force: true})
    } catch {
      // In use on Windows: the next run removes it.
    }
  }
}

/**
 * Copy the binary in through a temp file. On Windows a running .exe cannot be
 * replaced or deleted but can be renamed: the old one moves aside first.
 */
function place(source: string, binary: string, platform: string): boolean {
  sweepAside(binary)
  if (existsSync(binary) && same(source, binary)) return false
  mkdirSync(dirname(binary), {recursive: true})
  const temp = `${binary}.tmp-${process.pid}`
  try {
    copyFileSync(source, temp)
    chmodSync(temp, 0o755)
    if (platform === 'win32' && existsSync(binary)) renameSync(binary, aside(binary))
    renameSync(temp, binary)
  } catch (error) {
    rmSync(temp, {force: true})
    throw error
  }
  return true
}

function removeBinary(binary: string, platform: string): void {
  try {
    rmSync(binary, {force: true})
  } catch (error) {
    if (platform !== 'win32') throw error
    renameSync(binary, aside(binary))
  }
  sweepAside(binary)
}

function protocolOf(path: string): string | null {
  try {
    return execFileSync(path, ['--protocol'], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

function statusOf(path: string): BinaryStatus | null {
  try {
    const text = execFileSync(path, ['--status'], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const parsed: unknown = JSON.parse(text)
    return isObject(parsed) ? (parsed as BinaryStatus) : null
  } catch {
    return null
  }
}

function settingsError(
  loaded: Exclude<Loaded, {kind: 'ok'}>,
  path: string,
  rerun: string,
): CommandResult {
  return loaded.kind === 'invalid'
    ? {
        text: [
          `greenrack hook: ${path} cannot be used:`,
          `  ${loaded.reason}`,
          'Nothing was changed. Fix the file, then run:',
          `  ${rerun}`,
        ].join('\n'),
        data: {kind: 'usage-error', reason: loaded.reason},
        exitCode: 2,
      }
    : {
        text: [
          `greenrack hook: cannot read ${path} (${loaded.reason}).`,
          "Nothing was changed. Check the file's permissions.",
        ].join('\n'),
        data: {kind: 'unreadable', reason: loaded.reason},
        exitCode: 3,
      }
}

/** A file this could not write: exit 3, naming the file, never a stack trace. */
function writeFailed(error: unknown, home: string): CommandResult {
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  if (code === undefined) throw error
  // A copy names its source in `path` and the file it could not write in `dest`.
  const failed = error as NodeJS.ErrnoException & {dest?: string}
  const path = failed.dest ?? failed.path
  return {
    text: [
      `greenrack hook: cannot write ${path === undefined ? 'a file' : shown(path, home)} (${code}).`,
      'Check its permissions; on Windows, close what holds it, then rerun.',
    ].join('\n'),
    data: {kind: 'write-failed', path: path ?? null, code},
    exitCode: 3,
  }
}

/** `greenrack hook install --user`, or with `check`, `--check`. */
export function runUserInstall(options: UserHookOptions = {}): CommandResult {
  return options.check ? runUserCheck(options) : install(options)
}

function install(options: UserHookOptions): CommandResult {
  const at = where(options)
  const source = options.source ?? firstTouchBinary(at.env, at.host)
  if ('error' in source) {
    return {
      text: [
        'greenrack hook install --user: nothing was written.',
        `  ${source.error}`,
        ...(source.fix === undefined ? [] : [`  ${source.fix}`]),
        'A hook with no binary cannot run.',
      ].join('\n'),
      data: {kind: 'usage-error', reason: source.error},
      exitCode: 2,
    }
  }
  const loaded = load(at.settings)
  if (loaded.kind !== 'ok') {
    return settingsError(loaded, shown(at.settings, at.home), INSTALL_COMMAND)
  }
  const lines: string[] = []
  try {
    if (place(source.path, at.binary, at.host.platform)) {
      lines.push(`  written  ${shown(at.binary, at.home)}`)
    }
    const before = drift(loaded.settings, at.binary, at.home)
    if (before.length > 0) {
      save(loaded.target, wire(loaded.settings, at.binary), loaded.exists)
      lines.push(`  wired    ${shown(at.settings, at.home)}: SessionStart, PreToolUse`)
      if (before.some((line) => line.includes('pasted'))) {
        lines.push('  removed  the pasted greenrack-cli context entry')
      }
    }
  } catch (error) {
    return writeFailed(error, at.home)
  }
  if (lines.length === 0) {
    return {
      text: 'greenrack first-touch hook: already installed',
      data: {state: 'present', changed: false, binary: at.binary, settings: at.settings},
    }
  }
  return {
    text: ['greenrack first-touch hook: installed', ...lines, RESTART].join('\n'),
    data: {state: 'present', changed: true, binary: at.binary, settings: at.settings},
  }
}

/** `greenrack hook uninstall --user`: our two entries and the binary, nothing else. */
export function runUserUninstall(options: UserHookOptions = {}): CommandResult {
  const at = where(options)
  const loaded = load(at.settings)
  if (loaded.kind !== 'ok') {
    return settingsError(loaded, shown(at.settings, at.home), UNINSTALL_COMMAND)
  }
  const lines: string[] = []
  try {
    // The entries first: a binary with no entry is inert, an entry with no
    // binary fails on every tool call.
    const {next, removed} = withoutOurs(loaded.settings)
    if (removed > 0) {
      save(loaded.target, next, loaded.exists)
      lines.push(
        `  unwired  ${shown(at.settings, at.home)}: ${removed} entr${removed === 1 ? 'y' : 'ies'}`,
      )
    }
    if (existsSync(at.binary)) {
      removeBinary(at.binary, at.host.platform)
      lines.push(`  removed  ${shown(at.binary, at.home)}`)
    } else {
      sweepAside(at.binary)
    }
  } catch (error) {
    return writeFailed(error, at.home)
  }
  if (lines.length === 0) {
    return {
      text: 'greenrack first-touch hook: not installed',
      data: {state: 'absent', changed: false},
    }
  }
  return {
    text: ['greenrack first-touch hook: uninstalled', ...lines, RESTART].join('\n'),
    data: {state: 'absent', changed: true},
  }
}

function runUserCheck(options: UserHookOptions): CommandResult {
  const at = where(options)
  const override = Boolean(at.env.GREENRACK_FIRST_TOUCH_BIN)
  if (!override && targetFor(at.host) === undefined) {
    const host = `${at.host.platform}/${at.host.arch}${at.host.libc ? `/${at.host.libc}` : ''}`
    return {
      text: `greenrack hook install --user --check:\n  no first-touch binary is built for ${host}`,
      data: {kind: 'usage-error', reason: 'unsupported platform'},
      exitCode: 2,
    }
  }
  const loaded = load(at.settings)
  if (loaded.kind !== 'ok') {
    return settingsError(loaded, shown(at.settings, at.home), `${INSTALL_COMMAND} --check`)
  }

  const problems: string[] = []
  let status: BinaryStatus | null = null
  if (!existsSync(at.binary)) {
    problems.push(`binary: not at ${shown(at.binary, at.home)}`)
  } else {
    const spoken = (options.protocolOf ?? protocolOf)(at.binary)
    if (spoken === null) problems.push('binary: does not run')
    else if (spoken !== FIRST_TOUCH_PROTOCOL) {
      problems.push(`binary: protocol ${spoken}, this CLI speaks ${FIRST_TOUCH_PROTOCOL}`)
    } else {
      status = (options.statusOf ?? statusOf)(at.binary)
    }
  }
  problems.push(...drift(loaded.settings, at.binary, at.home))

  const source = options.source ?? firstTouchBinary(at.env, at.host)
  const outdated = problems.length === 0 && !('error' in source) && !same(source.path, at.binary)
  const now = options.now ?? Math.floor(Date.now() / 1000)
  const notes: string[] = []
  const last = status?.lastFailure
  if (last) {
    const ago = Math.max(0, Math.round((now - last.ts) / 60))
    notes.push(`  last failure ${ago} min ago: ${last.outcome}`)
  }
  for (const failure of status?.backingOff ?? []) {
    notes.push(`  backing off: ${failure.count} failures, last: ${failure.reason ?? 'unknown'}`)
  }
  const state = problems.length === 0 ? 'present' : 'absent'
  const data = {state, outdated, problems, binary: at.binary, settings: at.settings, status}
  if (problems.length > 0) {
    return {
      text: [
        'greenrack first-touch hook: not installed as expected',
        ...problems.map((line) => clip(`  ${line}`)),
        ...notes.map(clip),
        'run:',
        `  ${INSTALL_COMMAND}`,
      ].join('\n'),
      data,
      exitCode: 1,
    }
  }
  const head = outdated
    ? [
        'greenrack first-touch hook: outdated (from another release)',
        'run:',
        `  ${INSTALL_COMMAND}`,
      ]
    : ['greenrack first-touch hook: installed']
  return {text: [...head, ...notes.map(clip)].join('\n'), data}
}
