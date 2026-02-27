import {atom} from 'jotai'
import {atomWithLocation} from 'jotai-location'

export interface CmsRoute {
  workspace?: string
  root?: string
  entry?: string
}

export const locationAtom = atomWithLocation()

// Parses a pathname like /workspace/root/entry-id-or-path into route parts.
export function parseCmsPath(pathname: string): CmsRoute {
  const match = /^\/?([^/]+)?(?:\/([^/]+))?(?:\/(.+))?\/?$/.exec(pathname)
  const workspace = match?.[1] ? decodeURIComponent(match[1]) : undefined
  const root = match?.[2] ? decodeURIComponent(match[2]) : undefined
  const entry = match?.[3] ? decodeURIComponent(match[3]) : undefined
  return {
    workspace,
    root,
    entry
  }
}

function routeToPath(route: CmsRoute): string {
  const parts = [route.workspace, route.root, route.entry].filter(Boolean)
  if (parts.length === 0) return '/'
  return `/${parts.map(part => encodeURIComponent(part!)).join('/')}`
}

export const cmsRouteAtom = atom(
  get => {
    const {pathname = '/'} = get(locationAtom)
    return parseCmsPath(pathname)
  },
  (get, set, update: CmsRoute | ((prev: CmsRoute) => CmsRoute)) => {
    const prev = parseCmsPath(get(locationAtom).pathname ?? '/')
    const next = typeof update === 'function' ? update(prev) : update
    const pathname = routeToPath(next)
    set(
      locationAtom,
      location => ({...location, pathname}),
      {replace: true}
    )
  }
)
