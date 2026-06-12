export interface DashboardRoute {
  workspace?: string
  root?: string
  entry?: string
  locale?: string
}

export const nav = {
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
