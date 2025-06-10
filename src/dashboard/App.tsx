import {Config} from 'alinea/core/Config'
import type {LocalConnection} from 'alinea/core/Connection'
import {Root} from 'alinea/core/Root'
import {Icon, Loader, px} from 'alinea/ui'
import {Statusbar} from 'alinea/ui/Statusbar'
import {FavIcon} from 'alinea/ui/branding/FavIcon'
import {IcRoundCheckBox} from 'alinea/ui/icons/IcRoundCheckBox'
import {IcRoundCheckBoxOutlineBlank} from 'alinea/ui/icons/IcRoundCheckBoxOutlineBlank'
import {IcRoundDescription} from 'alinea/ui/icons/IcRoundDescription'
import {MaterialSymbolsDatabase} from 'alinea/ui/icons/MaterialSymbolsDatabase'
import {atom, useAtom, useAtomValue} from 'jotai'
import {type ComponentType, useEffect} from 'react'
import type {QueryClient} from 'react-query'
import {navMatchers} from './DashboardNav.js'
import {DashboardProvider} from './DashboardProvider.js'
import {router} from './Routes.js'
import {sessionAtom} from './atoms/DashboardAtoms.js'
import {dbMetaAtom, pendingAtom, useDbUpdater} from './atoms/DbAtoms.js'
import {errorAtom} from './atoms/ErrorAtoms.js'
import {locationAtom, matchAtoms} from './atoms/LocationAtoms.js'
import {usePreferredLanguage} from './atoms/NavigationAtoms.js'
import {RouteView, RouterProvider} from './atoms/RouterAtoms.js'
import type {WorkerDB} from './boot/WorkerDB.js'
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

const isEntryAtom = atom(get => {
  const location = get(locationAtom)
  const match = get(matchAtoms({route: navMatchers.matchEntry}))
  return Boolean(match) || location.pathname === '/'
})

function AppAuthenticated() {
  useDbUpdater()
  const {alineaDev, config, fullPage} = useDashboard()
  const {roles} = config
  const [session, setSession] = useAtom(sessionAtom)
  const nav = useNav()
  const isEntry = useAtomValue(isEntryAtom)
  const {name: workspace, color, roots} = useWorkspace()
  const {name: currentRoot} = useRoot()
  const entryLocation = useEntryLocation()
  const locale = useLocale()
  const [preferredLanguage, setPreferredLanguage] = usePreferredLanguage()
  const [errorMessage, setErrorMessage] = useAtom(errorAtom)
  const sha = useAtomValue(dbMetaAtom)
  const pending = useAtomValue(pendingAtom)
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
            {alineaDev && (
              <Statusbar.Root>
                {session &&
                  Object.entries(roles ?? {}).map(([name, role]) => {
                    const isActive = session.user.roles.includes(name)
                    return (
                      <Statusbar.Status
                        icon={
                          isActive
                            ? IcRoundCheckBox
                            : IcRoundCheckBoxOutlineBlank
                        }
                        key={name}
                        onClick={() => {
                          setSession({
                            ...session,
                            user: {
                              ...session.user,
                              roles: isActive
                                ? session.user.roles.filter(r => r !== name)
                                : [...session.user.roles, name]
                            }
                          })
                        }}
                      >
                        <span>{role.label}</span>
                      </Statusbar.Status>
                    )
                  })}

                {sha ? (
                  <Statusbar.Status icon={MaterialSymbolsDatabase}>
                    {sha.slice(0, 7)}
                  </Statusbar.Status>
                ) : (
                  <Statusbar.Status icon={MaterialSymbolsDatabase}>
                    Syncing
                  </Statusbar.Status>
                )}
              </Statusbar.Root>
            )}
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
  db: WorkerDB
  config: Config
  views: Record<string, ComponentType>
  client: LocalConnection
  queryClient?: QueryClient
  fullPage?: boolean
  local?: boolean
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
