import type {Config} from '#/core/Config.js'
import type {LocalConnection} from '#/core/Connection.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {atom, createStore, Provider, useAtomValue} from 'jotai'
import {useMemo, useState, type ComponentType, type ReactNode} from 'react'
import {AccessDenied} from './app/AccessDenied.js'
import {AuthView} from './app/AuthView.js'
import {DashboardLayout} from './app/DashboardLayout.js'
import {DashboardMeta} from './app/DashboardMeta.js'
import {DashboardErrorBoundary} from './app/DashboardErrorBoundary.js'
import {entryPage} from './app/pages/EntryPage.js'
import {MissingRoot, rootPage} from './app/pages/RootPage.js'
import {usersPage} from './app/pages/UsersPage.js'
import {authAtom} from './atoms/auth.js'
import {workspaceAtoms} from './atoms/config.js'
import {useInitAtoms} from './atoms/core.js'
import {entryAtoms, MissingEntryError} from './atoms/entry.js'
import {resolvePage} from './atoms/nav.js'
import {rootAtoms} from './atoms/root.js'
import {authReady, canManageMembersAtom} from './atoms/user.js'
import {DashboardModelScope, type Dashboard} from './hooks.js'
import './global.css'

export interface AppProps {
  graph: WriteableGraph
  events: EventTarget
  config: Config
  client: LocalConnection
  views: Record<string, ComponentType>
  local?: boolean
  alineaDev?: boolean
}

const appAtom = atom(get => {
  const auth = get(authAtom)
  return auth.status === 'authenticated' ? get(authenticatedAtom) : <AuthView />
})

const authenticatedAtom = atom(async get => {
  const [auth, canManageMembers] = await Promise.all([
    get(authReady),
    get(canManageMembersAtom)
  ])
  const page = resolvePage(get, auth)
  const {entry, workspace, root} = page
  const workspaceData = workspace
    ? get(workspaceAtoms(workspace).settingsAtom)
    : undefined
  const meta = (label: string): ReactNode => (
    <DashboardMeta
      color={workspaceData?.color ?? '#7c3aed'}
      icon={workspaceData?.icon}
      title={dashboardTitle(workspaceData?.label ?? 'Alinea', label)}
    />
  )

  if (page.type === 'users' && canManageMembers) {
    return (
      <>
        {meta('Users')}
        {usersPage(page, get)}
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

  const rootData = rootAtoms(page, workspace, root, page.locale ?? null)

  if (page.requestedRoot && page.requestedRoot !== root) {
    await get(rootData.treeReady)
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
      get(rootData.treeReady)
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
    get(rootData.treeReady)
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
  // @ts-expect-error This is the intentional top-level async JSX boundary.
  return useAtomValue(appAtom)
}

async function entryTitle(
  page: ReturnType<typeof resolvePage>,
  entryId: string,
  get: Parameters<typeof resolvePage>[0]
) {
  try {
    const entry = await get(entryAtoms(page, entryId))
    return (await get(entry.locales(page.locale ?? null).selectedEntry)).title
  } catch (error) {
    if (error instanceof MissingEntryError) return 'Entry not found'
    throw error
  }
}

function dashboardTitle(workspace: string, view: string) {
  return workspace === view ? workspace : `${workspace}: ${view}`
}
