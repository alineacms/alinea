import {Config} from 'alinea/core/Config'
import type {Connection} from 'alinea/core/Connection'
import {Root} from 'alinea/core/Root'
import {Icon, Loader, px} from 'alinea/ui'
import {Statusbar} from 'alinea/ui/Statusbar'
import {FavIcon} from 'alinea/ui/branding/FavIcon'
import {IcRoundDescription} from 'alinea/ui/icons/IcRoundDescription'
import {MaterialSymbolsDatabase} from 'alinea/ui/icons/MaterialSymbolsDatabase'
import {MdiSourceBranch} from 'alinea/ui/icons/MdiSourceBranch'
import {atom, useAtom, useAtomValue} from 'jotai'
import {type ComponentType, useEffect} from 'react'
import type {QueryClient} from 'react-query'
import {navMatchers} from './DashboardNav.js'
import {DashboardProvider} from './DashboardProvider.js'
import {router} from './Routes.js'
import {sessionAtom} from './atoms/DashboardAtoms.js'
import {dbMetaAtom, useDbUpdater} from './atoms/DbAtoms.js'
import {errorAtom} from './atoms/ErrorAtoms.js'
import {locationAtom, matchAtoms, useLocation} from './atoms/LocationAtoms.js'
import {usePreferredLanguage} from './atoms/NavigationAtoms.js'
import {RouteView, RouterProvider} from './atoms/RouterAtoms.js'
import {useDashboard} from './hook/UseDashboard.js'
import {useEntryLocation} from './hook/UseEntryLocation.js'
import {useLocale} from './hook/UseLocale.js'
import {useNav} from './hook/UseNav.js'
import {useRoot} from './hook/UseRoot.js'
import {useWorkspace} from './hook/UseWorkspace.js'
import {Head} from './util/Head.js'
import {SuspenseBoundary} from './util/SuspenseBoundary.js'
import {ErrorBoundary} from './view/ErrorBoundary.js'
import {Modal} from './view/Modal.js'
import {Sidebar} from './view/Sidebar.js'
import {Toolbar} from './view/Toolbar.js'
import {Viewport} from './view/Viewport.js'
import {SidebarSettings} from './view/sidebar/SidebarSettings.js'

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
  return (
    <Sidebar.Nav.Item
      selected={location.pathname.startsWith(nav.draft({workspace}))}
      href={link}
      aria-label="Drafts"
      badge={draftsTotal}
    >
      <Icon icon={MdiSourceBranch} />
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
  const {alineaDev, fullPage} = useDashboard()
  const nav = useNav()
  const isEntry = useAtomValue(isEntryAtom)
  const {name: workspace, color, roots} = useWorkspace()
  const {name: currentRoot} = useRoot()
  const entryLocation = useEntryLocation()
  const locale = useLocale()
  const [preferredLanguage, setPreferredLanguage] = usePreferredLanguage()
  const [errorMessage, setErrorMessage] = useAtom(errorAtom)
  const meta = useAtomValue(dbMetaAtom)
  useEffect(() => {
    setPreferredLanguage(locale)
  }, [locale])
  return (
    <>
      {errorMessage && (
        <Modal open onClose={() => setErrorMessage(null)}>
          <div style={{padding: px(16)}}>{errorMessage}</div>
        </Modal>
      )}
      <Statusbar.Provider>
        <Toolbar.Provider>
          <Sidebar.Provider>
            <Head>
              <FavIcon color={color} />
            </Head>
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
                  const {id, ...location} = entryLocation
                  const link =
                    location.root === key
                      ? nav.entry(location)
                      : nav.root({
                          workspace,
                          root: key,
                          locale: preferredLanguage
                        })
                  const {label, icon} = Root.data(root)
                  return (
                    <Sidebar.Nav.Item
                      key={key}
                      selected={isEntry && isSelected}
                      href={link}
                      aria-label={label}
                    >
                      <Icon icon={icon ?? IcRoundDescription} />
                    </Sidebar.Nav.Item>
                  )
                })}
                {/*<DraftsButton />*/}
                <SidebarSettings />
              </Sidebar.Nav>
              <ErrorBoundary>
                <SuspenseBoundary name="main" fallback={<Loader absolute />}>
                  <RouteView fallback={null} />
                </SuspenseBoundary>
              </ErrorBoundary>
            </div>
            <Statusbar.Root>
              <Statusbar.Status icon={MaterialSymbolsDatabase}>
                {meta.contentHash}
              </Statusbar.Status>
            </Statusbar.Root>
          </Sidebar.Provider>
        </Toolbar.Provider>
      </Statusbar.Provider>
    </>
  )
}

function AppRoot() {
  const [session, setSession] = useAtom(sessionAtom)
  const {fullPage, config} = useDashboard()
  const {color} = Config.mainWorkspace(config)
  const Auth = config.auth
  if (!session)
    return (
      <>
        <Head>
          <FavIcon color={color} />
        </Head>
        {Auth && (
          <SuspenseBoundary name="auth" fallback={<Loader absolute />}>
            <Auth setSession={setSession} />
          </SuspenseBoundary>
        )}
      </>
    )
  return (
    <>
      <SuspenseBoundary name="router" fallback={<Loader absolute />}>
        <RouterProvider router={router}>
          <AppAuthenticated />
        </RouterProvider>
      </SuspenseBoundary>
    </>
  )
}

export interface AppProps {
  config: Config
  views: Record<string, ComponentType<any>>
  client: Connection
  queryClient?: QueryClient
  fullPage?: boolean
  dev?: boolean
  alineaDev?: boolean
}

export function App(props: AppProps) {
  const fullPage = props.fullPage !== false
  const {color} = Config.mainWorkspace(props.config)
  return (
    <DashboardProvider {...props}>
      <Viewport attachToBody={fullPage} contain color={color}>
        <AppRoot />
      </Viewport>
    </DashboardProvider>
  )
}
