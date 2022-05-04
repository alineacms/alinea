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
    if (!id && !root) return `/${workspace}`
    if (!id) return `/${workspace}/${rootLocation}`
    return `/${workspace}/${rootLocation}/${id}`
  }
  function create(location: EntryLocation) {
    return entry(location) + '?new'
  }
  return {root, entry, create}
}
