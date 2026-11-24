import type {Ref, RefCallback} from 'react'

/** Sets one ref and returns what undoes it: the callback's own cleanup, else a call with `null`, else clearing `current`. */
function attach<T>(ref: Ref<T> | undefined, value: T | null): () => void {
  if (typeof ref === 'function') {
    const cleanup = ref(value)
    return typeof cleanup === 'function' ? cleanup : () => ref(null)
  }
  if (ref) {
    const box = ref as {current: T | null}
    box.current = value
    return () => {
      box.current = null
    }
  }
  return () => {}
}

/**
 * One callback ref that sets every ref given (object or callback). It
 * returns a cleanup (React 19), so a caller's ref that returns its own
 * cleanup gets it run on detach, and one that does not is called with `null`.
 */
export function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): RefCallback<T> {
  return (value) => {
    const cleanups = refs.map((ref) => attach(ref, value))
    return () => {
      for (const cleanup of cleanups) cleanup()
    }
  }
}
