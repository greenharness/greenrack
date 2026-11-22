import {describeDropped, type DroppedToken} from '@greenharness/greenrack-tokens/theme'

// Process-wide on purpose: every provider on a page shares one theme file, so
// one warning per value is enough. holds-until: two apps with different theme
// files share a page and need their own warnings (then keep it per provider).
const warned = new Set<string>()

/** A dedupe key for any caller value: a value JSON cannot hold (a cycle, a BigInt) never throws. */
function signatureOf({mode, group, key, value}: DroppedToken): string {
  let shown: string
  try {
    shown = JSON.stringify(value) ?? String(value)
  } catch {
    shown = `${typeof value}:${String(value)}`
  }
  return JSON.stringify([mode ?? null, group, key, shown])
}

/**
 * One development warning per distinct dropped entry, so a provider that
 * re-renders (or many that share a theme file) does not repeat itself. The
 * same bad value in two modes is two entries. Called from an effect, never
 * during render.
 */
export function warnDropped(dropped: readonly DroppedToken[]): void {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return
  for (const entry of dropped) {
    const signature = signatureOf(entry)
    if (warned.has(signature)) continue
    warned.add(signature)
    console.warn(`[greenrack] ThemeProvider dropped ${describeDropped(entry)}`)
  }
}
