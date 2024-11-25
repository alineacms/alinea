import {Client} from 'alinea/core/Client'
import {CMS} from 'alinea/core/CMS'
import {useSetAtom} from 'jotai'
import {ComponentType, useEffect, useState} from 'react'
import {QueryClient} from 'react-query'
import {App, AppProps} from '../App.js'
import {dbUpdateAtom} from '../atoms/DbAtoms.js'

type DevReloadOptions = {
  refresh: () => Promise<void>
  refetch: () => void
  open: () => void
  close: () => void
}

function setupDevReload({refresh, refetch, open, close}: DevReloadOptions) {
  const source = new EventSource('/~dev')
  source.onmessage = e => {
    console.info(`[reload] received ${e.data}`)
    switch (e.data) {
      case 'refetch':
        return refetch()
      case 'reload':
        return window.location.reload()
      default:
        return refresh()
    }
  }
  source.onopen = open
  source.onerror = close
  return () => {
    source.close()
  }
}

export type DevDashboardOptions = {
  loadConfig: () => Promise<{cms: CMS; views: Record<string, ComponentType>}>
}

const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})

export function DevDashboard({loadConfig}: DevDashboardOptions) {
  const [app, setApp] = useState<AppProps>()
  const [connected, setConnected] = useState(true)
  const forceDbUpdate = useSetAtom(dbUpdateAtom)
  async function getConfig() {
    // Reload css
    const link = document.querySelector(
      'link[href^="/config.css"]'
    ) as HTMLLinkElement
    const copy = link.cloneNode() as HTMLLinkElement
    copy.href = '/config.css?' + Math.random()
    copy.onload = () => link.remove()
    link.after(copy)
    const config = await loadConfig()
    const client = new Client({
      config: config.cms,
      url: new URL('/api', location.href).href
    })
    return setApp({config: config.cms.config, views: config.views, client})
  }
  useEffect(() => {
    getConfig()
    return setupDevReload({
      refresh: () => getConfig().then(() => forceDbUpdate(true)),
      refetch: () => forceDbUpdate(true),
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
