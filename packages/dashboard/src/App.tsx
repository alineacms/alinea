import {renderLabel, Session, Workspaces} from '@alinea/core'
import {
  ErrorBoundary,
  FavIcon,
  Loader,
  Pane,
  Statusbar,
  useObservable,
  Viewport
} from '@alinea/ui'
//import 'preact/debug'
import {IcRoundCheck} from '@alinea/ui/icons/IcRoundCheck'
import {IcRoundEdit} from '@alinea/ui/icons/IcRoundEdit'
import {IcRoundInsertDriveFile} from '@alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundRotateLeft} from '@alinea/ui/icons/IcRoundRotateLeft'
import {IcRoundWarning} from '@alinea/ui/icons/IcRoundWarning'
import {MdiSourceBranch} from '@alinea/ui/icons/MdiSourceBranch'
import {Sidebar} from '@alinea/ui/Sidebar'
import {Fragment, Suspense, useState} from 'react'
import {Helmet} from 'react-helmet'
import {
  QueryClient,
  QueryClientProvider as ReactQueryClientProvider
} from 'react-query'
import {Route, Routes, useLocation, useMatch, useParams} from 'react-router'
import {HashRouter} from 'react-router-dom'
import {DashboardOptions} from './Dashboard'
import {CurrentDraftProvider} from './hook/UseCurrentDraft'
import {DashboardProvider, useDashboard} from './hook/UseDashboard'
import {useDraft} from './hook/UseDraft'
import {DraftsProvider, DraftsStatus, useDrafts} from './hook/UseDrafts'
import {useLocale} from './hook/UseLocale'
import {useNav} from './hook/UseNav'
import {ReferencePickerProvider} from './hook/UseReferencePicker'
import {useRoot} from './hook/UseRoot'
import {SessionProvider} from './hook/UseSession'
import {useWorkspace} from './hook/UseWorkspace'
import {ContentTree} from './view/ContentTree'
import {DraftsOverview} from './view/DraftsOverview'
import {RootHeader} from './view/entry/RootHeader'
import {EntryEdit, NewEntry} from './view/EntryEdit'
import {SearchBox} from './view/SearchBox'
import {Toolbar} from './view/Toolbar'

const Router = {
  Entry() {
    const {id} = useParams()
    return (
      <ErrorBoundary>
        <EntryRoute id={id} />
      </ErrorBoundary>
    )
  },
  Drafts() {
    return <DraftsOverview />
  }
}

function AppAuthenticated() {
  const {auth} = useDashboard()
  const nav = useNav()
  const location = useLocation()
  const isEntry = useMatch(nav.matchEntry) || location.pathname === '/'
  const {name: workspace, name, color, roots} = useWorkspace()
  const {name: currentRoot} = useRoot()
  return (
    <DraftsProvider>
      <Statusbar.Provider>
        <Toolbar.Provider>
          <Viewport contain color={color}>
            <FavIcon color={color} />
            <Helmet>
              <title>{renderLabel(name)}</title>
            </Helmet>
            <Toolbar.Root />
            <div
              style={{
                flex: '1',
                display: 'flex',
                minHeight: 0,
                position: 'relative'
              }}
            >
              <ReferencePickerProvider key={workspace}>
                <Sidebar.Root>
                  <Sidebar.Menu>
                    {Object.entries(roots).map(([key, root], i) => {
                      const isSelected = key === currentRoot
                      return (
                        <Sidebar.Menu.Item
                          key={key}
                          selected={isEntry && isSelected}
                          to={nav.root({workspace, root: key})}
                        >
                          {root.icon ? (
                            <root.icon />
                          ) : (
                            <IcRoundInsertDriveFile />
                          )}
                        </Sidebar.Menu.Item>
                      )
                    })}
                    <Sidebar.Menu.Item
                      selected={location.pathname === nav.drafts({workspace})}
                      to={nav.drafts({workspace})}
                    >
                      <MdiSourceBranch />
                    </Sidebar.Menu.Item>
                  </Sidebar.Menu>
                </Sidebar.Root>
                <Suspense fallback={<Loader absolute />}>
                  <Routes>
                    <Route
                      path={nav.drafts({workspace: ':workspace'})}
                      element={<Router.Drafts />}
                    />
                    <Route
                      path={nav.entry({workspace: ':workspace'})}
                      element={<Router.Entry />}
                    />
                    <Route
                      path={nav.entry({workspace: ':workspace', root: ':root'})}
                      element={<Router.Entry />}
                    />
                    <Route
                      path={
                        nav.entry({
                          workspace: ':workspace',
                          root: ':root',
                          id: ':id'
                        }) + '/*'
                      }
                      element={<Router.Entry />}
                    />
                    <Route path="/*" element={<Router.Entry />} />
                  </Routes>
                </Suspense>
              </ReferencePickerProvider>
            </div>
            <Statusbar.Root>
              <DraftsStatusSummary />
              {!auth && (
                <Statusbar.Status icon={IcRoundWarning}>
                  Not using authentication
                </Statusbar.Status>
              )}
            </Statusbar.Root>
          </Viewport>
        </Toolbar.Provider>
      </Statusbar.Provider>
    </DraftsProvider>
  )
}

type EntryRouteProps = {
  id?: string
}

function EntryRoute({id}: EntryRouteProps) {
  const {name: workspace} = useWorkspace()
  const {draft} = useDraft(id)
  const locale = useLocale()
  const isLoading = Boolean(
    draft?.id !== id && locale && draft?.i18n?.locale !== locale
  )
  const {search} = useLocation()
  const type = draft?.channel
  const View = type?.options.view || EntryEdit
  const select = ([] as Array<string | undefined>)
    .concat(draft?.parents)
    .concat(draft?.id)
    .filter(Boolean) as Array<string>
  return (
    <CurrentDraftProvider value={draft}>
      <Pane
        id="content-tree"
        resizable="right"
        defaultWidth={330}
        minWidth={200}
      >
        <SearchBox />
        <RootHeader />
        <ContentTree
          key={workspace}
          locale={locale}
          select={select}
          redirectToRoot={!id}
        />
      </Pane>
      <div style={{width: '100%', height: '100%'}}>
        {search === '?new' && (
          <Suspense fallback={<Loader absolute />}>
            <NewEntry parentId={id} />
          </Suspense>
        )}
        {draft && <View draft={draft} isLoading={isLoading} />}
      </div>
    </CurrentDraftProvider>
  )
}

function DraftsStatusSummary() {
  const drafts = useDrafts()
  const status = useObservable(drafts.status)
  switch (status) {
    case DraftsStatus.Synced:
      return <Statusbar.Status icon={IcRoundCheck}>Synced</Statusbar.Status>
    case DraftsStatus.Editing:
      return <Statusbar.Status icon={IcRoundEdit}>Editing</Statusbar.Status>
    case DraftsStatus.Saving:
      return (
        <Statusbar.Status icon={IcRoundRotateLeft}>Saving</Statusbar.Status>
      )
  }
}

type AppRootProps = {
  session: Session | undefined
  setSession: (session: Session | undefined) => void
}

function AppRoot({session, setSession}: AppRootProps) {
  const {auth: Auth = Fragment, config} = useDashboard()
  const {color} = config.defaultWorkspace
  if (!session)
    return (
      <Viewport contain color={color}>
        <FavIcon color={color} />
        <Auth setSession={setSession} />
      </Viewport>
    )
  return <AppAuthenticated />
}

function localSession(options: DashboardOptions) {
  return {
    user: {sub: 'anonymous'},
    hub: options.client,
    end: async () => {}
  }
}

// facebook/react#24304
const QueryClientProvider: any = ReactQueryClientProvider

export function App<T extends Workspaces>(props: DashboardOptions<T>) {
  const [queryClient] = useState(
    () => new QueryClient({defaultOptions: {queries: {retry: false}}})
  )
  const [session, setSession] = useState<Session | undefined>(
    !props.auth ? localSession(props) : undefined
  )
  return (
    <DashboardProvider value={{...props}}>
      {/* Todo: https://github.com/remix-run/react-router/issues/7703 */}
      <HashRouter
      //hashType="noslash"
      >
        <SessionProvider value={session}>
          <QueryClientProvider client={queryClient}>
            <AppRoot session={session} setSession={setSession} />
          </QueryClientProvider>
        </SessionProvider>
      </HashRouter>
    </DashboardProvider>
  )
}
