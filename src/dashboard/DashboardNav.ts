export type EntryLocation = {
  id?: string
  workspace?: string
  root?: string
  locale?: string
  alinea?: {
    workspace?: string
    root?: string
  }
}

export const navMatchers = {
  matchEntry: '/entry/*',
  matchEntryId: '/:action/:workspace/:root/:id',
  matchWorkspace: '/:action/:workspace',
  matchRoot: '/:action/:workspace/:root'
} as const

export function dashboardNav(defaults: Partial<EntryLocation>) {
  function loc(location: EntryLocation) {
    const workspace =
      location.workspace ?? location.alinea?.workspace ?? defaults.workspace
    const root = location.root ?? location.alinea?.root ?? defaults.root
    const locale = 'locale' in location ? location.locale : defaults.locale
    const id = 'id' in location ? location.id : defaults.id
    const rootLocation = locale ? `${root}:${locale}` : root
    if (!id && !root) return `/${workspace}`
    if (!id) return `/${workspace}/${rootLocation}`
    return `/${workspace}/${rootLocation}/${id}`
  }
  function root(location: EntryLocation) {
    return entry(location)
  }
  function entry(location: EntryLocation) {
    return `/entry${loc(location)}`
  }
  function create(location: EntryLocation) {
    return entry(location) + '?new'
  }
  function draft(location: EntryLocation) {
    return `/draft${loc(location)}`
  }
  return {
    root,
    entry,
    draft,
    create,
    ...navMatchers
  }
}
