import {createHash} from 'node:crypto'
import {mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join, relative, resolve} from 'node:path'
import type {Registry} from '../registry-types.js'
import {renderCatalog, renderIndex} from '../catalog.js'
import type {CatalogRender} from '../catalog.js'
import {isGreenrackConsumer, runDoctor} from './doctor.js'
import type {CommandResult} from './lookup.js'
import {cliVersion} from './manifest.js'

/** `index`: the short session context. `full`: the whole catalog, as printed before 7.6. */
export type ContextView = 'index' | 'full'

/** Claude Code saves hook context above 10,000 characters to a file: stay under this. */
export const CONTEXT_CAP = 9000

export interface ContextOptions {
  /** Print only the catalog or index; leave the doctor block out. */
  catalogOnly?: boolean
  /** What to print before the doctor block. Defaults to the short index. */
  view?: ContextView
  /** Repo root. Defaults to the process cwd. */
  cwd?: string
  /** Where the doctor cache lives. Defaults to `${XDG_CACHE_HOME:-~/.cache}`. */
  cacheHome?: string
}

/** Directories the build-file scan never enters. */
const PRUNED = new Set(['node_modules', '.git', 'dist', 'build'])
const SCAN_DEPTH = 4
/** The files `greenrack doctor` reads: build config, entries, stylesheets, manifests. */
const BUILD_FILE =
  /^(?:package\.json|pnpm-workspace\.yaml|.*\.css|vite.*|babel.*|\.babelrc.*|.*\.babel\..*|postcss.*|root\.tsx|main\.tsx|index\.tsx)$/

function defaultCacheHome(): string {
  const xdg = process.env.XDG_CACHE_HOME
  return xdg ? xdg : join(homedir(), '.cache')
}

/** Every build file under `root` within SCAN_DEPTH, as repo-relative POSIX paths, sorted. */
function buildFiles(root: string): string[] {
  const found: string[] = []
  const walk = (dir: string, depth: number): void => {
    let entries
    try {
      entries = readdirSync(dir, {withFileTypes: true})
    } catch {
      return
    }
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (depth < SCAN_DEPTH && !PRUNED.has(entry.name)) walk(path, depth + 1)
      } else if (entry.isFile() && BUILD_FILE.test(entry.name)) {
        found.push(relative(root, path).split('\\').join('/'))
      }
    }
  }
  walk(root, 1)
  return found.sort()
}

/** Changes when any build file, or the CLI that reads them, changes. */
function buildKey(root: string): string {
  const hash = createHash('sha1').update(`greenrack ${cliVersion()}\n`)
  for (const path of buildFiles(root)) {
    try {
      hash
        .update(`${path}\0`)
        .update(readFileSync(join(root, path)))
        .update('\0')
    } catch {
      hash.update(`${path}\0unreadable\0`)
    }
  }
  return hash.digest('hex')
}

function readCache(path: string): string | null {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

/** tmp-then-rename; a failed write is silent, the next session recomputes. */
function writeCache(path: string, content: string): void {
  try {
    mkdirSync(join(path, '..'), {recursive: true})
    const partialPath = `${path}.tmp`
    writeFileSync(partialPath, content, 'utf8')
    renameSync(partialPath, path)
  } catch {
    // The cache is an optimisation: an unwritable cache dir costs a rerun.
  }
}

/** `greenrack doctor --session` output, re-run only when the build files' key changes. */
function cachedDoctor(root: string, cacheHome: string): string {
  const dir = join(
    cacheHome,
    'greenrack',
    createHash('sha1').update(root).digest('hex').slice(0, 16),
  )
  const key = buildKey(root)
  if (readCache(join(dir, 'doctor.key')) === key) {
    const cached = readCache(join(dir, 'doctor'))
    if (cached !== null) return cached
  }
  const text = runDoctor({session: true, cwd: root}).text
  writeCache(join(dir, 'doctor'), text)
  writeCache(join(dir, 'doctor.key'), key)
  return text
}

/** The whole catalog behind one line that says how big it is and where the short index is. */
function renderFullCatalog(registry: Registry): CatalogRender {
  const catalog = renderCatalog(registry)
  const kb = (Buffer.byteLength(catalog.text, 'utf8') / 1024).toFixed(1)
  const header = `greenrack catalog, whole (${kb} KB). \`greenrack context\` prints the short index.`
  return {text: `${header}\n${catalog.text}`, data: catalog.data}
}

function renderView(registry: Registry, view: ContextView): CatalogRender {
  switch (view) {
    case 'index':
      return renderIndex(registry)
    case 'full':
      return renderFullCatalog(registry)
  }
}

/**
 * Cut the doctor text to `room` characters, at a line end, and say how much was
 * left out and where to read it: a monorepo with many warnings must not push
 * the whole output back over the hook cap.
 */
function fitDoctor(doctor: string, room: number): string {
  if (doctor.length <= room) return doctor
  const cut = doctor.slice(0, Math.max(0, room - 80))
  const lineEnd = cut.lastIndexOf('\n')
  const kept = lineEnd > 0 ? cut.slice(0, lineEnd) : cut
  return `${kept}\n… ${doctor.length - kept.length} more characters: run \`greenrack doctor\``
}

/** What `runContext` returns outside a greenrack consumer. */
const NOT_A_CONSUMER = Object.freeze({consumer: false})

/**
 * The line a person at a terminal gets where a hook gets silence, or null when
 * nothing should be said: the result is a consumer's, or nobody is at a terminal.
 */
export function nonConsumerNote(result: CommandResult, isTTY: boolean, cwd: string): string | null {
  if (!isTTY || result.data !== NOT_A_CONSUMER) return null
  return `greenrack: not a greenrack consumer: no @greenharness/greenrack-* dependency in ${cwd}`
}

/**
 * `greenrack context`: what a session should know about the design system. The
 * short index (the whole catalog with view `full`), then the doctor block when
 * the build wiring is wrong, cut so the index view stays under the hook cap.
 * Outside a greenrack consumer it prints nothing, so a harness can run it
 * anywhere.
 */
export function runContext(registry: Registry, options: ContextOptions = {}): CommandResult {
  const root = resolve(options.cwd ?? process.cwd())
  if (!isGreenrackConsumer(root)) return {text: '', data: NOT_A_CONSUMER}
  const view = options.view ?? 'index'
  const catalog = renderView(registry, view)
  if (options.catalogOnly) return {text: catalog.text, data: catalog.data}
  const cached = cachedDoctor(root, options.cacheHome ?? defaultCacheHome())
  const doctor =
    view === 'index' ? fitDoctor(cached, CONTEXT_CAP - catalog.text.length - 2) : cached
  return {
    text: doctor === '' ? catalog.text : `${catalog.text}\n\n${doctor}`,
    data: {...catalog.data, doctor},
  }
}
