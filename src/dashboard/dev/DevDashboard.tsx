import {Config} from 'alinea/core'
import {Client} from 'alinea/core/Client'
import {joinPaths} from 'alinea/core/util/Urls'
import {Button, Typo, VStack} from 'alinea/ui'
import {Main} from 'alinea/ui/Main'
import {useEffect, useMemo, useState} from 'react'
import {QueryClient} from 'react-query'
import {App} from '../App.js'
import {Viewport} from '../view/Viewport.js'

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
  const client = useMemo(() => {
    if (!cms) return null
    return new Client(cms, joinPaths(location.origin, location.pathname))
  }, [cms])
  function getConfig() {
    return loadConfig().then(setCms)
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
  if (!cms) return null
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
  return <App queryClient={queryClient} config={cms} client={client!} />
}
