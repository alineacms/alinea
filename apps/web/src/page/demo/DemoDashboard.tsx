'use client'

import * as schema from '@/schema/demo'
import {Config} from 'alinea'
import 'alinea/css'
import {createConfig} from 'alinea/core/Config'
import type {LocalConnection} from 'alinea/core/Connection'
import {localUser} from 'alinea/core/User'
import {
  type ExportedSource,
  importSource
} from 'alinea/core/source/SourceExport'
import {App} from 'alinea/dashboard/App'
import {DashboardWorker} from 'alinea/dashboard/boot/DashboardWorker'
import {WorkerDB} from 'alinea/dashboard/boot/WorkerDB'
import {defaultViews} from 'alinea/dashboard/editor/DefaultViews'
import {useGraph} from 'alinea/dashboard/hook/UseGraph'
import {Suspense, use, useDeferredValue, useMemo} from 'react'
import {DemoHomePage} from './DemoHomePage'
import {DemoRecipePage} from './DemoRecipePage'

const config = createConfig({
  schema,
  workspaces: {
    demo: Config.workspace('Milk & Cookies', {
      color: '#3F61E8',
      mediaDir: 'public',
      source: 'content/demo',
      roots: {
        pages: Config.root('Pages'),
        media: Config.media()
      }
    })
  },
  preview({entry}) {
    switch (entry.type) {
      case 'DemoHome':
        return <PreviewHome entry={entry} />
      case 'DemoRecipe':
        return <PreviewRecipe entry={entry} />
      default:
        return null
    }
  }
})

function PreviewHome({entry}) {
  const graph = useGraph()
  const update = useDeferredValue(entry)
  const props = use(
    useMemo(() => {
      return DemoHomePage.query(graph, update)
    }, [graph, update])
  )
  return <DemoHomePage {...props} />
}

function PreviewRecipe({entry}) {
  const graph = useGraph()
  const update = useDeferredValue(entry)
  const props = use(
    useMemo(() => {
      return DemoRecipePage.query(graph, update)
    }, [graph, update])
  )
  return <DemoRecipePage {...props} />
}

async function setup(exported: ExportedSource) {
  const source = await importSource(exported)
  const worker = new DashboardWorker(source)
  const notImplemented = () => {
    throw new Error('Not implemented')
  }
  const client: LocalConnection = {
    mutate: notImplemented,
    previewToken: notImplemented,
    resolve: notImplemented,
    revisionData: notImplemented,
    prepareUpload: notImplemented,
    write: notImplemented,
    getDraft: notImplemented,
    storeDraft: notImplemented,
    getTreeIfDifferent(sha: string) {
      return source.getTreeIfDifferent(sha)
    },
    getBlobs(shas: Array<string>) {
      return source.getBlobs(shas)
    },
    async revisions() {
      return []
    },
    async user() {
      return localUser
    }
  }
  const db = new WorkerDB(config, worker, client, worker)
  await worker.load('demo', config, client)
  return {config, client, db}
}

interface RenderDashboardProps {
  init: ReturnType<typeof setup>
}

function RenderDashboard({init}: RenderDashboardProps) {
  const {config, client, db} = use(init)
  console.log(db)
  return (
    <App local config={config} db={db} client={client} views={defaultViews} />
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
