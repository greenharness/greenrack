import type {Meta, StoryObj} from '@storybook/react'
import {expect, screen, waitFor} from 'storybook/test'
import type {ReactNode} from 'react'
import {css, html} from 'react-strict-dom'
import {sizes} from '@greenharness/greenrack-tokens/tokens/sizes.css'
import {VisuallyHidden} from './VisuallyHidden'
import {AppShell} from '../AppShell/AppShell'
import {Aside} from '../Aside/Aside'
import {CodeBlock} from '../CodeBlock/CodeBlock'
import {DetailPanel} from '../DetailPanel/DetailPanel'
import {Dialog} from '../Dialog/Dialog'
import {Drawer} from '../Drawer/Drawer'
import {Grid} from '../Grid/Grid'
import {Listbox} from '../Listbox/Listbox'
import {Menu} from '../Menu/Menu'
import {Panel} from '../Panel/Panel'
import {Popover} from '../Popover/Popover'
import {ScrollArea} from '../ScrollArea/ScrollArea'
import {Select} from '../Select/Select'
import {SplitPane} from '../SplitPane/SplitPane'
import {SteppedList} from '../SteppedList/SteppedList'
import {Table} from '../Table/Table'
import {Text} from '../Text/Text'
import {VirtualList} from '../VirtualList/VirtualList'

/**
 * Visually hidden text (`position: absolute`) placed below the fold of an inner scroller
 * is placed against the scroller, or against something inside it: never against an
 * ancestor outside it, where it would lengthen that ancestor's scroll (or, behind an
 * `overflow: hidden`, give a clipped box a scroll a `focus()` can move). Test-only.
 */
const meta: Meta = {
  title: 'Components/VisuallyHidden/In scrollers',
  tags: ['!dev', '!autodocs'],
  parameters: {layout: 'fullscreen'},
}
export default meta

type Story = StoryObj

const styles = css.create({
  // Taller than every scroller here, so what follows starts below its fold.
  belowTheFold: {height: '300vh', flexShrink: 0},
  screen: {height: '100vh'},
  row: {display: 'flex', height: '100vh'},
  bounded: {display: 'flex', height: sizes.listMaxH},
  page: {width: sizes.pageLg},
  // Wider than every sideways scroller here, so what follows starts past its edge.
  // One line: the hidden text follows the wide box instead of wrapping under it.
  oneLine: {whiteSpace: 'nowrap'},
  pastTheEdge: {display: 'inline-block', width: '300vw'},
})

const HIDDEN = 'Read by assistive tech only'

function BelowTheFold() {
  return (
    <>
      <html.div style={styles.belowTheFold} />
      <VisuallyHidden>{HIDDEN}</VisuallyHidden>
    </>
  )
}

const isScroller = (el: Element) => /(auto|scroll)/.test(getComputedStyle(el).overflowY)

/** The nearest scroller that holds the hidden text. */
function scrollerOf(hidden: HTMLElement): HTMLElement {
  let el = hidden.parentElement
  while (el && !isScroller(el)) el = el.parentElement
  if (!el) throw new Error('no scroller holds the hidden text')
  return el
}

/** The positioned box the scroller sits in, or the document's root. */
function outerOf(scroller: HTMLElement): HTMLElement {
  let el = scroller.parentElement
  while (el && el !== document.body && getComputedStyle(el).position === 'static') {
    el = el.parentElement
  }
  return el && el !== document.body ? el : document.documentElement
}

const outerHeight = (outer: HTMLElement) =>
  outer === document.documentElement ? window.innerHeight : outer.clientHeight

const findHidden = () =>
  waitFor(() => {
    const found = [...document.querySelectorAll<HTMLElement>('*')].filter(
      (el) =>
        el.textContent === HIDDEN &&
        el.childElementCount === 0 &&
        getComputedStyle(el).position === 'absolute',
    )
    expect(found).toHaveLength(1)
    return found[0]!
  })

const hiddenStaysInScroller = async () => {
  const hidden = await findHidden()
  const scroller = scrollerOf(hidden)
  const outer = outerOf(scroller)
  // There is a fold, and the hidden text is below it.
  await waitFor(() => expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight))
  await expect(scroller.contains(hidden.offsetParent)).toBe(true)
  // The box around the scroller has nothing to scroll.
  await expect(outer.scrollHeight).toBe(outerHeight(outer))
}

function PastTheEdge() {
  return (
    <html.span style={styles.oneLine}>
      <html.span style={styles.pastTheEdge} />
      <VisuallyHidden>{HIDDEN}</VisuallyHidden>
    </html.span>
  )
}

const isSidewaysScroller = (el: Element) => /(auto|scroll)/.test(getComputedStyle(el).overflowX)

/** The nearest sideways scroller that holds the hidden text. */
function sidewaysScrollerOf(hidden: HTMLElement): HTMLElement {
  let el = hidden.parentElement
  while (el && !isSidewaysScroller(el)) el = el.parentElement
  if (!el) throw new Error('no sideways scroller holds the hidden text')
  return el
}

const outerWidth = (outer: HTMLElement) =>
  outer === document.documentElement ? document.documentElement.clientWidth : outer.clientWidth

/** The sideways twin of hiddenStaysInScroller: past the edge, not below the fold. */
const hiddenStaysInSidewaysScroller = async () => {
  const hidden = await findHidden()
  const scroller = sidewaysScrollerOf(hidden)
  const outer = outerOf(scroller)
  await waitFor(() => expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth))
  await expect(scroller.contains(hidden.offsetParent)).toBe(true)
  await expect(outer.scrollWidth).toBe(outerWidth(outer))
}

/** Runs a check at a desktop viewport, where the AppShell rail and the Table's columns show. */
const atDesktop = (check: () => Promise<void>) => async () => {
  const {page} = await import('vitest/browser')
  const before = {width: window.innerWidth, height: window.innerHeight}
  await page.viewport(1440, 900)
  try {
    await waitFor(() => expect(window.innerWidth).toBe(1440))
    await check()
  } finally {
    await page.viewport(before.width, before.height)
  }
}

/** ScrollArea.Viewport: placed against the Root, which clips but still scrolls. */
export const ScrollAreaViewportHolds: Story = {
  render: () => (
    <ScrollArea.Root>
      <ScrollArea.Viewport maxHeight="listMaxH">
        <ScrollArea.Content>
          <BelowTheFold />
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="vertical">
        <ScrollArea.Thumb orientation="vertical" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  ),
  play: hiddenStaysInScroller,
}

function Split({children}: {children: ReactNode}) {
  return (
    <html.div style={styles.screen}>
      <SplitPane.Root
        aria-label="Resize the list"
        defaultSize="sidebarW"
        minSize="sidebarW"
        maxSize="panelLg"
      >
        {children}
      </SplitPane.Root>
    </html.div>
  )
}

/** The first SplitPane.Pane, sized by the handle. */
export const SplitPanePrimaryHolds: Story = {
  render: () => (
    <Split>
      <SplitPane.Pane>
        <BelowTheFold />
      </SplitPane.Pane>
      <SplitPane.Handle />
      <SplitPane.Pane>
        <Text>Detail</Text>
      </SplitPane.Pane>
    </Split>
  ),
  play: hiddenStaysInScroller,
}

/** The second SplitPane.Pane, which takes the rest. */
export const SplitPaneSecondaryHolds: Story = {
  render: () => (
    <Split>
      <SplitPane.Pane>
        <Text>List</Text>
      </SplitPane.Pane>
      <SplitPane.Handle />
      <SplitPane.Pane>
        <BelowTheFold />
      </SplitPane.Pane>
    </Split>
  ),
  play: hiddenStaysInScroller,
}

/** VirtualList: positioned already; its rows are too, so the text sits against a row. */
export const VirtualListHolds: Story = {
  render: () => (
    <VirtualList
      aria-label="Rows"
      items={[0, 1]}
      getKey={(i) => i}
      estimateSize="controlLg"
      maxHeight="listMaxH"
      renderItem={(i) => (i === 1 ? <BelowTheFold /> : <Text>First row</Text>)}
    />
  ),
  play: hiddenStaysInScroller,
}

/** Dialog.Body: placed against the popup, which clips. */
export const DialogBodyHolds: Story = {
  render: () => (
    <Dialog.Root defaultOpen>
      <Dialog.Portal>
        <Dialog.Header>
          <Dialog.Title>Long dialog</Dialog.Title>
          <Dialog.Close />
        </Dialog.Header>
        <Dialog.Body>
          <BelowTheFold />
        </Dialog.Body>
      </Dialog.Portal>
    </Dialog.Root>
  ),
  play: hiddenStaysInScroller,
}

/** Drawer.Body: placed against the panel, which clips. */
export const DrawerBodyHolds: Story = {
  render: () => (
    <Drawer.Root defaultOpen>
      <Drawer.Portal>
        <Drawer.Header>
          <Drawer.Title>Long drawer</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body>
          <BelowTheFold />
        </Drawer.Body>
      </Drawer.Portal>
    </Drawer.Root>
  ),
  play: hiddenStaysInScroller,
}

/** Panel.Body in a bounded Panel: Panel.Root is not positioned either. */
export const PanelBodyHolds: Story = {
  render: () => (
    <html.div style={styles.bounded}>
      <Panel.Root>
        <Panel.Header>
          <Text>Long panel</Text>
        </Panel.Header>
        <Panel.Body>
          <BelowTheFold />
        </Panel.Body>
      </Panel.Root>
    </html.div>
  ),
  play: hiddenStaysInScroller,
}

/** DetailPanel.Body: placed against the panel's content box. */
export const DetailPanelBodyHolds: Story = {
  render: () => (
    <html.div style={styles.row}>
      <DetailPanel.Root defaultOpen>
        <DetailPanel.Content label="Long panel">
          <DetailPanel.Header>
            <DetailPanel.Title>Long panel</DetailPanel.Title>
            <DetailPanel.Close />
          </DetailPanel.Header>
          <DetailPanel.Body>
            <BelowTheFold />
          </DetailPanel.Body>
        </DetailPanel.Content>
      </DetailPanel.Root>
    </html.div>
  ),
  play: hiddenStaysInScroller,
}

/** Aside: sticky, so positioned already. */
export const AsideHolds: Story = {
  render: () => (
    <html.div style={styles.page}>
      <Grid layout="content-aside" gap="xl">
        <Text>Reading column</Text>
        <Aside aria-label="Outline">
          <BelowTheFold />
        </Aside>
      </Grid>
    </html.div>
  ),
  play: hiddenStaysInScroller,
}

/** AppShell's rail body: placed against the rail, which is sticky and as tall as the viewport. */
export const AppShellRailBodyHolds: Story = {
  render: () => (
    <AppShell.Root
      brand={<Text>Brand</Text>}
      menuLabel="Menu"
      closeLabel="Close navigation"
      skipLabel="Skip to content"
    >
      <AppShell.Rail aria-label="Main">
        <BelowTheFold />
      </AppShell.Rail>
      <AppShell.Main>
        <Text>Page</Text>
      </AppShell.Main>
    </AppShell.Root>
  ),
  play: atDesktop(hiddenStaysInScroller),
}

/** SteppedList's rows: capped at maxHeight, then scrolling. */
export const SteppedListRowsHold: Story = {
  render: () => (
    <SteppedList.Root defaultStep="root" backLabel="Back">
      <SteppedList.Step id="root" title="Long step">
        <BelowTheFold />
      </SteppedList.Step>
    </SteppedList.Root>
  ),
  play: hiddenStaysInScroller,
}

/** Popover.Popup with a maxHeight: the fixed popup is the scroller, positioned already. */
export const PopoverPopupHolds: Story = {
  render: () => (
    <Popover.Root defaultOpen>
      <Popover.Trigger>Open</Popover.Trigger>
      <Popover.Popup label="Long popover" maxHeight="listMaxH">
        <BelowTheFold />
      </Popover.Popup>
    </Popover.Root>
  ),
  play: hiddenStaysInScroller,
}

/** Menu.Popup: the fixed popup is the scroller, positioned already. */
export const MenuPopupHolds: Story = {
  render: () => (
    <Menu.Root defaultOpen>
      <Menu.Trigger>Actions</Menu.Trigger>
      <Menu.Popup>
        <Menu.Item>First</Menu.Item>
        <BelowTheFold />
      </Menu.Popup>
    </Menu.Root>
  ),
  play: hiddenStaysInScroller,
}

/** Select.Popup: the fixed popup is the scroller, positioned already. */
export const SelectPopupHolds: Story = {
  render: () => (
    <Select.Root defaultValue="en">
      <Select.Trigger aria-label="Language">
        <Select.Value />
        <Select.Icon />
      </Select.Trigger>
      <Select.Popup>
        <Select.Item value="en">
          <Select.ItemText>English</Select.ItemText>
        </Select.Item>
        <BelowTheFold />
      </Select.Popup>
    </Select.Root>
  ),
  play: async ({canvas, userEvent}) => {
    await userEvent.click(canvas.getByRole('combobox'))
    await waitFor(() => expect(screen.getByRole('option')).toBeVisible())
    await hiddenStaysInScroller()
  },
}

/** Listbox.Root: the fixed list is the scroller, positioned already. */
export const ListboxHolds: Story = {
  render: () => (
    <Listbox.Root
      id="long-list"
      open
      anchor={() => new DOMRect(16, 16, 200, 24)}
      highlightedId={null}
      aria-label="Results"
    >
      <Listbox.Option value="first">First</Listbox.Option>
      <BelowTheFold />
    </Listbox.Root>
  ),
  play: hiddenStaysInScroller,
}

/** The Table's scroller: hidden text in the last column of a table wider than the page. */
export const TableScrollerHolds: Story = {
  render: () => (
    <Table.Root minColumnWidth="pageLg">
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Service</Table.HeaderCell>
          <Table.HeaderCell>Status</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        <Table.Row>
          <Table.Cell>api</Table.Cell>
          <Table.Cell>
            <PastTheEdge />
          </Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table.Root>
  ),
  play: atDesktop(hiddenStaysInSidewaysScroller),
}

/** CodeBlock's pre: hidden text at the end of a line longer than the block. */
export const CodeBlockPreHolds: Story = {
  render: () => (
    <CodeBlock copyLabel="Copy" copiedLabel="Copied">
      <PastTheEdge />
    </CodeBlock>
  ),
  play: hiddenStaysInSidewaysScroller,
}
