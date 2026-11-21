import type {Registry} from './registry-types.js'
import {runList} from './commands/list.js'
import {relatedPairs} from './disambiguation.js'
import {renderPairs} from './format.js'

// Injected into agent context by a Claude Code SessionStart hook. The point
// is to turn "consult the design system before building UI" from a remembered
// step into ambient context: with the catalog already in front of it, an
// agent has nothing to remember and no excuse to hand-roll a widget the
// design system ships.
export const PREAMBLE = [
  'greenrack design-system session bootstrap (greenrack context).',
  'The catalog below is already in your context — before hand-rolling ANY',
  'interactive element (menu, badge, tag, dialog, select, tooltip, ...),',
  'pick the design-system component or recipe from this list. When two of',
  'them could both fit, the neighbors section decides; the compose section',
  'says what already wraps what, so you never rebuild it. Details:',
  'greenrack <Component> (props+usage) · greenrack <recipe> --source-only ·',
  'greenrack spacing|icons|rules.',
  'A new screen, page or UI proposal starts with the /greenrack-mockup skill',
  '(greenrack skill install if this repo lacks it; it also installs the colors,',
  'typography and ui interface skills): token-seeded artboards, checked,',
  'then implemented from their component map.',
].join('\n')

/** One index line: the guides are fetched by name, never listed in the catalog. */
function renderGuideIndex(registry: Registry): string {
  const skills = Object.keys(registry.guides ?? {})
  if (skills.length === 0) return ''
  return `GUIDES: ${skills.map((skill) => `guide:${skill}`).join(' · ')} — interface rules, read with greenrack_lookup or greenrack guide:<name>`
}

/**
 * Recipes are in the index too, but buried under 65 components. A screen
 * starts from one of these before any grid is hand-rolled, so they lead.
 */
function renderScreens(registry: Registry): string {
  const entries = Object.entries(registry.recipes).sort(([a], [b]) => a.localeCompare(b))
  if (entries.length === 0) return ''
  const width = Math.max(...entries.map(([name]) => name.length)) + 2
  const rows = entries.map(([name, entry]) => `  ${name.padEnd(width)}${entry.meta.description}`)
  return [
    `SCREENS — START FROM A RECIPE (${entries.length})`,
    'A new screen copies the closest recipe (greenrack <recipe> --source-only) and',
    'edits it; a hand-rolled page layout needs a reason in the PR.',
    ...rows,
  ].join('\n')
}

/** Columns an index line may take: a narrow terminal and a screen reader both read it. */
const INDEX_WIDTH = 78

/**
 * Greedy wrap over items that never split. The first line starts with
 * `prefix`, later lines with `hang`; an item longer than the width keeps a
 * line of its own.
 */
function wrapItems(items: string[], prefix: string, hang: string): string {
  const lines: string[] = []
  let line = ''
  for (const item of items) {
    if (line === '') line = prefix + item
    else if (line.length + 1 + item.length > INDEX_WIDTH) {
      lines.push(line)
      line = hang + item
    } else line += ` ${item}`
  }
  if (line !== '') lines.push(line)
  return lines.join('\n')
}

/** Greedy word wrap: the items are the words. */
function wrap(text: string, prefix = '', hang = prefix): string {
  return wrapItems(text.split(/\s+/).filter(Boolean), prefix, hang)
}

/** The lead of the short index: what to do, and where the detail is fetched. */
export const INDEX_PREAMBLE = [
  wrap('greenrack design system index. `greenrack context --full` prints the whole catalog.'),
  wrap(
    'Before hand-rolling ANY interactive element (menu, badge, tag, dialog, select, tooltip, ...) look it up: `greenrack <Name>` prints props, usage and the RELATED neighbours (which one to pick, what already wraps what); `greenrack "<what it must do>"` searches; the `greenrack_lookup` MCP tool does both.',
  ),
  wrap(
    'A new screen starts from a recipe (`greenrack <recipe> --source-only`); a new screen, page or UI proposal starts with the /greenrack-mockup skill (`greenrack skill install` if this repo lacks it).',
  ),
].join('\n')

/** The recipes, wrapped under their names: a screen copies the closest one. */
function renderIndexScreens(registry: Registry): string {
  const entries = Object.entries(registry.recipes).sort(([a], [b]) => a.localeCompare(b))
  if (entries.length === 0) return ''
  const width = Math.max(...entries.map(([name]) => name.length)) + 2
  return [
    `SCREENS — START FROM A RECIPE (${entries.length})`,
    ...entries.map(([name, entry]) =>
      wrap(entry.meta.description, `  ${name.padEnd(width)}`, `  ${' '.repeat(width)}`),
    ),
  ].join('\n')
}

/**
 * The short session context (ADR-0026: an index, detail fetched on demand):
 * the rule, the recipes, every component name, the token groups and the
 * guides. What the neighbour and compose tables said now comes with
 * `greenrack <Name>` (its RELATED block). Built from the registry directly,
 * never through the list renderer, so no colour escape can reach it.
 */
export function renderIndex(registry: Registry) {
  const list = runList(registry)
  const contrast = relatedPairs(registry, 'contrast')
  const composition = relatedPairs(registry, 'composition')
  const names = Object.keys(registry.components).sort((a, b) => a.localeCompare(b))
  const sections = [
    INDEX_PREAMBLE,
    renderIndexScreens(registry),
    [
      `COMPONENTS (${names.length})`,
      // A name such as `Table (ui/table)` holds a space: wrap by name, never by word.
      wrapItems(
        names.map((name, i) => (i < names.length - 1 ? `${name},` : name)),
        '  ',
        '  ',
      ),
    ].join('\n'),
    wrap(
      `TOKENS: ${Object.keys(registry.tokens.groups).join(', ')}, icons, rules. Read one with \`greenrack <group>\`.`,
    ),
    wrap(renderGuideIndex(registry)),
  ].filter(Boolean)
  return {
    text: sections.join('\n\n'),
    data: {preamble: INDEX_PREAMBLE, entries: list.data, contrast, composition},
  }
}

/** The whole catalog session context: preamble, screens, index, guides, neighbour tables. */
export function renderCatalog(registry: Registry) {
  const list = runList(registry)
  // The index says what exists; the guard says which one is wrong. Both ship
  // in the same injection so neither waits on a call the agent may skip.
  const contrast = relatedPairs(registry, 'contrast')
  const composition = relatedPairs(registry, 'composition')
  const sections = [
    PREAMBLE,
    renderScreens(registry),
    list.text,
    renderGuideIndex(registry),
    renderPairs(contrast, 'PICKING BETWEEN NEIGHBORS', 'vs'),
    renderPairs(composition, 'COMPOSE — DO NOT HAND-ROLL THE WRAPPER', '+'),
  ].filter(Boolean)
  return {
    text: sections.join('\n\n'),
    data: {preamble: PREAMBLE, entries: list.data, contrast, composition},
  }
}
