import {atom, Getter} from 'jotai'
import {atomWithLocation} from 'jotai-location'
import {selectAtom} from 'jotai/utils'
import {ReactNode} from 'react'
import {workspaceAtoms, workspacesAtom} from './config.js'

const location = atomWithLocation()

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
    //const focused = await get(this.focused)
    const confirm = async () => {
      /*if (update.page === 'users') {
            set(location, {hash: `#${nav.users()}`})
          return
        }*/
      const {workspace, root, entry, locale} = update
      /*if (entry) await get(this.entries(entry).routeReady)*/
      set(location, {
        hash: `#${nav.entry(workspace, root, entry, locale)}`
      })
    }
    /*if (focused && 'entry' in focused) {
        const blockNavigation = set(focused.entry.needsBlock, confirm)
        if (blockNavigation) return
      }*/
    await confirm()
  }
)

const pageTypeAtom = selectAtom(routeAtom, route => route.page)
const entryAtom = selectAtom(routeAtom, route => route.entry ?? null)
const localeAtom = selectAtom(routeAtom, route => route.locale ?? null)

const workspaceAtom = atom((get): string | null => {
  const route = get(routeAtom)
  const {workspace} = route
  const workspaces = get(workspacesAtom)
  return workspace && workspaces.includes(workspace)
    ? workspace
    : (workspaces[0] ?? null)
})

const rootAtom = atom(get => {
  const route = get(routeAtom)
  const {root} = route
  const workspace = get(workspaceAtom)
  if (!workspace) return null
  const workspaceConfig = get(workspaceAtoms(workspace))
  if (root && root in workspaceConfig.roots) {
    return root
  } else {
    return Object.keys(workspaceConfig.roots)[0]
  }
})

export interface Page {
  type: 'users' | 'entry'
  workspace: string | null
  root: string | null
  entry: string | null
  locale: string | null
}

/** @internal */
export const pageAtom = atom((get): Page => {
  return {
    type: get(pageTypeAtom),
    workspace: get(workspaceAtom),
    root: get(rootAtom),
    entry: get(entryAtom),
    locale: get(localeAtom)
  }
})

export function page(
  render: (page: Page, get: Getter) => ReactNode | Promise<ReactNode>
) {
  return render
}
