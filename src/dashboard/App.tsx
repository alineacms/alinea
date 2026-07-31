import type {Config} from '#/core/Config.js'
import type {LocalConnection} from '#/core/Connection.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {atom, useAtomValue} from 'jotai'
import {ComponentType} from 'react'
import {AuthView} from './app/AuthView.js'
import {entryPage} from './app/pages/EntryPage.js'
import {usersPage} from './app/pages/UsersPage.js'
import {authAtom} from './atoms/auth.js'
import {useInitAtoms} from './atoms/core.js'
import {pageAtom} from './atoms/nav.js'
import {policyAtom, policyReady} from './atoms/user.js'
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
  switch (auth.status) {
    case 'authenticated':
      return get(authenticatedAtom)
    default:
      return <AuthView />
  }
})

const authenticatedAtom = atom(async get => {
  await get(policyReady)
  const policy = get(policyAtom)
  const page = get(pageAtom)

  if (page.type === 'users' && policy.canManageMembers()) {
    return usersPage(page, get)
  }

  const {entry, workspace, root, locale} = page

  if (entry) {
    return entryPage(page, get)
  }

  return 'todo'
})

export function App(props: AppProps) {
  useInitAtoms(props)
  return useAtomValue(appAtom)
}
