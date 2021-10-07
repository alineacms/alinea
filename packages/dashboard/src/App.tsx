import {Client} from '@alinea/client'
import {Session} from '@alinea/core'
import {FavIcon, Statusbar, Viewport} from '@alinea/ui'
import {Sidebar} from '@alinea/ui/Sidebar'
import {getRandomColor} from '@alinea/ui/util/GetRandomColor'
//import 'preact/debug'
import {Fragment, Suspense, useState} from 'react'
import {Helmet} from 'react-helmet'
import {
  MdInsertDriveFile,
  MdPublishedWithChanges,
  MdSearch,
  MdWarning
} from 'react-icons/md/index'
import {QueryClient, QueryClientProvider} from 'react-query'
import {Route} from 'react-router'
import {HashRouter} from 'react-router-dom'
// Todo: bundle this properly
// import './css/fonts.css'
import {DashboardOptions} from './Dashboard'
import {DashboardProvider, useDashboard} from './hook/UseDashboard'
import {SessionProvider} from './hook/UseSession'
import {ContentTree} from './view/ContentTree'
import {EntryEdit} from './view/EntryEdit'
import {Toolbar} from './view/Toolbar'

function AppAuthenticated() {
  const {name, color, auth} = useDashboard()
  return (
    <Statusbar.Provider>
      <Helmet>
        <title>{name}</title>
      </Helmet>
      <Toolbar />
      <div style={{flex: '1', display: 'flex', minHeight: 0}}>
        <Sidebar.Root>
          <Sidebar.Menu>
            <Sidebar.Menu.Item selected>
              <MdInsertDriveFile />
            </Sidebar.Menu.Item>
            <Sidebar.Menu.Item>
              <MdSearch />
            </Sidebar.Menu.Item>
            <Sidebar.Menu.Item>
              <MdPublishedWithChanges />
            </Sidebar.Menu.Item>
          </Sidebar.Menu>
          <Sidebar.List>
            <ContentTree />
          </Sidebar.List>
        </Sidebar.Root>
        <div style={{width: '100%'}}>
          <Route path="/:id">
            {({match}) => {
              const id = match?.params.id
              if (!id) return null
              return (
                <Suspense fallback={null}>
                  <EntryEdit id={id} />
                </Suspense>
              )
            }}
          </Route>
        </div>
      </div>
      <Statusbar.Root>
        {!auth && (
          <Statusbar.Status icon={MdWarning}>
            Using no authentication
          </Statusbar.Status>
        )}
      </Statusbar.Root>
    </Statusbar.Provider>
  )
}

type AppRootProps = {
  session: Session | undefined
  setSession: (session: Session | undefined) => void
}

function AppRoot({session, setSession}: AppRootProps) {
  const {color, name, auth: Auth = Fragment} = useDashboard()
  const inner = session ? (
    <AppAuthenticated />
  ) : (
    <Auth setSession={setSession} />
  )
  return (
    <Viewport color={color}>
      <FavIcon color={color} />
      {inner}
    </Viewport>
  )
}

function localSession(options: DashboardOptions) {
  return {
    user: {sub: 'anonymous'},
    hub: new Client(options.schema, options.apiUrl)
  }
}

export function App(props: DashboardOptions) {
  const [queryClient] = useState(() => new QueryClient())
  const [session, setSession] = useState<Session | undefined>(
    !props.auth ? localSession(props) : undefined
  )
  return (
    <DashboardProvider
      value={{...props, color: props.color || getRandomColor(props.name)}}
    >
      <HashRouter hashType="noslash">
        <SessionProvider value={session}>
          <QueryClientProvider client={queryClient}>
            <AppRoot session={session} setSession={setSession} />
          </QueryClientProvider>
        </SessionProvider>
      </HashRouter>
    </DashboardProvider>
  )
}
