import type {Config} from '#/core/Config.js'
import type {LocalConnection} from '#/core/Connection.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {atom, useAtomValue} from 'jotai'
import {ComponentType} from 'react'
import {AuthView} from './app/AuthView.js'
import {DashboardLayout} from './app/DashboardLayout.js'
import {entryPage} from './app/pages/EntryPage.js'
import {rootPage} from './app/pages/RootPage.js'
import {usersPage} from './app/pages/UsersPage.js'
import {authAtom} from './atoms/auth.js'
import {workspaceAtoms} from './atoms/config.js'
import {useInitAtoms} from './atoms/core.js'
import {resolvePage} from './atoms/nav.js'
import {rootAtoms} from './atoms/root.js'
import {authReady} from './atoms/user.js'
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
  const auth = await get(authReady)
  const {policy} = auth
  const page = resolvePage(get, auth)

  if (page.type === 'users' && policy.canManageMembers()) {
    return usersPage(page, get)
  }

  const {entry, workspace, root} = page

  if (entry) {
    if (!workspace || !root) return entryPage(page, get)
    const rootData = rootAtoms(page, workspace, root, page.locale ?? null)
    const [content] = await Promise.all([
      entryPage(page, get),
      get(rootData.treeReady)
    ])
    const workspaceData = get(workspaceAtoms(workspace).settingsAtom)
    return (
      <DashboardLayout
        canManageMembers={policy.canManageMembers()}
        page={page}
        root={rootData}
        workspace={{...workspaceData, name: workspace}}
      >
        {content}
      </DashboardLayout>
    )
  }

  if (workspace && root) {
    const rootData = rootAtoms(page, workspace, root, page.locale ?? null)
    const [content] = await Promise.all([
      rootPage(page, get),
      get(rootData.treeReady)
    ])
    const workspaceData = get(workspaceAtoms(workspace).settingsAtom)
    return (
      <DashboardLayout
        canManageMembers={policy.canManageMembers()}
        page={page}
        root={rootData}
        workspace={{...workspaceData, name: workspace}}
      >
        {content}
      </DashboardLayout>
    )
  }

  return 'todo'
})

export function App(props: AppProps) {
  useInitAtoms(props)
  return useAtomValue(appAtom)
}
