import {Auth} from '@alinea/core/Auth'
import {FavIcon, Viewport} from '@alinea/ui'
import {Sidebar} from '@alinea/ui/Sidebar'
//import 'preact/debug'
import {Suspense, useState} from 'react'
import {Helmet} from 'react-helmet'
import {MdPerson, MdSearch, MdSettings} from 'react-icons/md'
import {QueryClient, QueryClientProvider} from 'react-query'
import {Route} from 'react-router'
import {HashRouter} from 'react-router-dom'
// Todo: bundle this properly
import './css/fonts.css'
import {AppProvider} from './hook/UseDashboard'
import {SessionProvider} from './hook/UseSession'
import {ContentTree} from './view/ContentTree'
import {EntryEdit} from './view/EntryEdit'
import {Toolbar} from './view/Toolbar'

export function AppRoot() {
  return (
    <Viewport>
      <FavIcon color="#FFBD67" />
      <Helmet>
        <title>Stories</title>
      </Helmet>
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
    </Viewport>
  )
}

export type AppProps = {
  apiUrl: string
  color: string
  useAuth: Auth.Hook
}

export function App(props: AppProps) {
  const {session, view: Auth} = props.useAuth()
  const [queryClient] = useState(() => new QueryClient())
  const inner = session ? <AppRoot /> : <Auth setSession={console.log} />
  return (
    <AppProvider value={props}>
      <HashRouter>
        <SessionProvider value={session}>
          <QueryClientProvider client={queryClient}>
            {inner}
          </QueryClientProvider>
        </SessionProvider>
      </HashRouter>
    </AppProvider>
  )
}
