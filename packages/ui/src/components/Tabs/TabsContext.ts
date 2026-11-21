import {createContext, useContext} from 'react'
import type {Orientation} from '../../shared/types'

export type {Orientation}

export interface TabsContextValue {
  activeValue: string | null
  onSelect: (value: string) => void
  orientation: Orientation
  registerTab: (value: string, disabled: boolean) => () => void
  tabsRef: React.RefObject<Map<string, boolean>>
  orderRef: React.RefObject<string[]>
  // True once the List has measured the active tab and is driving a sliding
  // indicator. Tabs suppress their own accent border while it's true so the
  // single sliding bar is the only underline; it stays false without JS
  // (SSR / no-hydration), where the per-tab border is the graceful fallback.
  indicatorActive: boolean
  setIndicatorActive: (active: boolean) => void
  /** The Root's own id: each tab's and panel's id derive from it and their value. */
  baseId: string
}

/**
 * The ids of the tab and the panel for `value`. encodeURIComponent keeps two values apart and
 * drops whitespace, which would split an IDREF.
 */
export function tabIds(baseId: string, value: string) {
  const key = encodeURIComponent(value)
  return {tabId: `${baseId}-tab-${key}`, panelId: `${baseId}-panel-${key}`}
}

export const TabsContext = createContext<TabsContextValue | null>(null)

export function useTabs() {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('Tabs compound components must be used within Tabs.Root')
  return ctx
}
