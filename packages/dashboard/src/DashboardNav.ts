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
    const {
      workspace = defaults.workspace,
      root = defaults.root,
      locale = defaults.locale,
      id = defaults.id
    } = location
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
