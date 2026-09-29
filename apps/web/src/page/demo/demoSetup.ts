import * as schema from '@/schema/demo'
import {createConfig} from 'alinea/core/Config'
import type {ExportedSource} from 'alinea/core/source/SourceExport'
import {DashboardWorker} from 'alinea/dashboard/boot/DashboardWorker'
import {WorkerDB} from 'alinea/dashboard/boot/WorkerDB'
import {DemoConnection} from './DemoConnection'
import {DemoPreview} from './DemoPreview'
import {demoRoles} from './demoRoles'
import {demoWorkspace} from './demoWorkspace'

export const demoConfig = createConfig({
  schema,
  roles: demoRoles,
  enableDrafts: true,
  workspaces: {demo: demoWorkspace},
  preview: DemoPreview
})

/** Boot the in-browser demo backend on the exported Oak & Loom content */
export async function setupDemo(exported: ExportedSource) {
  const client = await DemoConnection.create(demoConfig, exported)
  const worker = new DashboardWorker(client.source)
  const db = new WorkerDB(demoConfig, worker, client, worker)
  await worker.load('demo', demoConfig, client)
  // Index the content up front, the dashboard App syncs on its own but
  // standalone editors (the playground) query the graph directly
  await db.sync()
  return {config: demoConfig, client, db, events: worker}
}
