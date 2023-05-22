import {Root, Workspace} from 'alinea/core'
import {keys} from 'alinea/core/util/Objects'
import {atom} from 'jotai'
import {EntryLocation, dashboardNav, navMatchers} from '../DashboardNav.js'
import {configAtom} from './DashboardAtoms.js'
import {matchAtoms} from './LocationAtoms.js'
import {workspacePreferenceAtom} from './PreferencesAtoms.js'

export const workspaceAtom = atom(get => {
  const config = get(configAtom)
  const match = get(
    matchAtoms({route: navMatchers.matchWorkspace, loose: true})
  )
  const workspacePreference = get(workspacePreferenceAtom)
  const params: Record<string, string | undefined> = match ?? {}
  const requested = [
    params.workspace,
    workspacePreference,
    keys(config.workspaces)[0]
  ]
  for (const name of requested)
    if (name && config.workspaces[name])
      return {name, ...Workspace.data(config.workspaces[name])}
  throw new Error(`No workspace found`)
})

function parseRootPath(path: string) {
  return path.split(':') as [string, string | undefined]
}

export const rootAtom = atom(get => {
  const workspace = get(workspaceAtom)
  const match = get(matchAtoms({route: navMatchers.matchRoot, loose: true}))
  const params: Record<string, string | undefined> = match ?? {}
  const requested = [params.root, keys(workspace.roots)[0]]
  for (const name of requested)
    if (name && workspace.roots[name])
      return {name, ...Root.data(workspace.roots[name])}
  throw new Error(`No root found`)
})

export const localeAtom = atom(get => {
  const root = get(rootAtom)
  const {i18n} = root
  if (!i18n) return
  const match = get(matchAtoms({route: navMatchers.matchRoot, loose: true}))
  const params: Record<string, string | undefined> = match ?? {}
  const {root: rootKey} = params
  if (rootKey) {
    const fromUrl = parseRootPath(rootKey)[1]
    if (fromUrl && i18n.locales.includes(fromUrl)) return fromUrl
  }
  return Root.defaultLocale(i18n)
})

export const entryLocationAtom = atom(get => {
  const match = get(matchAtoms({route: navMatchers.matchEntryId}))
  const params = match as EntryLocation
  return params || undefined
})

export const navAtom = atom(get => {
  const {name: workspace} = get(workspaceAtom)
  const {name: root} = get(rootAtom)
  const locale = get(localeAtom)
  return dashboardNav({workspace, root, locale})
})
