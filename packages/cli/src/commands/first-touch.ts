import type {Registry} from '../registry-types.js'
import {runContext} from './context.js'
import {isGreenrackConsumer} from './doctor.js'
import type {CommandResult} from './lookup.js'

/**
 * Characters the context may take. Claude Code saves hook context above
 * 10,000 characters to a file, and the `greenrack-first-touch` binary refuses
 * output above 9,900, which leaves room for the JSON wrapper's escapes.
 */
export const FIRST_TOUCH_CAP = 9500

const TRUNCATED = '[truncated; run: greenrack context]'

/** What the `greenrack-first-touch` binary passes, in its environment. */
export interface FirstTouchOptions {
  /** The repository root the hook resolved (`GREENRACK_FIRST_TOUCH_ROOT`). */
  root?: string
  /** `SessionStart` or `PreToolUse` (`GREENRACK_FIRST_TOUCH_EVENT`). */
  event?: string
  /** Why an earlier call gave nothing (`GREENRACK_FIRST_TOUCH_UNAVAILABLE`). */
  unavailable?: string
  /** Where the doctor cache lives; tests only. */
  cacheHome?: string
}

export function firstTouchOptions(env: NodeJS.ProcessEnv = process.env): FirstTouchOptions {
  return {
    root: env.GREENRACK_FIRST_TOUCH_ROOT || undefined,
    event: env.GREENRACK_FIRST_TOUCH_EVENT || undefined,
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

/**
 * `greenrack hook first-touch`: the index for the root the hook binary
 * resolved, as SessionStart text or as one PreToolUse JSON object. Nothing for
 * a root that is not a greenrack consumer: the binary's test is a superset, so
 * this one decides.
 */
export function runFirstTouch(registry: Registry, options: FirstTouchOptions): CommandResult {
  const nothing: CommandResult = {text: '', data: {given: false}}
  const root = options.root
  if (root === undefined || !isGreenrackConsumer(root)) return nothing
  const context = runContext(registry, {cwd: root, cacheHome: options.cacheHome}).text
  if (context === '') return nothing
  const head = [`greenrack index for ${root} (first touch this session)`]
  const start = options.event === 'SessionStart'
  if (start && options.unavailable) {
    head.push(
      `greenrack index unavailable (${options.unavailable}); run: greenrack hook install --user --check`,
    )
  }
  const lead = `${head.join('\n')}\n`
  const text = lead + cutAtLine(context, FIRST_TOUCH_CAP - lead.length)
  if (start) return {text, data: {given: true}}
  return {
    text: JSON.stringify({
      hookSpecificOutput: {hookEventName: 'PreToolUse', additionalContext: text},
    }),
    data: {given: true},
  }
}
