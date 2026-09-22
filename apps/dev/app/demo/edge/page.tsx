import {DemoPage} from '@/DemoPage'
import type {Metadata} from 'next'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Edge rendering'
}

export default function EdgeDemo() {
  return (
    <DemoPage
      title="Edge rendering"
      description="This page is rendered per request in the Edge runtime. There is no bundled database here, so every query is forwarded to the handler over HTTP."
      rendering="force-dynamic, rendered per request"
      runtime="edge"
    />
  )
}
