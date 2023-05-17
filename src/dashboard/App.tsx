import {Config, Root, renderLabel} from 'alinea/core'
import {Client} from 'alinea/core/Client'
import {useLocation, useParams} from 'alinea/dashboard/util/HashRouter'
import {Button, ErrorBoundary, FavIcon, HStack, Loader, Stack} from 'alinea/ui'
import {Modal} from 'alinea/ui/Modal'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {MdiSourceBranch} from 'alinea/ui/icons/MdiSourceBranch'
import {atom, useAtom, useAtomValue} from 'jotai'
import {Suspense} from 'react'
import {
  QueryClient,
  QueryClientProvider as ReactQueryClientProvider
} from 'react-query'
import {navMatchers} from './DashboardNav.js'
import {
  queryClientAtom,
  sessionAtom,
  useSetDashboardOptions
} from './atoms/DashboardAtoms.js'
import {useDbUpdater} from './atoms/EntryAtoms.js'
import {useEditContext} from './atoms/EntryEditor.js'
import {createRouter, locationAtom, matchAtoms} from './atoms/RouterAtoms.js'
import {useDashboard} from './hook/UseDashboard.js'
import {useEntryLocation} from './hook/UseEntryLocation.js'
import {useNav} from './hook/UseNav.js'
import {useRoot} from './hook/UseRoot.js'
import {useWorkspace} from './hook/UseWorkspace.js'
import {Head} from './util/Head.js'
import {DraftsOverview} from './view/DraftsOverview.js'
import {EntryEdit} from './view/EntryEdit.js'
import {EntryTree} from './view/EntryTree.js'
import {RootOverview} from './view/RootOverview.js'
import {SearchBox} from './view/SearchBox.js'
import {Sidebar} from './view/Sidebar.js'
import {Toolbar} from './view/Toolbar.js'
import {Viewport} from './view/Viewport.js'
import {EntryVersionList} from './view/entry/EntryVersionList.js'
import {NewEntry} from './view/entry/NewEntry.js'
import {RootHeader} from './view/entry/RootHeader.js'

const router = createRouter(
  {
    path: '/entry/:workspace?/:root?/:id?',
    loader: async ({id}) => {
      return {}
    },
    component: ContentView
  },
  {
    path: '/draft/:workspace?/:root?/:id?',
    loader: async ({id}) => {
      return {}
    },
    component: DraftsOverview
  }
)

function DraftsButton() {
  const location = useLocation()
  const nav = useNav()
  const {name: workspace} = useWorkspace()
  const {name: root} = useRoot()
  const entryLocation = useEntryLocation()
  const link =
    entryLocation && entryLocation.root === root
      ? nav.draft(entryLocation)
      : nav.draft({workspace})
  const draftsTotal = 0
  /*const {total: draftsTotal} = useDraftsList(workspace)
   */
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

const isEntryAtom = atom(get => {
  const location = get(locationAtom)
  const match = get(matchAtoms({route: navMatchers.matchEntry}))
  return Boolean(match) || location.pathname === '/'
})

function AppAuthenticated() {
  useDbUpdater()
  const {fullPage} = useDashboard()
  const nav = useNav()
  const isEntry = useAtomValue(isEntryAtom)
  const {name: workspace, color, roots} = useWorkspace()
  const {name: currentRoot} = useRoot()
  const entryLocation = useEntryLocation()
  const match = router.useMatch()
  const [isBlocking, unblock] = router.useBlocker(
    'Are you sure you want to discard changes?'
  )
  return (
    <>
      {isBlocking && (
        <Modal open onClose={() => unblock()}>
          Are you sure you want to discard changes?
          <HStack as="footer">
            <Stack.Right>
              <HStack gap={16}>
                <Button outline type="button" onClick={onCancel}>
                  Cancel
                </Button>
                <Button onClick={handleConfirm}>Confirm</Button>
              </HStack>
            </Stack.Right>
          </HStack>
        </Modal>
      )}
      <Toolbar.Provider>
        <Sidebar.Provider>
          <Viewport attachToBody={fullPage} contain color={color}>
            <Head>
              <FavIcon color={color} />
            </Head>
            <Toolbar.Root />
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
                  const {label, icon: Icon} = Root.data(root)
                  return (
                    <Sidebar.Nav.Item
                      key={key}
                      selected={isEntry && isSelected}
                      href={link}
                      title={renderLabel(label)}
                      aria-label={renderLabel(label)}
                    >
                      {Icon ? <Icon /> : <IcRoundInsertDriveFile />}
                    </Sidebar.Nav.Item>
                  )
                })}
                <DraftsButton />
              </Sidebar.Nav>
              <Suspense fallback={<Loader absolute />}>
                <ErrorBoundary>
                  {match ? <match.route.component /> : <ContentView />}
                </ErrorBoundary>
              </Suspense>
            </div>
          </Viewport>
        </Sidebar.Provider>
      </Toolbar.Provider>
    </>
  )
}

function ContentView() {
  const {id} = useParams()
  const workspace = useWorkspace()
  const root = useRoot()
  const {search} = useLocation()
  const {editor, editorUpdate} = useEditContext()
  return (
    <>
      <Sidebar.Tree>
        <SearchBox />
        <RootHeader />
        <EntryTree
          entryId={editor?.entryId}
          selected={editor?.version.parents}
        />
        {editor && <EntryVersionList editor={editor} />}
      </Sidebar.Tree>
      {search === '?new' && (
        <Suspense fallback={<Loader absolute />}>
          <NewEntry parentId={id} />
        </Suspense>
      )}
      <Suspense fallback={<Loader absolute />}>
        {id ? (
          editor ? (
            <EntryEdit editor={editor} />
          ) : (
            <Loader absolute />
          )
        ) : (
          <RootOverview workspace={workspace} root={root} />
        )}
      </Suspense>
    </>
  )
}

function AppRoot() {
  const [session, setSession] = useAtom(sessionAtom)
  const {fullPage, config} = useDashboard()
  const {color} = Config.mainWorkspace(config)
  const Auth = config.backend?.auth?.view
  if (!session)
    return (
      <Viewport attachToBody={fullPage} contain color={color}>
        <Head>
          <FavIcon color={color} />
        </Head>
        {Auth && (
          <Suspense fallback={<Loader absolute />}>
            <Auth setSession={setSession} />
          </Suspense>
        )}
      </Viewport>
    )
  return (
    <Suspense fallback={<Loader absolute />}>
      <AppAuthenticated />
    </Suspense>
  )
}

// facebook/react#24304
const QueryClientProvider: any = ReactQueryClientProvider

export interface AppProps {
  config: Config
  client: Client
  queryClient?: QueryClient
  fullPage?: boolean
}

export function App(props: AppProps) {
  useSetDashboardOptions({fullPage: props.fullPage !== false, ...props})
  const queryClient = useAtomValue(queryClientAtom)
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoot />
    </QueryClientProvider>
  )
}
