import {renderLabel, Session, Workspaces} from '@alinea/core'
import {
  ErrorBoundary,
  FavIcon,
  Loader,
  PreferencesProvider,
  Statusbar,
  useObservable,
  Viewport
} from '@alinea/ui'
import {IcRoundCheck} from '@alinea/ui/icons/IcRoundCheck'
import {IcRoundEdit} from '@alinea/ui/icons/IcRoundEdit'
import {IcRoundInsertDriveFile} from '@alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundRotateLeft} from '@alinea/ui/icons/IcRoundRotateLeft'
import {MdiSourceBranch} from '@alinea/ui/icons/MdiSourceBranch'
import {Fragment, Suspense, useState} from 'react'
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
import {useDraftsList} from './hook/UseDraftsList'
import {useEntryLocation} from './hook/UseEntryLocation'
import {EntrySummaryProvider} from './hook/UseEntrySummary'
import {useLocale} from './hook/UseLocale'
import {useNav} from './hook/UseNav'
import {useRoot} from './hook/UseRoot'
import {SessionProvider} from './hook/UseSession'
import {useWorkspace} from './hook/UseWorkspace'
import {Head} from './util/Head'
import {ContentTree} from './view/ContentTree'
import {DraftsOverview} from './view/DraftsOverview'
import {EditMode} from './view/entry/EditMode'
import {NewEntry} from './view/entry/NewEntry'
import {RootHeader} from './view/entry/RootHeader'
import {EntryEdit} from './view/EntryEdit'
import {RootOverview} from './view/RootOverview'
import {SearchBox} from './view/SearchBox'
import {Sidebar} from './view/Sidebar'
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
    const {id} = useParams()
    return (
      <ErrorBoundary>
        <DraftsOverview id={id} />
      </ErrorBoundary>
    )
  }
}

function DraftsButton() {
  const location = useLocation()
  const nav = useNav()
  const {name: workspace} = useWorkspace()
  const {name: root} = useRoot()
  const {total: draftsTotal} = useDraftsList(workspace)
  const entryLocation = useEntryLocation()
  const link =
    entryLocation && entryLocation.root === root
      ? nav.draft(entryLocation)
      : nav.draft({workspace})
  return (
    <Sidebar.Nav.Item
      selected={location.pathname.startsWith(nav.draft({workspace}))}
      to={link}
      title="Drafts"
      aria-label="Drafts"
      badge={draftsTotal}
    >
      <MdiSourceBranch />
    </Sidebar.Nav.Item>
  )
}

function AppAuthenticated() {
  const {fullPage, config} = useDashboard()
  const nav = useNav()
  const location = useLocation()
  const isEntry = useMatch(nav.matchEntry) || location.pathname === '/'
  const {name: workspace, label, name, color, roots} = useWorkspace()
  const {name: currentRoot} = useRoot()
  const entryLocation = useEntryLocation()
  return (
    <EntrySummaryProvider>
      <DraftsProvider>
        <Statusbar.Provider>
          <Toolbar.Provider>
            <Sidebar.Provider>
              <Viewport attachToBody={fullPage} contain color={color}>
                <Head>
                  <FavIcon color={color} />
                </Head>
                <Toolbar.Root color={color} />
                <div
                  style={{
                    flex: '1',
                    display: 'flex',
                    minHeight: 0,
                    position: 'relative'
                  }}
                >
                  <Sidebar.Nav>
                    {Object.entries(roots).map(([key, root], i) => {
                      const isSelected = key === currentRoot
                      const link =
                        entryLocation && entryLocation.root === key
                          ? nav.entry(entryLocation)
                          : nav.root({workspace, root: key})
                      const title = key.charAt(0).toUpperCase() + key.slice(1)
                      return (
                        <Sidebar.Nav.Item
                          key={key}
                          selected={isEntry && isSelected}
                          to={link}
                          title={title}
                          aria-label={title}
                        >
                          {root.icon ? (
                            <root.icon />
                          ) : (
                            <IcRoundInsertDriveFile />
                          )}
                        </Sidebar.Nav.Item>
                      )
                    })}
                    <DraftsButton />
                  </Sidebar.Nav>
                  <Suspense fallback={<Loader absolute />}>
                    <Routes>
                      <Route
                        path={nav.draft({workspace: ':workspace'})}
                        element={<Router.Drafts />}
                      />
                      <Route
                        path={nav.draft({
                          workspace: ':workspace',
                          root: ':root',
                          id: ':id'
                        })}
                        element={<Router.Drafts />}
                      />
                      <Route
                        path={nav.entry({workspace: ':workspace'})}
                        element={<Router.Entry />}
                      />
                      <Route
                        path={nav.entry({
                          workspace: ':workspace',
                          root: ':root'
                        })}
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
                </div>
                {/*<Statusbar.Root>
                  <DraftsStatusSummary />
                  {!config.hasAuth && (
                    <Statusbar.Status icon={IcRoundWarning}>
                      Not using authentication
                    </Statusbar.Status>
                  )}
                  </Statusbar.Root>*/}
              </Viewport>
            </Sidebar.Provider>
          </Toolbar.Provider>
        </Statusbar.Provider>
      </DraftsProvider>
    </EntrySummaryProvider>
  )
}

type EntryRouteProps = {
  id?: string
}

function EntryRoute({id}: EntryRouteProps) {
  const workspace = useWorkspace()
  const root = useRoot()
  const {draft} = useDraft(id)
  const locale = useLocale()
  const isLoading = Boolean(
    draft?.id !== id && locale && draft?.alinea.i18n?.locale !== locale
  )
  const {search} = useLocation()
  const type = draft?.channel
  const View = type?.options.view || EntryEdit
  const select = ([] as Array<string | undefined>)
    .concat(draft?.alinea.parents)
    .concat(draft?.id)
    .filter(Boolean) as Array<string>
  return (
    <CurrentDraftProvider value={draft}>
      <Sidebar.Tree>
        <SearchBox />
        <RootHeader />
        <ContentTree
          key={workspace.name}
          locale={locale}
          select={select}
          redirectToRoot={!id}
        />
      </Sidebar.Tree>
      {search === '?new' && (
        <Suspense fallback={<Loader absolute />}>
          <NewEntry parentId={id} />
        </Suspense>
      )}
      {draft ? (
        <Suspense fallback={<Loader absolute />}>
          <View
            key={draft.id}
            initialMode={EditMode.Editing}
            draft={draft}
            isLoading={isLoading}
          />
        </Suspense>
      ) : (
        <>
          <Head>
            <title>{renderLabel(workspace.label)}</title>
          </Head>
          <RootOverview workspace={workspace} root={root} />
        </>
      )}
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
  const {fullPage, config} = useDashboard()
  const {color} = config.firstWorkspace
  const Auth = config.authView || Fragment
  if (!session)
    return (
      <Viewport attachToBody={fullPage} contain color={color}>
        <Head>
          <FavIcon color={color} />
        </Head>
        <Suspense fallback={<Loader absolute />}>
          <Auth setSession={setSession} />
        </Suspense>
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

export function App<T extends Workspaces>({
  fullPage = true,
  ...props
}: DashboardOptions<T>) {
  const auth = props.config.authView
  const [queryClient] = useState(
    () =>
      props.queryClient ||
      new QueryClient({defaultOptions: {queries: {retry: false}}})
  )
  const [session, setSession] = useState<Session | undefined>(
    !auth ? localSession(props) : undefined
  )
  return (
    <DashboardProvider value={{...props}}>
      {/* Todo: https://github.com/remix-run/react-router/issues/7703 */}
      <HashRouter
      //hashType="noslash"
      >
        <SessionProvider value={session}>
          <QueryClientProvider client={queryClient}>
            <PreferencesProvider>
              <AppRoot session={session} setSession={setSession} />
            </PreferencesProvider>
          </QueryClientProvider>
        </SessionProvider>
      </HashRouter>
    </DashboardProvider>
  )
}
