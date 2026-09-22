import {DemoPage} from '@/DemoPage'
import type {Metadata} from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Dynamic rendering'
}

export default function DynamicDemo() {
  return (
    <DemoPage
      title="Dynamic rendering"
      description="This page is rendered per request in the Node runtime. Queries are answered from the bundled database, which is brought up to date with the handler through a throttled sync."
      rendering="force-dynamic, rendered per request"
      runtime="node"
    />
  )
}
