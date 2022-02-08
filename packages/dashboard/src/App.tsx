import {Client} from '@alinea/client'
import {Session, Workspaces} from '@alinea/core'
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
import {Route, useLocation} from 'react-router'
import {HashRouter} from 'react-router-dom'
import {DashboardOptions} from './Dashboard'
import {nav} from './DashboardNav'
import {DashboardProvider, useDashboard} from './hook/UseDashboard'
import {useDraft} from './hook/UseDraft'
import {DraftsProvider, DraftsStatus, useDrafts} from './hook/UseDrafts'
import {useRoot} from './hook/UseRoot'
import {SessionProvider} from './hook/UseSession'
import {useWorkspace} from './hook/UseWorkspace'
import {ContentTree} from './view/ContentTree'
import {EntryEdit, NewEntry} from './view/EntryEdit'
import {Toolbar} from './view/Toolbar'

function AppAuthenticated() {
  const {auth, nav} = useDashboard()
  const location = useLocation()
  const {workspace, name, color, roots} = useWorkspace()
  return (
    <DraftsProvider>
      <Statusbar.Provider>
        <Viewport color={color}>
          <FavIcon color={color} />
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
                {Object.entries(roots).map(([key, root], i) => {
                  const isSelected =
                    location.pathname.length > 1
                      ? location.pathname.startsWith(nav.root(workspace, key))
                      : i === 0
                  return (
                    <Sidebar.Menu.Item
                      key={key}
                      selected={isSelected}
                      to={nav.root(workspace, key)}
                    >
                      {root.icon ? <root.icon /> : <MdInsertDriveFile />}
                    </Sidebar.Menu.Item>
                  )
                })}
              </Sidebar.Menu>
            </Sidebar.Root>
            <Suspense fallback={<Loader absolute />}>
              <Route path={nav.entry(':workspace', ':root', ':id')}>
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
        </Viewport>
      </Statusbar.Provider>
    </DraftsProvider>
  )
}

type EntryRouteProps = {
  id?: string
}

function EntryRoute({id}: EntryRouteProps) {
  const {config, nav} = useDashboard()
  const {workspace} = useWorkspace()
  const {root} = useRoot()
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
        <ContentTree workspace={workspace} root={root} select={selected} />
      </Pane>
      <div style={{width: '100%', height: '100%'}}>
        <Route path={nav.create(':workspace', ':root', ':parent')}>
          {({match}) => {
            const matched = match?.params.parent
            if (!matched) return null
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
  const {auth: Auth = Fragment, config} = useDashboard()
  const {name, color} = config.defaultWorkspace
  if (!session)
    return (
      <Viewport color={color}>
        <FavIcon color={color} />
        <Auth setSession={setSession} />
      </Viewport>
    )
  return <AppAuthenticated />
}

function localSession(options: DashboardOptions) {
  return {
    user: {sub: 'anonymous'},
    hub: new Client(options.config, options.apiUrl),
    end: async () => {}
  }
}

export function App<T extends Workspaces>(props: DashboardOptions<T>) {
  const [queryClient] = useState(() => new QueryClient())
  const [session, setSession] = useState<Session | undefined>(
    !props.auth ? localSession(props) : undefined
  )
  return (
    <DashboardProvider value={{...props, nav}}>
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
