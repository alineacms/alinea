import {ProgressCircle} from '#/components.js'
import type {Config} from '#/core/Config.js'
import type {LocalConnection} from '#/core/Connection.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {styler} from '@alinea/styler'
import {
  atom,
  createStore,
  Provider,
  useAtom,
  useAtomValue,
  type Getter
} from 'jotai'
import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode
} from 'react'
import css from './App.module.css'
import {AccessDenied} from './app/AccessDenied.js'
import {AuthView} from './app/AuthView.js'
import {DashboardLayout} from './app/DashboardLayout.js'
import {DashboardMeta} from './app/DashboardMeta.js'
import {DashboardErrorBoundary} from './app/DashboardErrorBoundary.js'
import {entryPage} from './app/pages/EntryPage.js'
import {MissingRoot, rootPage} from './app/pages/RootPage.js'
import {usersPage} from './app/pages/UsersPage.js'
import {Rail} from './app/ui/Rail.js'
import {activityAtom, activityPendingAtom} from './atoms/activity.js'
import {authAtom} from './atoms/auth.js'
import {workspaceAtom} from './atoms/config.js'
import {useInitAtoms} from './atoms/core.js'
import {entryAtoms, MissingEntryError} from './atoms/entry.js'
import {pageAtom, type Page} from './atoms/nav.js'
import {rootAtoms} from './atoms/root.js'
import {authReady, canManageMembersAtom} from './atoms/user.js'
import {atomWithPending} from './atoms/utils.js'
import {DashboardModelScope, type Dashboard} from './hooks.js'
import './global.css'

const styles = styler(css)

export interface AppProps {
  graph: WriteableGraph
  events: EventTarget
  config: Config
  client: LocalConnection
  views: Record<string, ComponentType>
  local?: boolean
  alineaDev?: boolean
}

export const appAtom = atomWithPending(
  atom(async get => {
    const auth = get(authAtom)
    if (auth.status === 'authenticated') return get(authenticatedAtom)
    return <AuthView />
  })
)

const authenticatedAtom = atom(async get => {
  const [, canManageMembers] = await Promise.all([
    get(authReady),
    get(canManageMembersAtom)
  ])
  const page = get(pageAtom)
  const {entry, workspace, root} = page
  const workspaceData = workspace ? get(workspaceAtom(workspace)) : undefined
  const meta = (label: string): ReactNode => (
    <DashboardMeta
      color={workspaceData?.color ?? '#7c3aed'}
      icon={workspaceData?.icon}
      title={dashboardTitle(workspaceData?.label ?? 'Alinea', label)}
    />
  )

  if (page.type === 'users' && canManageMembers) {
    const content = await usersPage(page, get)
    return (
      <>
        {meta('Users')}
        {content}
      </>
    )
  }

  if (!workspace || !workspaceData) {
    return (
      <>
        {meta('No workspace access')}
        <AccessDenied canManageMembers={canManageMembers} scope="workspace" />
      </>
    )
  }

  if (!root) {
    return (
      <>
        {meta('No root access')}
        <AccessDenied canManageMembers={canManageMembers} scope="root" />
      </>
    )
  }

  const rootData = rootAtoms(workspace, root)
  const {locale} = page

  if (page.requestedRoot && page.requestedRoot !== root) {
    await get(rootData.tree(locale).ready)
    return (
      <>
        {meta('Root not found')}
        <DashboardLayout
          canManageMembers={canManageMembers}
          page={page}
          root={rootData}
          workspace={{...workspaceData, name: workspace}}
        >
          <MissingRoot
            page={page}
            requestedRoot={page.requestedRoot}
            root={rootData}
          />
        </DashboardLayout>
      </>
    )
  }

  if (entry) {
    const [content, title] = await Promise.all([
      entryPage(page, get),
      entryTitle(page, entry, get),
      get(rootData.tree(locale).ready)
    ])
    return (
      <>
        {meta(title)}
        <DashboardLayout
          canManageMembers={canManageMembers}
          page={page}
          root={rootData}
          workspace={{...workspaceData, name: workspace}}
        >
          {content}
        </DashboardLayout>
      </>
    )
  }

  const [content] = await Promise.all([
    rootPage(page, get),
    get(rootData.tree(locale).ready)
  ])
  return (
    <>
      {meta(get(rootData.label))}
      <DashboardLayout
        canManageMembers={canManageMembers}
        page={page}
        root={rootData}
        workspace={{...workspaceData, name: workspace}}
      >
        {content}
      </DashboardLayout>
    </>
  )
})

export function App(props: AppProps) {
  const [store] = useState(createStore)
  const dashboard = useMemo(
    (): Dashboard => ({
      graph: props.graph,
      config: props.config,
      events: props.events,
      client: props.client,
      views: props.views,
      options: {alineaDev: props.alineaDev, local: props.local}
    }),
    [props]
  )
  return (
    <Provider store={store}>
      <DashboardModelScope dashboard={dashboard}>
        <DashboardErrorBoundary>
          <DashboardApp {...props} />
        </DashboardErrorBoundary>
      </DashboardModelScope>
    </Provider>
  )
}

function DashboardApp(props: AppProps): ReactNode {
  useInitAtoms(props)
  const [appPending, app] = useAtomValue(appAtom)
  const activity = useAtomValue(activityAtom)
  const [, setActivityPending] = useAtom(activityPendingAtom)
  const pending =
    appPending || activity.isFetchingUpdates || activity.isMutating
  useEffect(() => {
    setActivityPending(pending)
  }, [pending, setActivityPending])
  return app ?? <AppLoading />
}

function AppLoading() {
  return (
    <Rail main className={styles.AppLoading()}>
      <div className={styles.AppLoading.progress()}>
        <ProgressCircle isIndeterminate aria-label="Loading dashboard" />
      </div>
    </Rail>
  )
}

async function entryTitle(page: Page, entryId: string, get: Getter) {
  try {
    const entry = await get(entryAtoms(entryId))
    return (await get(entry.locales(page.locale).selectedEntry)).title
  } catch (error) {
    if (error instanceof MissingEntryError) return 'Entry not found'
    throw error
  }
}

function dashboardTitle(workspace: string, view: string) {
  return workspace === view ? workspace : `${workspace}: ${view}`
}
