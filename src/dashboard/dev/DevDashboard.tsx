import {Client} from 'alinea/client'
import {Config} from 'alinea/core'
import {joinPaths} from 'alinea/core/util/Urls'
import {Button, Typo, Viewport, VStack} from 'alinea/ui'
import {Main} from 'alinea/ui/Main'
import {useEffect, useMemo, useState} from 'react'
import {QueryClient} from 'react-query'
import {Dashboard} from '../Dashboard'

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
  const client = useMemo(() => {
    if (!config) return null
    return new Client(config, joinPaths(location.origin, location.pathname))
  }, [config])
  function getConfig() {
    return loadConfig()
      .then(config => {
        // Strip any backend or authentication specifics in dev
        if (process.env.NODE_ENV === 'development')
          return new Config({...config.options, backend: undefined})
        return config
      })
      .then(setConfig)
  }
  function refetch() {
    return queryClient.refetchQueries()
  }
  useEffect(() => {
    getConfig()
    return setupDevReload({
      refresh: () => getConfig().then(refetch),
      refetch: refetch,
      open: () => setConnected(true),
      close: () => setConnected(false)
    })
  }, [])
  if (!config) return null
  if (!connected)
    return (
      <Viewport color="#5763E6">
        <Main
          style={{display: 'flex', flexDirection: 'column', height: '100%'}}
        >
          <div style={{margin: 'auto', padding: '20px'}}>
            <VStack gap={20}>
              <Typo.H1 flat>Disconnected</Typo.H1>
              <Typo.P flat>The Alinea server was disconnected</Typo.P>
              <div>
                <Button onClick={() => window.location.reload()}>Reload</Button>
              </div>
            </VStack>
          </div>
        </Main>
      </Viewport>
    )
  return (
    <Dashboard queryClient={queryClient} config={config} client={client!} />
  )
}
