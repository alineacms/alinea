'use client'

import {Query} from 'alinea'
import type {Entry} from 'alinea/core/Entry'
import {useGraph} from 'alinea/dashboard/hook/UseGraph'
import {
  type MouseEvent,
  type ReactNode,
  use,
  useDeferredValue,
  useMemo
} from 'react'
import {demoBaseUrl} from '@/schema/demo/DemoUrl'
import {hasDemoPage, renderDemoPage} from './demoPages'

interface PreviewLinksProps {
  children: ReactNode
}

// The preview renders inline instead of in an iframe, so links to other demo
// pages would leave the dashboard. Open the linked entry in the dashboard.
function PreviewLinks({children}: PreviewLinksProps) {
  const graph = useGraph()
  function onClickCapture(event: MouseEvent) {
    if (!(event.target instanceof Element)) return
    const anchor = event.target.closest('a')
    if (!anchor) return
    const href = anchor.getAttribute('href')
    if (!href?.startsWith(demoBaseUrl)) {
      // Keep other links (mailto, tel, external) inert inside the preview
      if (!href?.startsWith('#')) event.preventDefault()
      return
    }
    event.preventDefault()
    graph
      .first({
        workspace: 'demo',
        root: 'pages',
        url: href,
        select: {id: Query.id, root: Query.root, locale: Query.locale}
      })
      .then(linked => {
        if (!linked) return
        const root = linked.locale
          ? `${linked.root}:${linked.locale}`
          : linked.root
        window.location.hash = `#/entry/demo/${root}/${linked.id}?view=edit`
      })
  }
  return <div onClickCapture={onClickCapture}>{children}</div>
}

interface DemoPagePreviewProps {
  entry: Entry
}

function DemoPagePreview({entry}: DemoPagePreviewProps) {
  const graph = useGraph()
  const update = useDeferredValue(entry)
  const page = use(
    useMemo(
      () =>
        renderDemoPage(graph, {
          id: update.id,
          type: update.type,
          locale: update.locale,
          preview: update
        }),
      [graph, update]
    )
  )
  return <PreviewLinks>{page}</PreviewLinks>
}

export interface DemoPreviewProps {
  entry: Entry
}

/** Renders the demo site page of an entry inline in the dashboard */
export function DemoPreview({entry}: DemoPreviewProps) {
  if (!hasDemoPage(entry.type)) return null
  return <DemoPagePreview entry={entry} />
}
