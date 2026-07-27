export interface Route {
  page: 'entry' | 'users'
  workspace?: string
  root?: string
  entry?: string
  locale?: string
}

export type RouteUpdate = Partial<Route>

export type DashboardRoute = RouteUpdate

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
