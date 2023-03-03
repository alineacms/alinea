import {DashboardProvider, useDashboard} from './hook/UseDashboard.js'
import {DraftsProvider, DraftsStatus, useDrafts} from './hook/UseDrafts.js'
import {
  ErrorBoundary,
  FavIcon,
  Loader,
  PreferencesProvider,
  Statusbar,
  Viewport,
  useObservable
} from 'alinea/ui'
import {Fragment, Suspense, useMemo, useState} from 'react'
import {
  QueryClient,
  QueryClientProvider as ReactQueryClientProvider
} from 'react-query'
import {
  Routes,
  useLocation,
  useMatch,
  useParams
} from 'alinea/ui/util/HashRouter'
import {Session, renderLabel} from 'alinea/core'

import {ContentTree} from './view/ContentTree.js'
import {CurrentDraftProvider} from './hook/UseCurrentDraft.js'
import {DashboardOptions} from './Dashboard.js'
import {DraftsOverview} from './view/DraftsOverview.js'
import {EditMode} from './view/entry/EditMode.js'
import {EntryEdit} from './view/EntryEdit.js'
import {EntrySummaryProvider} from './hook/UseEntrySummary.js'
import {Head} from './util/Head.js'
import {IcRoundCheck} from 'alinea/ui/icons/IcRoundCheck'
import {IcRoundEdit} from 'alinea/ui/icons/IcRoundEdit'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundRotateLeft} from 'alinea/ui/icons/IcRoundRotateLeft'
import {MdiSourceBranch} from 'alinea/ui/icons/MdiSourceBranch'
import {NewEntry} from './view/entry/NewEntry.js'
import {RootHeader} from './view/entry/RootHeader.js'
import {RootOverview} from './view/RootOverview.js'
import {SearchBox} from './view/SearchBox.js'
import {SessionProvider} from './hook/UseSession.js'
import {Sidebar} from './view/Sidebar.js'
import {Toolbar} from './view/Toolbar.js'
import {useContentTree} from './hook/UseContentTree.js'
import {useDraft} from './hook/UseDraft.js'
import {useDraftsList} from './hook/UseDraftsList.js'
import {useEntryLocation} from './hook/UseEntryLocation.js'
import {useLocale} from './hook/UseLocale.js'
import {useNav} from './hook/UseNav.js'
import {useRoot} from './hook/UseRoot.js'
import {useWorkspace} from './hook/UseWorkspace.js'

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

function useRoutes() {
  const nav = useNav()
  return useMemo(() => {
    return {
      [nav.draft({
        workspace: ':workspace',
        root: ':root?',
        id: ':id?'
      })]: <Router.Drafts />,
      [nav.entry({
        workspace: ':workspace?',
        root: ':root?',
        id: ':id?'
      })]: <Router.Entry />,
      '/*': <Router.Entry />
    }
  }, [nav])
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
      href={link}
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
  const routes = useRoutes()
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
                      return (
                        <Sidebar.Nav.Item
                          key={key}
                          selected={isEntry && isSelected}
                          href={link}
                          title={renderLabel(root.label)}
                          aria-label={renderLabel(root.label)}
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
                    <Routes routes={routes} />
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
  const {
    isTreeOpen,
    toggleTreeOpen,
    locale: currentLocale,
    ...contentTree
  } = useContentTree({
    locale,
    workspace: workspace.name,
    root: root.name,
    select
  })
  return (
    <CurrentDraftProvider value={draft}>
      <Sidebar.Tree>
        <SearchBox />
        <RootHeader toggleTreeOpen={() => toggleTreeOpen(isTreeOpen)} />
        <ContentTree
          key={workspace.name}
          locale={locale}
          select={select}
          redirectToRoot={!id}
          {...contentTree}
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

export function App<T>({fullPage = true, ...props}: DashboardOptions<T>) {
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
      <SessionProvider value={session}>
        <QueryClientProvider client={queryClient}>
          <PreferencesProvider>
            <AppRoot session={session} setSession={setSession} />
          </PreferencesProvider>
        </QueryClientProvider>
      </SessionProvider>
    </DashboardProvider>
  )
}
