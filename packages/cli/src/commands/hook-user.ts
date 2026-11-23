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
import {dirname, join, resolve} from 'node:path'
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
 * What `greenrack-first-touch --protocol` prints for this CLI. The binary and
 * `greenrack hook first-touch` speak it: the event on stdin, the root and the
 * event name in GREENRACK_FIRST_TOUCH_* variables, the index on stdout. A
 * binary speaking another one is reinstalled; one from another release that
 * speaks this one is only `outdated`.
 */
export const FIRST_TOUCH_PROTOCOL = '1'
export const FIRST_TOUCH_MATCHER = 'Read|Edit|Write|MultiEdit|NotebookEdit|Bash'
/** Seconds Claude Code gives the hook: the binary's own limit is 10. */
export const FIRST_TOUCH_TIMEOUT = 15

const INSTALL = 'greenrack hook install --user'
const RESTART = 'restart Claude Code sessions'

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
  /** Seconds since the epoch, for the back-off report. */
  now?: number
}

type Entry = {type?: string; command?: unknown; args?: unknown; timeout?: unknown} & Record<
  string,
  unknown
>
type Group = {matcher?: unknown; hooks?: Entry[]} & Record<string, unknown>
type Settings = {hooks?: Record<string, Group[]>} & Record<string, unknown>

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

/** settings.json, followed through a symlink, with `hooks` checked to be what this edits. */
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
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {kind: 'invalid', reason: 'the file is not a JSON object'}
  }
  const hooks = (parsed as Settings).hooks
  if (hooks !== undefined) {
    if (typeof hooks !== 'object' || hooks === null || Array.isArray(hooks)) {
      return {kind: 'invalid', reason: '"hooks" is not an object'}
    }
    for (const {event} of WIRINGS) {
      const groups = hooks[event]
      if (groups !== undefined && !Array.isArray(groups)) {
        return {kind: 'invalid', reason: `"hooks.${event}" is not an array`}
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
function drift(settings: Settings, binary: string): string[] {
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
      if (entry.command !== binary) found.push(`${wiring.event}: runs ${String(entry.command)}`)
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
 * A copy without our entries (and, for install, the pasted one). A group or
 * an event list this empties goes; one that was empty before stays.
 */
function strip(settings: Settings, alsoPasted: boolean): {next: Settings; removed: number} {
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
      const left = entries.filter(
        (entry) => !ours(entry) && !(alsoPasted && event === 'SessionStart' && pasted(entry)),
      )
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

function wire(settings: Settings, binary: string): Settings {
  const {next} = strip(settings, true)
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

/**
 * Copy the binary in through a temp file. On Windows a running .exe cannot be
 * replaced but can be renamed: the old one moves to `.old`, which the next run
 * removes.
 */
function place(source: string, binary: string, platform: string): boolean {
  rmQuietly(`${binary}.old`)
  if (existsSync(binary) && same(source, binary)) return false
  mkdirSync(dirname(binary), {recursive: true})
  const temp = `${binary}.tmp-${process.pid}`
  try {
    copyFileSync(source, temp)
    chmodSync(temp, 0o755)
    if (platform === 'win32' && existsSync(binary)) renameSync(binary, `${binary}.old`)
    renameSync(temp, binary)
  } catch (error) {
    rmSync(temp, {force: true})
    throw error
  }
  return true
}

function rmQuietly(path: string): void {
  try {
    rmSync(path, {force: true})
  } catch {
    // In use on Windows: the next run removes it.
  }
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

function settingsError(loaded: Exclude<Loaded, {kind: 'ok'}>, path: string): CommandResult {
  return loaded.kind === 'invalid'
    ? {
        text: `greenrack hook: ${path} is not usable (${loaded.reason});\nfix or remove it, then rerun. Nothing was changed.`,
        data: {kind: 'usage-error', reason: loaded.reason},
        exitCode: 2,
      }
    : {
        text: `greenrack hook: cannot read ${path} (${loaded.reason}). Nothing was changed.`,
        data: {kind: 'unreadable', reason: loaded.reason},
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
      text: `greenrack hook install --user: ${source.error}.\nNothing was written: a hook with no binary cannot run.`,
      data: {kind: 'usage-error', reason: source.error},
      exitCode: 2,
    }
  }
  const loaded = load(at.settings)
  if (loaded.kind !== 'ok') return settingsError(loaded, shown(at.settings, at.home))

  const lines: string[] = []
  if (place(source.path, at.binary, at.host.platform)) {
    lines.push(`  written  ${shown(at.binary, at.home)}`)
  }
  const before = drift(loaded.settings, at.binary)
  if (before.length > 0) {
    save(loaded.target, wire(loaded.settings, at.binary), loaded.exists)
    lines.push(`  wired    ${shown(at.settings, at.home)}: SessionStart, PreToolUse`)
    if (before.some((line) => line.includes('pasted'))) {
      lines.push('  removed  the pasted greenrack-cli context entry')
    }
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
  if (loaded.kind !== 'ok') return settingsError(loaded, shown(at.settings, at.home))
  const lines: string[] = []
  const {next, removed} = strip(loaded.settings, false)
  if (removed > 0) {
    save(loaded.target, next, loaded.exists)
    lines.push(
      `  unwired  ${shown(at.settings, at.home)}: ${removed} entr${removed === 1 ? 'y' : 'ies'}`,
    )
  }
  if (existsSync(at.binary)) {
    rmSync(at.binary, {force: true})
    lines.push(`  removed  ${shown(at.binary, at.home)}`)
  }
  rmQuietly(`${at.binary}.old`)
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

/** The binary's state folder, as the binary computes it. */
export function stateDir(env: NodeJS.ProcessEnv, home: string, platform: string): string | null {
  if (platform === 'win32') return env.LOCALAPPDATA ? join(env.LOCALAPPDATA, FIRST_TOUCH_BIN) : null
  const xdg = env.XDG_STATE_HOME
  const base = xdg && xdg.startsWith('/') ? xdg : join(env.HOME || home, '.local/state')
  return join(base, FIRST_TOUCH_BIN)
}

/** The binary backs off after this many failures for a root inside the window. */
const BACKOFF_FAILURES = 3
const BACKOFF_WINDOW_SECS = 600

interface Health {
  lastFailure?: {ts: number; root: string; outcome: string}
  backingOff: Array<{count: number; ts: number; reason: string}>
}

/** The last failure in the decision log, and the roots the binary backs off from. */
function health(state: string | null, now: number): Health {
  const out: Health = {backingOff: []}
  if (state === null) return out
  try {
    const lines = readFileSync(join(state, 'log.jsonl'), 'utf8').trimEnd().split('\n')
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const row = JSON.parse(lines[i]!) as {ts?: number; root?: string; outcome?: string}
        if (row.outcome?.startsWith('failed')) {
          out.lastFailure = {ts: row.ts ?? 0, root: row.root ?? '', outcome: row.outcome}
          break
        }
      } catch {
        // A line cut by a trim: skip it.
      }
    }
  } catch {
    // No log yet.
  }
  try {
    for (const name of readdirSync(join(state, 'failures'))) {
      const [count, ts, ...reason] = readFileSync(join(state, 'failures', name), 'utf8').split(' ')
      const failure = {count: Number(count), ts: Number(ts), reason: reason.join(' ')}
      if (failure.count >= BACKOFF_FAILURES && now - failure.ts < BACKOFF_WINDOW_SECS) {
        out.backingOff.push(failure)
      }
    }
  } catch {
    // No failures.
  }
  return out
}

function runUserCheck(options: UserHookOptions): CommandResult {
  const at = where(options)
  const override = Boolean(at.env.GREENRACK_FIRST_TOUCH_BIN)
  if (!override && targetFor(at.host) === undefined) {
    const host = `${at.host.platform}/${at.host.arch}${at.host.libc ? `/${at.host.libc}` : ''}`
    return {
      text: `greenrack hook install --user --check: no first-touch binary is built for ${host}`,
      data: {kind: 'usage-error', reason: 'unsupported platform'},
      exitCode: 2,
    }
  }
  const loaded = load(at.settings)
  if (loaded.kind !== 'ok') return settingsError(loaded, shown(at.settings, at.home))

  const problems: string[] = []
  if (!existsSync(at.binary)) {
    problems.push(`binary: not at ${shown(at.binary, at.home)}`)
  } else {
    const spoken = (options.protocolOf ?? protocolOf)(at.binary)
    if (spoken === null) problems.push('binary: does not run')
    else if (spoken !== FIRST_TOUCH_PROTOCOL) {
      problems.push(`binary: protocol ${spoken}, this CLI speaks ${FIRST_TOUCH_PROTOCOL}`)
    }
  }
  problems.push(...drift(loaded.settings, at.binary))

  const source = options.source ?? firstTouchBinary(at.env, at.host)
  const outdated = problems.length === 0 && !('error' in source) && !same(source.path, at.binary)
  const now = options.now ?? Math.floor(Date.now() / 1000)
  const report = health(stateDir(at.env, at.home, at.host.platform), now)
  const notes: string[] = []
  if (report.lastFailure) {
    const ago = Math.max(0, Math.round((now - report.lastFailure.ts) / 60))
    notes.push(`  last failure ${ago} min ago: ${report.lastFailure.outcome}`)
  }
  for (const failure of report.backingOff) {
    notes.push(`  backing off: ${failure.count} failures, last: ${failure.reason}`)
  }
  const state = problems.length === 0 ? 'present' : 'absent'
  const data = {state, outdated, problems, binary: at.binary, settings: at.settings, ...report}
  if (problems.length > 0) {
    return {
      text: [
        'greenrack first-touch hook: not installed as expected',
        ...problems.map((line) => `  ${line}`),
        ...notes,
        `run: ${INSTALL}`,
      ].join('\n'),
      data,
      exitCode: 1,
    }
  }
  return {
    text: [
      outdated
        ? `greenrack first-touch hook: outdated (another release); run: ${INSTALL}`
        : 'greenrack first-touch hook: installed',
      ...notes,
    ].join('\n'),
    data,
  }
}
