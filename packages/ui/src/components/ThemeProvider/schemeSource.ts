import {createContext} from 'react'

/**
 * Where the nearest ThemeProvider's theme comes from: `'system'` when a
 * ColorModeProvider resolves it from the OS (`prefers-color-scheme`), which
 * the server cannot see, else `'pinned'`. Its own module because ColorMode
 * imports ThemeProvider.
 *
 * Only the nearest ThemeProvider under a ColorModeProvider reads `'system'`
 * (the one it renders under `applyTheme`, or the app's own under
 * `applyTheme={false}`), and every ThemeProvider gives `'pinned'` to its
 * children: a nested provider is an island that keeps its own theme. Under
 * `applyTheme={false}` every ThemeProvider directly under a ColorModeProvider
 * (not nested in another one) reads `'system'`, siblings included: an island
 * must sit inside the app's following provider, never beside it.
 */
export type SchemeSource = 'system' | 'pinned'

export const SchemeSourceContext = createContext<SchemeSource>('pinned')
