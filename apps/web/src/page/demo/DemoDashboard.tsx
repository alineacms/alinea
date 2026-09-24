'use client'

import 'alinea/css'
import type {ExportedSource} from 'alinea/core/source/SourceExport'
import {App} from 'alinea/dashboard/App'
import {views as defaultViews} from 'alinea/field/views'
import {Suspense, use, useMemo} from 'react'
import {demoUser} from './DemoConnection'
import {DemoReset} from './DemoReset'
import {setupDemo} from './demoSetup'

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

function RenderDashboard({init}: RenderDashboardProps) {
  const {config, client, db, events} = use(init)
  const screenshot = useMemo(isScreenshot, [])
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
        views={defaultViews}
        user={demoUser}
      />
      {!screenshot && <DemoReset onReset={reset} />}
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
