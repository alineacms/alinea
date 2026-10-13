import type {EntryDefaultView} from '#/core/Type.js'

/** A place in the dashboard to navigate to */
export interface DashboardLocation {
  /** Name of the workspace, leave out with `root` to open an entry by id */
  workspace?: string
  /** Name of the root, leave out with `workspace` to open an entry by id */
  root?: string
  /** Id of the entry to open, leave out to open the root */
  entryId?: string
  /** Locale to open, for roots with translations */
  locale?: string | null
  /**
   * Open the entry's form (`edit`) or the list of its children (`overview`),
   * for entries with both
   */
  view?: EntryDefaultView
}

/** @internal */
export const nav = {
  splash() {
    return '/'
  },
  users() {
    return '/users'
  },
  /** The editor of the entry at `url`, as linked from a page of the site */
  edit(url: string, workspace?: string, root?: string) {
    const params = new URLSearchParams({url})
    if (workspace) params.set('workspace', workspace)
    if (root) params.set('root', root)
    return `/edit?${params}`
  },
  /** The editor of an entry by id, its workspace and root are looked up */
  link(entryId: string, locale?: string | null, view?: EntryDefaultView) {
    const params = new URLSearchParams({id: entryId})
    if (locale) params.set('locale', locale)
    if (view) params.set('view', view)
    return `/edit?${params}`
  },
  entry(
    workspace?: string,
    root?: string,
    entryId?: string,
    locale?: string | null,
    view?: EntryDefaultView,
    sort?: string
  ) {
    const rootPart = root ? `${root}${locale ? `:${locale}` : ''}` : ''
    const path = `/entry/${[workspace, rootPart, entryId].filter(Boolean).join('/')}`
    const params = new URLSearchParams()
    if (view) params.set('view', view)
    if (sort) params.set('sort', sort)
    const search = params.toString()
    return search ? `${path}?${search}` : path
  }
}

/**
 * The href of a place in the dashboard, relative to the dashboard's page. An
 * entry can be linked by its id alone, its workspace and root are looked up
 * when the link opens. Outside the dashboard, prefix the dashboard's url.
 *
 * @example
 * <a href={href({entryId: post.id})}>{post.title}</a>
 * const url = `${baseUrl}/admin${href({entryId: post.id})}`
 */
export function href(location: DashboardLocation): string {
  const {workspace, root, entryId, view} = location
  const locale = location.locale ?? undefined
  if (entryId && !workspace && !root)
    return `#${nav.link(entryId, locale, view)}`
  return `#${nav.entry(workspace, root, entryId, locale, view)}`
}
