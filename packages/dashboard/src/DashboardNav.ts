type EntryLocation = {
  workspace: string
  root?: string
  locale?: string
  id?: string
}

export function dashboardNav(defaults: Partial<EntryLocation>) {
  function root(
    location: Pick<EntryLocation, 'workspace' | 'root' | 'locale'>
  ) {
    return entry(location)
  }
  function entry(location: EntryLocation) {
    const workspace =
      'workspace' in location ? location.workspace : defaults.workspace
    const root = 'root' in location ? location.root : defaults.root
    const locale = 'locale' in location ? location.locale : defaults.locale
    const id = 'id' in location ? location.id : defaults.id
    const rootLocation = locale ? `${root}:${locale}` : root
    if (!id && !root) return `/entry/${workspace}`
    if (!id) return `/entry/${workspace}/${rootLocation}`
    return `/entry/${workspace}/${rootLocation}/${id}`
  }
  function create(location: EntryLocation) {
    return entry(location) + '?new'
  }
  function drafts(location: EntryLocation) {
    const workspace =
      'workspace' in location ? location.workspace : defaults.workspace
    return `/drafts/${workspace}`
  }
  return {
    root,
    entry,
    create,
    drafts,
    matchEntry: '/entry/*' as const,
    matchWorkspace: '/:action/:workspace/*' as const,
    matchRoot: '/:action/:workspace/:root/*' as const
  }
}
