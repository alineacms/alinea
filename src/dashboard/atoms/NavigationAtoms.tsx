import {Root} from 'alinea/core/Root'
import {Workspace} from 'alinea/core/Workspace'
import {keys} from 'alinea/core/util/Objects'
import {atom, useAtom} from 'jotai'
import {atomWithStorage} from 'jotai/utils'
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
  const requestedRoot = params.root ? parseRootPath(params.root)[0] : undefined
  const requested = [requestedRoot, keys(workspace.roots)[0]]
  for (const name of requested)
    if (name && workspace.roots[name])
      return {name, ...Root.data(workspace.roots[name])}
  throw new Error(`No root found`)
})

export const preferredLanguageAtom = atomWithStorage<string | undefined>(
  `@alinea/locale`,
  undefined
)

export const localeAtom = atom(get => {
  const workspace = get(workspaceAtom)
  const root = get(rootAtom)
  const config = get(configAtom)
  const {i18n} = root
  if (!i18n) return
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
  return Root.defaultLocale(config.workspaces[workspace.name][root.name])
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
