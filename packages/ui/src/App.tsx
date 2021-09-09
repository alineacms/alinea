import {css, globalCss} from '@stitches/react'
import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useState
} from 'react'
import {FrontendConfig} from './FrontendConfig'
import {Sidebar} from './page/Sidebar'
import {Toolbar} from './page/Toolbar'
import {QueryClient, QueryClientProvider, useQuery} from 'react-query'

export type AppProps = {
  config: FrontendConfig
}

const globalStyles = globalCss({
  '*': {boxSizing: 'border-box'},
  html: {height: '100%'},
  body: {height: '100%', margin: 0, background: '#14151a'}
})

const styles = {
  root: css({
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'sans-serif',
    height: '100%',
    color: 'white',
    fontSize: '14px'
  })
}

const appConfig = createContext<FrontendConfig | undefined>(undefined)

export function useConfig() {
  return useContext(appConfig)!
}

export function App({config}: AppProps) {
  const [queryClient] = useState(() => new QueryClient())
  useLayoutEffect(() => {
    globalStyles()
  }, [])
  return (
    <appConfig.Provider value={config}>
      <QueryClientProvider client={queryClient}>
        <div className={styles.root()}>
          <Toolbar />
          <div style={{flex: '1', display: 'flex'}}>
            <Sidebar />
            <div style={{padding: '10px', width: '100%'}}>
              <div style={{padding: '10px'}}>Field:</div>
              <textarea
                style={{
                  width: '100%',
                  height: '300px',
                  fontFamily: 'monospace',
                  background: '#191A1F',
                  color: 'white',
                  padding: '10px',
                  lineHeight: 1.5
                }}
                placeholder="Fill some data"
              />
            </div>
          </div>
        </div>
      </QueryClientProvider>
    </appConfig.Provider>
  )
}
