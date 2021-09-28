import {Client} from '@alinea/client'
import {fromModule} from '@alinea/ui'
import {Sidebar} from '@alinea/ui/Sidebar'
import 'preact/debug'
import {createContext, Suspense, useContext, useMemo, useState} from 'react'
import Helmet from 'react-helmet'
import {MdPerson, MdSearch, MdSettings} from 'react-icons/md'
import {QueryClient, QueryClientProvider} from 'react-query'
import {Route} from 'react-router'
import {HashRouter} from 'react-router-dom'
import css from './App.module.scss'
// Todo: bundle this properly
import './css/fonts.css'
import {FrontendConfig} from './FrontendConfig'
import {ContentTree} from './view/ContentTree'
import {EntryEdit} from './view/EntryEdit'
import {Toolbar} from './view/Toolbar'

const styles = fromModule(css)

export type AppProps = {
  config: FrontendConfig
}

const appConfig = createContext<
  {config: FrontendConfig; client: Client} | undefined
>(undefined)

export function useApp() {
  return useContext(appConfig)!
}

const favicon = btoa(`
  <svg
    width="36"
    height="36"
    view-box="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient
        id="grad1"
        x1="0%"
        y1="0%"
        x2="100%"
        y2="0%"
        gradient-transform="rotate(65)"
      >
        <stop offset="0%" style="stop-color: #FFBD67; stop-opacity: 1" />
        <stop
          offset="100%"
          style="stop-color: #FFBD67; stop-opacity: 1"
        />
      </linearGradient>
    </defs>
    <path
      d="M18 36C25.884 36 29.9427 36 32.8047 33.138C35.6667 30.276 36 25.884 36 18C36 10.116 35.6667 6.05733 32.8047 3.19533C29.9427 0.333333 25.884 0 18 0C10.116 0 6.05733 0.333333 3.19533 3.19533C0.333333 6.05733 0 10.116 0 18C0 25.884 0.333333 29.9427 3.19533 32.8047C6.05733 35.6667 10.116 36 18 36Z"
      fill="url(#grad1)"
    ></path>
  </svg>
`)

export function App({config}: AppProps) {
  const [queryClient] = useState(() => new QueryClient())
  const client = useMemo(
    () => new Client(config.schema, config.api),
    [config.schema, config.api]
  )
  return (
    <HashRouter>
      <appConfig.Provider value={{config, client}}>
        <Helmet>
          <meta charSet="utf-8" />
          <title>Stories</title>
          <link
            rel="icon"
            type="image/svg"
            href={`data:image/svg+xml;base64,${favicon}`}
          />
        </Helmet>
        <QueryClientProvider client={queryClient}>
          <div className={styles.root()}>
            <Toolbar />
            <div style={{flex: '1', display: 'flex', minHeight: 0}}>
              <Sidebar.Root>
                <Sidebar.Menu>
                  <Sidebar.Menu.Item>
                    <MdSearch />
                  </Sidebar.Menu.Item>
                  <Sidebar.Menu.Item>
                    <MdSettings />
                  </Sidebar.Menu.Item>
                  <Sidebar.Menu.Item>
                    <MdPerson />
                  </Sidebar.Menu.Item>
                </Sidebar.Menu>
                <Sidebar.List>
                  <ContentTree />
                </Sidebar.List>
              </Sidebar.Root>
              <div style={{width: '100%'}}>
                <Route path="/:slug*">
                  {({match}) => {
                    return (
                      <Suspense fallback={null}>
                        <EntryEdit path={match?.params.slug!} />
                      </Suspense>
                    )
                  }}
                </Route>
              </div>
            </div>
            <div style={{height: '22px', background: 'var(--outline)'}}></div>
          </div>
        </QueryClientProvider>
      </appConfig.Provider>
    </HashRouter>
  )
}
