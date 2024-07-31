import {Client} from 'alinea/core/Client'
import {Config} from 'alinea/core/Config'
import {joinPaths} from 'alinea/core/util/Urls'
import {useSetAtom} from 'jotai'
import {useEffect, useMemo, useState} from 'react'
import {QueryClient} from 'react-query'
import {App} from '../App.js'
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
    console.log(`[reload] received ${e.data}`)
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
  loadConfig: () => Promise<Config>
}

const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})

export function DevDashboard({loadConfig}: DevDashboardOptions) {
  const [config, setConfig] = useState<Config>()
  const [connected, setConnected] = useState(true)
  const forceDbUpdate = useSetAtom(dbUpdateAtom)
  const client = useMemo(() => {
    if (!config) return null
    return new Client({
      url: joinPaths(location.origin, location.pathname)
    })
  }, [config])
  function getConfig() {
    // Reload css
    const link = document.querySelector(
      'link[href^="/entry.css"]'
    ) as HTMLLinkElement
    const copy = link.cloneNode() as HTMLLinkElement
    copy.href = '/entry.css?' + Math.random()
    copy.onload = () => link.remove()
    link.after(copy)
    return loadConfig().then(setConfig)
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
  if (!config) return null
  return (
    <App
      queryClient={queryClient}
      config={config}
      client={client!}
      dev={process.env.NODE_ENV === 'development'}
    />
  )
}
