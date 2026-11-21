import type {ComponentMeta} from '../component-meta'

export const meta: ComponentMeta = {
  description:
    "Tabbed interface with keyboard navigation. Supports horizontal and vertical orientation. Compound component — Root is required. Tabs.List takes aria-label (or aria-labelledby, the id of a visible title) to name the tab list; the active tab's aria-controls names its panel, and the panel is labelled by its tab. On React Native the indicator follows each tab layout; there is no arrow-key navigation there, each tab is its own screen-reader stop.",
  whenToUse: [
    'Switching between content panels in the same view',
    'Settings pages with multiple sections',
    'Organizing related content without page navigation',
  ],
  whenNotToUse: [
    'Primary site navigation — use SideNav or links',
    'Step-by-step wizard — use a custom stepper',
  ],
  anatomy: {
    required: ['Root', 'List', 'Tab', 'Panel'],
  },
  relatedTo: [
    {
      component: 'SideNav',
      kind: 'contrast',
      relationship: 'Tabs switch content in-place; SideNav navigates between pages',
    },
    {
      component: 'admin-detail-page',
      kind: 'composition',
      relationship: 'Tabs as the facets of one record is the admin-detail-page recipe',
    },
  ],
  example: `<Tabs.Root defaultValue="general">
  <Tabs.List aria-label="Settings">
    <Tabs.Tab value="general">General</Tabs.Tab>
    <Tabs.Tab value="security">Security</Tabs.Tab>
    <Tabs.Tab value="billing" disabled>Billing</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="general">General settings content</Tabs.Panel>
  <Tabs.Panel value="security">Security settings content</Tabs.Panel>
  <Tabs.Panel value="billing">Billing content</Tabs.Panel>
</Tabs.Root>`,
}
