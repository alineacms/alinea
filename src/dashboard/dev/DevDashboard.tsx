import type {CMS} from 'alinea/core/CMS'
import {Client} from 'alinea/core/Client'
import {WorkerDB} from 'alinea/core/worker/WorkerDB'
import {type ComponentType, useEffect, useState} from 'react'
import {QueryClient} from 'react-query'
import type {DashboardWorker} from '../../core/worker/LoadWorker.js'
import {App, type AppProps} from '../App.js'

type DevReloadOptions = {
  refresh: (revision: string) => Promise<unknown>
  refetch: () => Promise<unknown>
  open: () => void
  close: () => void
}

function setupDevReload({refresh, refetch, open, close}: DevReloadOptions) {
  const source = new EventSource('/~dev')
  source.onmessage = e => {
    console.info(`[reload] received ${e.data}`)
    const info = JSON.parse(e.data)
    switch (info.type) {
      case 'refetch':
        return refetch()
      case 'reload':
        return window.location.reload()
      default:
        return refresh(info.revision)
    }
  }
  source.onopen = open
  source.onerror = close
  return () => {
    source.close()
  }
}

export interface DevDashboardOptions {
  loadConfig(
    revision: string
  ): Promise<{cms: CMS; views: Record<string, ComponentType>}>
  dbWorker: DashboardWorker
  index: EventTarget
}

const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})
const initialRevision = process.env.ALINEA_BUILD_ID as string

export function DevDashboard({
  loadConfig,
  dbWorker,
  index
}: DevDashboardOptions) {
  const [app, setApp] = useState<AppProps>()
  const [connected, setConnected] = useState(false)
  async function getConfig(revision = initialRevision) {
    // Reload css
    const link = document.querySelector(
      'link[href^="/config.css"]'
    ) as HTMLLinkElement
    const copy = link.cloneNode() as HTMLLinkElement
    copy.href = `/config.css?${revision}`
    copy.onload = () => link.remove()
    link.after(copy)
    const config = await loadConfig(revision)
    const handlerUrl = new URL('/api', location.href).href
    const client = new Client({
      config: config.cms,
      url: handlerUrl
    })
    await dbWorker.load(handlerUrl, revision)
    return setApp({
      db: new WorkerDB(config.cms.config, dbWorker, client, index),
      config: config.cms.config,
      views: config.views,
      client
    })
  }
  useEffect(() => {
    getConfig()
    return setupDevReload({
      refresh: getConfig,
      refetch: () => dbWorker.sync(),
      open: () => setConnected(true),
      close: () => setConnected(false)
    })
  }, [])
  if (!app) return null
  return (
    <App
      queryClient={queryClient}
      dev={process.env.NODE_ENV === 'development'}
      {...app}
    />
  )
}
