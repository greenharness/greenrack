#!/usr/bin/env node
// The release refuses a tag whose major differs from the CLI floors the
// session hook and the skill pin (HOOK_MIN_CLI, SKILL_MIN_CLI). A caret on an
// older major never reaches the new one, so consumers would be served the old
// docs: 3.4.0 kept every 4.x consumer on 3.x. package.json cannot say this —
// it reads 1.0.0 in source and the release writes the tag's version.
//
// It also refuses a tag below the first-touch floor (FIRST_TOUCH_MIN_CLI), and
// a binary or grh manifest naming another floor: the hook would start a CLI
// without `hook first-touch`. 7.7.0 to 7.10.0 shipped while that floor read
// 7.7.0, and nothing caught it.
// Usage: check-pin-major.mjs <version>
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'

const read = (f) => readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8')
const src = (f) => read(`../src/${f}`)

/** The floor a source file declares, e.g. '4.4.0'. */
export function floorIn(text, name) {
  const m = new RegExp(`export const ${name} = '(\\d+)\\.\\d+\\.\\d+'`).exec(text)
  if (!m) throw new Error(`${name} not found`)
  return Number(m[1])
}

/** Problems for `version`: none when both floors share its major. */
export function pinMajorProblems(version, hookSrc, skillSrc) {
  const major = Number(String(version).replace(/^v/, '').split('.')[0])
  const floors = {
    HOOK_MIN_CLI: floorIn(hookSrc, 'HOOK_MIN_CLI'),
    SKILL_MIN_CLI: floorIn(skillSrc, 'SKILL_MIN_CLI'),
  }
  return Object.entries(floors)
    .filter(([, f]) => f !== major)
    .map(
      ([n, f]) =>
        `${n} is ^${f}.x but this release is ${major}.x — raise it, or no ${major}.x consumer gets this release's docs`,
    )
}

/** `1.2.3` (a `v` and a prerelease aside) as three numbers. */
const parts = (version) => String(version).replace(/^v/, '').split('-')[0].split('.').map(Number)

/** Whether `a` is a lower version than `b`. */
function below(a, b) {
  const [x, y] = [parts(a), parts(b)]
  const i = [0, 1, 2].find((k) => x[k] !== y[k])
  return i !== undefined && x[i] < y[i]
}

/**
 * Problems for `version` and the first-touch floor: none when the release is
 * at or above FIRST_TOUCH_MIN_CLI, and the binary's one CLI pin and the three
 * `[tool.machine]` commands name exactly that floor.
 */
export function firstTouchFloorProblems(version, hookUserSrc, mainRs, manifest) {
  const m = /export const FIRST_TOUCH_MIN_CLI = '(\d+\.\d+\.\d+)'/.exec(hookUserSrc)
  if (!m) throw new Error('FIRST_TOUCH_MIN_CLI not found')
  const floor = m[1]
  const pin = `@greenharness/greenrack-cli@^${floor}`
  const problems = []
  if (below(version, floor)) {
    problems.push(
      `this release is ${version} but FIRST_TOUCH_MIN_CLI is ${floor} — the hook would start a CLI without hook first-touch`,
    )
  }
  const pins = [...mainRs.matchAll(/"(@greenharness\/greenrack-cli@[^"]*)"/g)].map((p) => p[1])
  if (pins.length !== 1 || pins[0] !== pin) {
    problems.push(`crates/first-touch/src/main.rs names ${pins.join(', ') || 'no CLI'}, not ${pin}`)
  }
  const commands = manifest.split('\n').filter((l) => /"hook", "(un)?install", "--user"/.test(l))
  if (commands.length !== 3 || commands.some((l) => !l.includes(`"${pin}"`))) {
    problems.push(`greenharness.toml: the three [tool.machine] commands must name ${pin}`)
  }
  return problems
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2]
  if (!version) {
    console.error('usage: check-pin-major.mjs <version>')
    process.exit(2)
  }
  const problems = [
    ...pinMajorProblems(version, src('hook-script.ts'), src('skill-template.ts')),
    ...firstTouchFloorProblems(
      version,
      src('commands/hook-user.ts'),
      read('../../../crates/first-touch/src/main.rs'),
      read('../greenharness.toml'),
    ),
  ]
  for (const p of problems) console.error(`check-pin-major: ${p}`)
  process.exit(problems.length ? 1 : 0)
}
