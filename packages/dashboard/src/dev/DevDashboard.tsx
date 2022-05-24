import {Client} from '@alinea/client'
import type {Config} from '@alinea/core'
import {useEffect, useMemo, useState} from 'react'
import {QueryClient} from 'react-query'
import {Dashboard} from '../Dashboard'

type DevReloadOptions = {
  refresh: () => Promise<void>
  refetch: () => void
}

function setupDevReload({refresh, refetch}: DevReloadOptions) {
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
  const client = useMemo(() => {
    if (!config) return null
    return new Client(config, location.origin + location.pathname)
  }, [config])
  function getConfig() {
    return loadConfig().then(setConfig)
  }
  function refetch() {
    return queryClient.refetchQueries()
  }
  useEffect(() => {
    getConfig()
    return setupDevReload({
      refresh: () => getConfig().then(refetch),
      refetch: refetch
    })
  }, [])
  if (!config) return null
  return (
    <Dashboard queryClient={queryClient} config={config} client={client!} />
  )
}
