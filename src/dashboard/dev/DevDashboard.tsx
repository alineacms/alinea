import {Config} from 'alinea/core'
import {Client} from 'alinea/core/Client'
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
  const [cms, setCms] = useState<Config>()
  const [connected, setConnected] = useState(true)
  const forceDbUpdate = useSetAtom(dbUpdateAtom)
  const client = useMemo(() => {
    if (!cms) return null
    return new Client({
      config: cms,
      url: joinPaths(location.origin, location.pathname)
    })
  }, [cms])
  function getConfig() {
    return loadConfig().then(setCms)
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
  if (!cms) return null
  return (
    <App
      queryClient={queryClient}
      config={cms}
      client={client!}
      dev={!process.env.ALINEA_CLOUD_URL}
    />
  )
}
