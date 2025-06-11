import {Root} from 'alinea/core/Root'
import {Workspace} from 'alinea/core/Workspace'
import {keys} from 'alinea/core/util/Objects'
import {atom, useAtom} from 'jotai'
import {atomWithStorage} from 'jotai/utils'
import {type EntryLocation, dashboardNav, navMatchers} from '../DashboardNav.js'
import {configAtom} from './DashboardAtoms.js'
import {matchAtoms} from './LocationAtoms.js'
import {policyAtom} from './PolicyAtom.js'
import {workspacePreferenceAtom} from './PreferencesAtoms.js'

const workspaceNameAtom = atom(get => {
  const policy = get(policyAtom)
  const config = get(configAtom)
  const match = get(
    matchAtoms({route: navMatchers.matchWorkspace, loose: true})
  )
  const workspacePreference = get(workspacePreferenceAtom)
  const params: Record<string, string | undefined> = match ?? {}
  const requested = [
    params.workspace,
    workspacePreference,
    ...keys(config.workspaces)
  ]
  for (const name of requested) {
    if (name && config.workspaces[name]) {
      const canRead = policy.canRead({workspace: name})
      if (canRead) return name
    }
  }
  throw new Error('No workspace found')
})

export const workspaceAtom = atom(get => {
  const config = get(configAtom)
  const name = get(workspaceNameAtom)
  return {name, ...Workspace.data(config.workspaces[name])}
})

function parseRootPath(path: string) {
  return path.split(':') as [string, string | undefined]
}

const rootNameAtom = atom(get => {
  const policy = get(policyAtom)
  const workspace = get(workspaceAtom)
  const match = get(matchAtoms({route: navMatchers.matchRoot, loose: true}))
  const params: Record<string, string | undefined> = match ?? {}
  const requestedRoot = params.root ? parseRootPath(params.root)[0] : undefined
  const requested = [requestedRoot, ...keys(workspace.roots)]
  for (const name of requested) {
    if (name && workspace.roots[name]) {
      const canRead = policy.canRead({workspace: workspace.name, root: name})
      if (canRead) return name
    }
  }
  throw new Error('No root found')
})

export const rootAtom = atom(get => {
  const config = get(configAtom)
  const workspace = get(workspaceAtom)
  const name = get(rootNameAtom)
  const root = workspace.roots[name]
  if (!root) throw new Error('No root found')
  return {name, ...Root.data(config.workspaces[workspace.name][name])}
})

export const preferredLanguageAtom = atomWithStorage<string | null>(
  '@alinea/locale',
  null
)

export const localeAtom = atom(get => {
  const workspace = get(workspaceAtom)
  const root = get(rootAtom)
  const config = get(configAtom)
  const {i18n} = root
  if (!i18n) return null
  const match = get(matchAtoms({route: navMatchers.matchRoot, loose: true}))
  const params: Record<string, string | undefined> = match ?? {}
  const {root: rootKey} = params
  if (rootKey) {
    const fromUrl = parseRootPath(rootKey)[1]
    if (fromUrl && i18n.locales.includes(fromUrl)) return fromUrl
  }
  const preferredLanguage = get(preferredLanguageAtom)
  if (preferredLanguage && i18n.locales.includes(preferredLanguage))
    return preferredLanguage
  return (
    Root.defaultLocale(config.workspaces[workspace.name][root.name]) ?? null
  )
})

export const entryLocationAtom = atom(get => {
  const match = get(matchAtoms({route: navMatchers.matchEntryId}))
  const [root, locale] = parseRootPath(match?.root ?? '')
  const params: EntryLocation = {
    ...match,
    locale
  }
  if (root) params.root = root
  return params || undefined
})

export const navAtom = atom(get => {
  const {name: workspace} = get(workspaceAtom)
  const {name: root} = get(rootAtom)
  const locale = get(localeAtom)
  return dashboardNav({workspace, root, locale})
})

export const usePreferredLanguage = () => useAtom(preferredLanguageAtom)
