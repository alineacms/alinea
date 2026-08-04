import {Atom, atom, Getter} from 'jotai'
import type {Policy} from '#/core/Role.js'
import type {User} from '#/core/User.js'
import {atomWithLocation} from 'jotai-location'
import {selectAtom} from 'jotai/utils'
import {ReactNode} from 'react'
import {workspaceAtoms} from './config.js'
import {configAtom} from './core.js'

const location = atomWithLocation()

export interface RouteBlock {
  confirm: () => void | Promise<void>
}

export const routeGuardAtom = atom<Atom<boolean> | null>(null)
export const routeBlockAtom = atom<RouteBlock | null>(null)

export interface DashboardRoute {
  page?: 'entry' | 'users'
  workspace?: string
  root?: string
  entry?: string
  locale?: string
}

export const nav = {
  users() {
    return '/users'
  },
  entry(
    workspace?: string,
    root?: string,
    entryId?: string,
    locale?: string | null
  ) {
    const rootPart = root ? `${root}${locale ? `:${locale}` : ''}` : ''
    return `/entry/${[workspace, rootPart, entryId].filter(Boolean).join('/')}`
  }
}

/** @internal */
export const routeAtom = atom(
  get => {
    const {hash = '/'} = get(location)
    const [action, workspace, rootPart = '', entry] = hash
      .slice(1)
      .split('/')
      .slice(1) as Array<string | undefined>
    const page: 'users' | 'entry' = action === 'users' ? 'users' : 'entry'
    const [root, locale] = rootPart.split(':')
    return {
      page,
      workspace: page === 'entry' ? workspace : undefined,
      root: page === 'entry' ? root : undefined,
      entry: page === 'entry' ? entry : undefined,
      locale: page === 'entry' ? locale : undefined
    }
  },
  async (get, set, update: DashboardRoute) => {
    const confirm = async () => {
      if (update.page === 'users') {
        set(location, {hash: `#${nav.users()}`})
        return
      }
      const {workspace, root, entry, locale} = update
      set(location, {
        hash: `#${nav.entry(workspace, root, entry, locale)}`
      })
    }
    const guard = get(routeGuardAtom)
    if (guard && get(guard)) {
      set(routeBlockAtom, {
        async confirm() {
          set(routeBlockAtom, null)
          await confirm()
        }
      })
      return
    }
    await confirm()
  }
)

const pageTypeAtom = selectAtom(routeAtom, route => route.page)
const entryAtom = selectAtom(routeAtom, route => route.entry)

function resolveLocale(
  get: Getter,
  route: DashboardRoute,
  workspace: string | undefined,
  root: string | undefined
) {
  if (!workspace) return null
  if (!root) return null
  const {i18n, languagePreferenceAtom} = get(
    workspaceAtoms(workspace).rootsAtom(root)
  )
  if (route.locale && i18n?.locales.includes(route.locale)) return route.locale
  const preference = get(languagePreferenceAtom)
  if (preference) return preference
  return i18n?.locales[0] ?? null
}

function resolveWorkspace(
  get: Getter,
  route: DashboardRoute,
  policy: Policy
): string | undefined {
  const {workspace} = route
  const workspaces = Object.keys(get(configAtom).workspaces).filter(candidate =>
    policy.canRead({workspace: candidate})
  )
  return workspace && workspaces.includes(workspace) ? workspace : workspaces[0]
}

function resolveRoot(
  get: Getter,
  route: DashboardRoute,
  workspace: string | undefined,
  policy: Policy
) {
  const {root} = route
  if (!workspace) return undefined
  const workspaceConfig = get(workspaceAtoms(workspace).settingsAtom)
  const roots = Object.keys(workspaceConfig.roots).filter(candidate =>
    policy.canRead({workspace, root: candidate})
  )
  if (root && roots.includes(root)) {
    return root
  } else {
    return roots[0]
  }
}

export interface Page {
  type: 'users' | 'entry'
  workspace: string | undefined
  root: string | undefined
  entry: string | undefined
  locale: string | null | undefined
  auth: PageAuth
}

export interface PageAuth {
  user: User
  policy: Policy
}

export function resolvePage(get: Getter, auth: PageAuth): Page {
  const route = get(routeAtom)
  const {policy} = auth
  const workspace = resolveWorkspace(get, route, policy)
  const root = resolveRoot(get, route, workspace, policy)
  return {
    type: get(pageTypeAtom),
    workspace,
    root,
    entry: get(entryAtom),
    locale: resolveLocale(get, route, workspace, root),
    auth
  }
}

export function page(
  render: (page: Page, get: Getter) => ReactNode | Promise<ReactNode>
) {
  return render
}
