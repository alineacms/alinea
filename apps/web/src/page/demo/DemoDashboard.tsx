'use client'

import * as schema from '@/schema/demo'
import 'alinea/css'
import {createConfig} from 'alinea/core/Config'
import type {ExportedSource} from 'alinea/core/source/SourceExport'
import {App} from 'alinea/dashboard/App'
import {DashboardWorker} from 'alinea/dashboard/boot/DashboardWorker'
import {WorkerDB} from 'alinea/dashboard/boot/WorkerDB'
import {views as defaultViews} from 'alinea/field/views'
import {Suspense, use, useMemo} from 'react'
import {DemoConnection, demoUser} from './DemoConnection'
import {DemoPreview} from './DemoPreview'
import {DemoReset} from './DemoReset'
import {demoRoles} from './demoRoles'
import {demoWorkspace} from './demoWorkspace'

const config = createConfig({
  schema,
  roles: demoRoles,
  enableDrafts: true,
  workspaces: {demo: demoWorkspace},
  preview: DemoPreview
})

async function setup(exported: ExportedSource) {
  const client = await DemoConnection.create(config, exported)
  const worker = new DashboardWorker(client.source)
  const db = new WorkerDB(config, worker, client, worker)
  await worker.load('demo', config, client)
  return {config, client, db, events: worker}
}

interface RenderDashboardProps {
  init: ReturnType<typeof setup>
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
  const init = useMemo(() => setup(exported), [exported])
  return (
    <Suspense>
      <RenderDashboard init={init} />
    </Suspense>
  )
}
