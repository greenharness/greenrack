import type {Registry} from '../registry-types.js'
import {runContext} from './context.js'
import {isGreenrackConsumer} from './doctor.js'
import {FIRST_TOUCH_PROTOCOL, INSTALL_COMMAND} from './hook-user.js'
import type {CommandResult} from './lookup.js'

/**
 * Characters the hook's stdout may take: the SessionStart text, or the whole
 * PreToolUse JSON object with its escapes. Claude Code saves hook context
 * above 10,000 characters to a file, and the `greenrack-first-touch` binary
 * refuses output above 9,900.
 */
export const FIRST_TOUCH_CAP = 9500

const TRUNCATED = '[truncated; run: greenrack context]'

/** The two hook events the binary runs the CLI for. */
export type FirstTouchEvent = 'SessionStart' | 'PreToolUse'

/** What the `greenrack-first-touch` binary passes, in its environment. */
export interface FirstTouchOptions {
  /** The repository root the hook resolved (`GREENRACK_FIRST_TOUCH_ROOT`). */
  root?: string
  /** The hook event (`GREENRACK_FIRST_TOUCH_EVENT`); any other value is none. */
  event?: FirstTouchEvent
  /** The protocol the binary speaks (`GREENRACK_FIRST_TOUCH_PROTOCOL`). */
  protocol?: string
  /** Why an earlier call gave nothing (`GREENRACK_FIRST_TOUCH_UNAVAILABLE`). */
  unavailable?: string
  /** Where the doctor cache lives; tests only. */
  cacheHome?: string
}

export function firstTouchOptions(env: NodeJS.ProcessEnv = process.env): FirstTouchOptions {
  const event = env.GREENRACK_FIRST_TOUCH_EVENT
  return {
    root: env.GREENRACK_FIRST_TOUCH_ROOT || undefined,
    event: event === 'SessionStart' || event === 'PreToolUse' ? event : undefined,
    protocol: env.GREENRACK_FIRST_TOUCH_PROTOCOL || undefined,
    unavailable: env.GREENRACK_FIRST_TOUCH_UNAVAILABLE || undefined,
  }
}

/** Cut `text` to `room` characters at a line end, saying where the rest is. */
export function cutAtLine(text: string, room: number): string {
  if (text.length <= room) return text
  const cut = text.slice(0, Math.max(0, room - TRUNCATED.length - 1))
  const lineEnd = cut.lastIndexOf('\n')
  return `${lineEnd > 0 ? cut.slice(0, lineEnd) : cut}\n${TRUNCATED}`
}

function preToolUse(text: string): string {
  return JSON.stringify({
    hookSpecificOutput: {hookEventName: 'PreToolUse', additionalContext: text},
  })
}

/**
 * `greenrack hook first-touch`: the index for the root the hook binary
 * resolved, as SessionStart text or as one PreToolUse JSON object. Nothing for
 * a root that is not a greenrack consumer (the binary's test is a superset, so
 * this one decides), for another event, or for a protocol this CLI does not
 * speak.
 */
export function runFirstTouch(registry: Registry, options: FirstTouchOptions): CommandResult {
  const nothing: CommandResult = {text: '', data: {given: false}}
  if (options.protocol !== undefined && options.protocol !== FIRST_TOUCH_PROTOCOL) return nothing
  const {root, event} = options
  if (root === undefined || event === undefined || !isGreenrackConsumer(root)) return nothing
  const context = runContext(registry, {cwd: root, cacheHome: options.cacheHome}).text
  if (context === '') return nothing
  const head = [`greenrack index for ${root} (first touch this session)`]
  const start = event === 'SessionStart'
  if (start && options.unavailable) {
    // The reason (up to 200 characters from npx) gets a line of its own.
    head.push(
      'greenrack index unavailable:',
      `  ${options.unavailable}`,
      'check it with:',
      `  ${INSTALL_COMMAND} --check`,
    )
  }
  const lead = `${head.join('\n')}\n`
  let room = FIRST_TOUCH_CAP - lead.length
  if (start) return {text: lead + cutAtLine(context, room), data: {given: true}}
  // JSON escapes grow the text (every `\` of a Windows root, every quote and
  // newline): cut again by the overflow until the object itself fits.
  for (;;) {
    const json = preToolUse(lead + cutAtLine(context, room))
    if (json.length <= FIRST_TOUCH_CAP || room <= 0) return {text: json, data: {given: true}}
    room -= json.length - FIRST_TOUCH_CAP
  }
}
