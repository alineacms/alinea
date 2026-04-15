import {Config} from '#/core/Config.js'
import type {LocalConnection} from '#/core/Connection.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {Root} from '#/core/Root.js'
import {Icon, Loader, px} from '#/ui.js'
import {FavIcon} from '#/ui/branding/FavIcon.js'
import {IcRoundCheckBox} from '#/ui/icons/IcRoundCheckBox.js'
import {IcRoundCheckBoxOutlineBlank} from '#/ui/icons/IcRoundCheckBoxOutlineBlank.js'
import {IcRoundDescription} from '#/ui/icons/IcRoundDescription.js'
import {MaterialSymbolsDatabase} from '#/ui/icons/MaterialSymbolsDatabase.js'
import {Statusbar} from '#/ui/Statusbar.js'
import {App as AppV2} from '#/v2/App.js'
import {views as v2Views} from '#/v2/app/fields/views.js'
import {atom, useAtom, useAtomValue} from 'jotai'
import {type ComponentType, useEffect, useMemo} from 'react'
import type {QueryClient} from 'react-query'
import {sessionAtom} from './atoms/DashboardAtoms.js'
import {dbMetaAtom, useDbUpdater} from './atoms/DbAtoms.js'
import {errorAtom} from './atoms/ErrorAtoms.js'
import {locationAtom, matchAtoms} from './atoms/LocationAtoms.js'
import {usePreferredLanguage} from './atoms/NavigationAtoms.js'
import {policyTrigger} from './atoms/PolicyAtom.js'
import {RouterProvider, RouteView} from './atoms/RouterAtoms.js'
import type {WorkerDB} from './boot/WorkerDB.js'
import {navMatchers} from './DashboardNav.js'
import {DashboardProvider} from './DashboardProvider.js'
import {useDashboard} from './hook/UseDashboard.js'
import {useEntryLocation} from './hook/UseEntryLocation.js'
import {useLocale} from './hook/UseLocale.js'
import {useNav} from './hook/UseNav.js'
import {useRoot} from './hook/UseRoot.js'
import {useWorkspace} from './hook/UseWorkspace.js'
import {router} from './Routes.js'
import {Head} from './util/Head.js'
import {SuspenseBoundary} from './util/SuspenseBoundary.js'
import {ErrorBoundary} from './view/ErrorBoundary.js'
import {Modal} from './view/Modal.js'
import {Sidebar} from './view/Sidebar.js'
import {SidebarSettings} from './view/sidebar/SidebarSettings.js'
import {Toolbar} from './view/Toolbar.js'
import {Viewport} from './view/Viewport.js'

const isEntryAtom = atom(get => {
  const location = get(locationAtom)
  const match = get(matchAtoms({route: navMatchers.matchEntry}))
  return Boolean(match) || location.pathname === '/'
})

function AppAuthenticated() {
  useDbUpdater()
  return <V2 />
  // This is a workaround to make sure we suspend right here until we have a
  // policy available, but once we do there is no more need to suspend
  const policy = useAtomValue(policyTrigger)
  const {alineaDev, config} = useDashboard()
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
                {Object.entries(roots)
                  .filter(([key]) => {
                    return policy.canRead({workspace, root: key})
                  })
                  .map(([key, root]) => {
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
  const {config} = useDashboard()
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
    <ErrorBoundary>
      <SuspenseBoundary name="router" fallback={<Loader absolute />}>
        <RouterProvider router={router}>
          <AppAuthenticated />
        </RouterProvider>
      </SuspenseBoundary>
    </ErrorBoundary>
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

function V2() {
  const {config, db} = useDashboard()
  const props = useMemo(() => {
    return {
      config: atom(config),
      writeableGraph: atom(db as WriteableGraph),
      indexEvents: atom(db.events),
      views: atom(v2Views)
    }
  }, [config, db])
  return <AppV2 {...props} />
}
