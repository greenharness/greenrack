/**
 * The focus handlers of a row's button: whether its focus is a keyboard one (:focus-visible), so
 * the row draws the ring around its Leading and Actions too.
 */
export function focusRingHandlers(setShown: (shown: boolean) => void) {
  return {
    onFocus: (event: {currentTarget: HTMLElement}) =>
      setShown(event.currentTarget.matches(':focus-visible')),
    onBlur: () => setShown(false),
  }
}
