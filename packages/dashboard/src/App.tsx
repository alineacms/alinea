import {Client} from '@alinea/client'
import {Session} from '@alinea/core'
import {CurrentDraftProvider} from '@alinea/editor'
import {
  AppBar,
  FavIcon,
  Loader,
  Pane,
  px,
  Statusbar,
  Typo,
  useObservable,
  Viewport
} from '@alinea/ui'
import {Sidebar} from '@alinea/ui/Sidebar'
import {getRandomColor} from '@alinea/ui/util/GetRandomColor'
//import 'preact/debug'
import {Fragment, Suspense, useState} from 'react'
import {Helmet} from 'react-helmet'
import {
  MdCheck,
  MdEdit,
  MdInsertDriveFile,
  MdRotateLeft,
  MdSearch,
  MdWarning
} from 'react-icons/md'
import {QueryClient, QueryClientProvider} from 'react-query'
import {Route} from 'react-router'
import {HashRouter} from 'react-router-dom'
import {DashboardOptions} from './Dashboard'
import {DashboardProvider, useDashboard} from './hook/UseDashboard'
import {useDraft} from './hook/UseDraft'
import {DraftsProvider, DraftsStatus, useDrafts} from './hook/UseDrafts'
import {SessionProvider} from './hook/UseSession'
import {ContentTree} from './view/ContentTree'
import {EntryEdit, NewEntry} from './view/EntryEdit'
import {Toolbar} from './view/Toolbar'

function AppAuthenticated() {
  const {name, color, auth} = useDashboard()
  return (
    <DraftsProvider>
      <Statusbar.Provider>
        <Helmet>
          <title>{name}</title>
        </Helmet>
        <Toolbar />
        <div
          style={{
            flex: '1',
            display: 'flex',
            minHeight: 0,
            position: 'relative'
          }}
        >
          <Sidebar.Root>
            <Sidebar.Menu>
              <Sidebar.Menu.Item selected>
                <MdInsertDriveFile />
              </Sidebar.Menu.Item>
              <Sidebar.Menu.Item>
                <MdSearch />
              </Sidebar.Menu.Item>
              <Sidebar.Menu.Item>
                <MdCheck />
              </Sidebar.Menu.Item>
            </Sidebar.Menu>
          </Sidebar.Root>
          <Suspense fallback={<Loader absolute />}>
            <Route path="/:id">
              {({match}) => {
                return <EntryRoute id={match?.params.id} />
              }}
            </Route>
          </Suspense>
        </div>
        <Statusbar.Root>
          <DraftsStatusSummary />
          {!auth && (
            <Statusbar.Status icon={MdWarning}>
              Not using authentication
            </Statusbar.Status>
          )}
        </Statusbar.Root>
      </Statusbar.Provider>
    </DraftsProvider>
  )
}

type EntryRouteProps = {
  id?: string
}

function EntryRoute({id}: EntryRouteProps) {
  const {draft, isLoading} = useDraft(id)
  const type = draft?.channel
  const View = type?.options.view || EntryEdit
  const selected = ([] as Array<string | undefined>)
    .concat(draft?.id)
    .concat(draft?.parents)
    .filter(Boolean) as Array<string>
  // Todo: add loader
  return (
    <CurrentDraftProvider value={draft}>
      <Pane
        id="content-tree"
        resizable="right"
        defaultWidth={330}
        minWidth={200}
      >
        <AppBar.Root>
          <AppBar.Item full style={{flexGrow: 1}}>
            <Typo.Monospace
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                height: px(28),
                background: 'var(--highlight)',
                padding: `${px(6)} ${px(15)} ${px(6)} ${px(12)}`,
                borderRadius: px(8)
              }}
            >
              <MdSearch size={15} />
            </Typo.Monospace>
          </AppBar.Item>
        </AppBar.Root>
        <ContentTree select={selected} />
      </Pane>
      <div style={{width: '100%', height: '100%'}}>
        <Route path="/:id/new">
          {({match}) => {
            const matched = match?.params.id
            const isEntry = matched === draft?.id
            return <NewEntry parentId={isEntry ? id : undefined} />
          }}
        </Route>
        {draft && <View draft={draft} />}
      </div>
    </CurrentDraftProvider>
  )
}

function DraftsStatusSummary() {
  const drafts = useDrafts()
  const status = useObservable(drafts.status)
  switch (status) {
    case DraftsStatus.Synced:
      return <Statusbar.Status icon={MdCheck}>Synced</Statusbar.Status>
    case DraftsStatus.Editing:
      return <Statusbar.Status icon={MdEdit}>Editing</Statusbar.Status>
    case DraftsStatus.Saving:
      return <Statusbar.Status icon={MdRotateLeft}>Saving</Statusbar.Status>
  }
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

function localSession<T>(options: DashboardOptions<T>) {
  return {
    user: {sub: 'anonymous'},
    hub: new Client(options.schema, options.apiUrl),
    end: async () => {}
  }
}

export function App<T>(props: DashboardOptions<T>) {
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
