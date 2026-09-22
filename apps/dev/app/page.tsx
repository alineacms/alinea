import {DemoLinks, DemoPage} from '@/DemoPage'
import type {Metadata} from 'next'

export const metadata: Metadata = {
  title: 'Alinea Next rendering demos'
}

const demos = [
  {
    href: '/demo/static',
    label: 'Static (ISR)',
    description:
      'Rendered at build time from the bundled database, revalidated every 5 minutes.'
  },
  {
    href: '/demo/dynamic',
    label: 'Dynamic (Node)',
    description:
      'Rendered per request from the bundled database after a throttled sync.'
  },
  {
    href: '/demo/edge',
    label: 'Dynamic (Edge)',
    description:
      'Rendered per request in the Edge runtime, queries forwarded to the handler.'
  }
]

const elsewhere = [
  {
    href: '/en/root-page',
    label: 'An entry from the CMS',
    description: 'Rendered by the catch all route at /[...slug].'
  },
  {
    href: '/admin',
    label: 'The dashboard',
    description: 'Edit content and preview it live.'
  }
]

export default function Index() {
  return (
    <DemoPage
      title="Next rendering demos"
      description="Each demo below queries the same CMS through a different Next rendering path, so you can compare where the answer came from and how fresh it is."
      rendering="Static, prerendered at build time"
      runtime="node"
    >
      <DemoLinks title="Rendering demos" links={demos} />
      <DemoLinks title="Elsewhere" links={elsewhere} />
    </DemoPage>
  )
}
