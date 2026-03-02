import {atom} from 'jotai'
import {atomWithLocation} from 'jotai-location'

export interface CmsRoute {
  workspace?: string
  root?: string
  entry?: string
  locale?: string
}

export const locationAtom = atomWithLocation()

// Parses a pathname like /workspace/root/entry-id-or-path into route parts.
export function parseCmsPath(pathname: string, search = ''): CmsRoute {
  const match = /^\/?([^/]+)?(?:\/([^/]+))?(?:\/(.+))?\/?$/.exec(pathname)
  const workspace = match?.[1] ? decodeURIComponent(match[1]) : undefined
  const root = match?.[2] ? decodeURIComponent(match[2]) : undefined
  const entry = match?.[3] ? decodeURIComponent(match[3]) : undefined
  const params = new URLSearchParams(search)
  const locale = params.get('locale') ?? undefined
  return {
    workspace,
    root,
    entry,
    locale
  }
}

function routeToPath(route: CmsRoute): string {
  const parts = [route.workspace, route.root, route.entry].filter(Boolean)
  if (parts.length === 0) return '/'
  return `/${parts.map(part => encodeURIComponent(part!)).join('/')}`
}

function routeToSearch(route: CmsRoute): string {
  if (!route.locale) return ''
  const params = new URLSearchParams()
  params.set('locale', route.locale)
  return `?${params.toString()}`
}

export const cmsRouteAtom = atom(
  get => {
    const {pathname = '/', search = ''} = get(locationAtom)
    return parseCmsPath(pathname, search)
  },
  (get, set, update: CmsRoute | ((prev: CmsRoute) => CmsRoute)) => {
    const location = get(locationAtom)
    const prev = parseCmsPath(location.pathname ?? '/', location.search ?? '')
    const next = typeof update === 'function' ? update(prev) : update
    const pathname = routeToPath(next)
    const search = routeToSearch(next)
    set(
      locationAtom,
      current => ({...current, pathname, search}),
      {replace: true}
    )
  }
)
