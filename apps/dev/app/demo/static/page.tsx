import {DemoPage} from '@/DemoPage'
import type {Metadata} from 'next'

export const dynamic = 'force-static'
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Static rendering'
}

export default function StaticDemo() {
  return (
    <DemoPage
      title="Static rendering"
      description="This page is rendered at build time from the SQLite database bundled with the deployment, and regenerated in the background at most once every 5 minutes. The render timestamp only changes after a revalidation."
      rendering="force-static with revalidate: 300 (ISR)"
      runtime="node"
    />
  )
}
