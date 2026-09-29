'use client'

import 'alinea/css'
import {Query} from 'alinea'
import type {Graph} from 'alinea/core/Graph'
import type {ExportedSource} from 'alinea/core/source/SourceExport'
import {App} from 'alinea/dashboard/App'
import {views as defaultViews} from 'alinea/field/views'
import {Suspense, use, useMemo, useSyncExternalStore} from 'react'
import {DemoAuthorArticles} from '@/schema/demo/DemoAuthorArticles'
import {DemoStockOverview} from '@/schema/demo/DemoStockOverview'
import {demoBaseUrl} from '@/schema/demo/DemoUrl'
import {demoUser} from './DemoConnection'
import {DemoReset} from './DemoReset'
import {hasDemoPage} from './demoPages'
import {setupDemo} from './demoSetup'

// The demo schema references its custom views by key, so the site's pages
// don't bundle them along with the schema
const views = {
  ...defaultViews,
  '@/schema/demo/DemoAuthorArticles#DemoAuthorArticles': DemoAuthorArticles,
  '@/schema/demo/DemoStockOverview#DemoStockOverview': DemoStockOverview
}

interface RenderDashboardProps {
  init: ReturnType<typeof setupDemo>
}

/**
 * `/demo?screenshot` hides demo-only chrome, such as the reset pill, so
 * captures only show the dashboard itself
 */
function isScreenshot() {
  return new URLSearchParams(window.location.search).has('screenshot')
}

// Dashboard routes of site pages, eg. `#/entry/demo/pages:nl/<id>?view=edit`
const pageRoute = /^#\/entry\/demo\/pages(?::([^/?]+))?\/([^/?]+)/

/**
 * The demo site url of the page being edited, or the site home. The site shows
 * the published content, so a page that was only created in this session has
 * no url yet.
 */
function siteUrlStore(graph: Graph) {
  let url = demoBaseUrl
  let current = 0
  return {
    get: () => url,
    subscribe(onChange: () => void) {
      function update(next: string) {
        if (next === url) return
        url = next
        onChange()
      }
      function resolve() {
        const request = ++current
        const match = pageRoute.exec(window.location.hash)
        if (!match) return update(demoBaseUrl)
        const [, locale, id] = match
        graph
          .first({
            workspace: 'demo',
            root: 'pages',
            id,
            ...(locale ? {locale} : {}),
            select: {type: Query.type, url: Query.url}
          })
          .then(
            page => {
              if (request !== current) return
              const hasPage =
                page &&
                hasDemoPage(page.type) &&
                page.url.startsWith(demoBaseUrl)
              update(hasPage ? page.url : demoBaseUrl)
            },
            () => {
              if (request === current) update(demoBaseUrl)
            }
          )
      }
      resolve()
      // The dashboard navigates with pushState, which only the Navigation API
      // reports; fall back to history traversals where it is missing
      const target: EventTarget =
        typeof navigation === 'undefined' ? window : navigation
      const events =
        target === window ? ['hashchange', 'popstate'] : ['currententrychange']
      for (const event of events) target.addEventListener(event, resolve)
      return () => {
        current++
        for (const event of events) target.removeEventListener(event, resolve)
      }
    }
  }
}

function RenderDashboard({init}: RenderDashboardProps) {
  const {config, client, db, events} = use(init)
  const screenshot = useMemo(isScreenshot, [])
  const siteUrls = useMemo(() => siteUrlStore(db), [db])
  const siteUrl = useSyncExternalStore(siteUrls.subscribe, siteUrls.get)
  async function reset() {
    await client.reset()
    // Reload without the hash, entries created in this session are gone
    window.location.replace(window.location.pathname + window.location.search)
  }
  return (
    <>
      <App
        local
        config={config}
        graph={db}
        events={events}
        client={client}
        views={views}
        user={demoUser}
      />
      {!screenshot && <DemoReset siteUrl={siteUrl} onReset={reset} />}
    </>
  )
}

export interface DemoProps {
  exported: ExportedSource
}

export default function DemoDashboard({exported}: DemoProps) {
  const init = useMemo(() => setupDemo(exported), [exported])
  return (
    <Suspense>
      <RenderDashboard init={init} />
    </Suspense>
  )
}
