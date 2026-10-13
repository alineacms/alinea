import type {DashboardEntry} from '#/core/DashboardEntry.js'
import {Entry} from '#/core/Entry.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {Resolver} from '#/core/Resolver.js'

/** An entry that no longer exists after a commit */
export interface RemovedEntry {
  id: string
  type: string
  locale: string | null
  /** The url the entry had before the commit */
  url: string
}

const select = {
  id: Entry.id,
  type: Entry.type,
  title: Entry.title,
  path: Entry.path,
  url: Entry.url,
  locale: Entry.locale,
  status: Entry.status,
  workspace: Entry.workspace,
  root: Entry.root,
  parentId: Entry.parentId,
  data: Entry.data
}

function entryIds(mutations: ReadonlyArray<Mutation>): Array<string> {
  const ids = mutations.map(mutation => ('id' in mutation ? mutation.id : ''))
  return [...new Set(ids.filter(Boolean))] as Array<string>
}

/**
 * The latest version, in every locale, of the entries that mutations change
 */
export async function committedEntries(
  resolver: Resolver,
  mutations: ReadonlyArray<Mutation>
): Promise<Array<DashboardEntry>> {
  const ids = entryIds(mutations)
  if (ids.length === 0) return []
  return (await resolver.resolve({
    id: {in: ids},
    status: 'preferDraft',
    select
  })) as Array<DashboardEntry>
}

/** The entries of `before` that are not in `after` */
export function removedEntries(
  before: Array<DashboardEntry>,
  after: Array<DashboardEntry>
): Array<RemovedEntry> {
  const key = (entry: DashboardEntry) => `${entry.id}:${entry.locale}`
  const remaining = new Set(after.map(key))
  return before
    .filter(entry => !remaining.has(key(entry)))
    .map(({id, type, locale, url}) => ({id, type, locale, url}))
}
