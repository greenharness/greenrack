import {describe, expect, it} from 'vitest'
import {mergeRefs} from '../src/shared/mergeRefs'

describe('mergeRefs', () => {
  it('runs the cleanup a callback ref returns, and never calls it with null', () => {
    const log: unknown[] = []
    const merged = mergeRefs<string>((value) => {
      log.push(value)
      return () => log.push('cleanup')
    })
    const cleanup = merged('el')
    expect(typeof cleanup).toBe('function')
    ;(cleanup as () => void)()
    expect(log).toEqual(['el', 'cleanup'])
  })

  it('calls a callback ref without a cleanup with null on detach', () => {
    const log: unknown[] = []
    const cleanup = mergeRefs<string>((value) => {
      log.push(value)
    })('el') as () => void
    cleanup()
    expect(log).toEqual(['el', null])
  })

  it('sets and clears object refs beside callback refs', () => {
    const a = {current: null as string | null}
    const b = {current: null as string | null}
    const cleanup = mergeRefs<string>(a, undefined, b)('el') as () => void
    expect([a.current, b.current]).toEqual(['el', 'el'])
    cleanup()
    expect([a.current, b.current]).toEqual([null, null])
  })
})
