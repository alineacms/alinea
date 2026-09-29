import {Entry} from '#/core/Entry.js'
import type {GraphQuery} from '#/core/Graph.js'
import type {Type} from '#/core/Type.js'
import type {Getter} from 'jotai'
import {configAtom, graphAtom} from './core.js'
import {type ExplorerItemData, withLinkedEntries} from './explorer.js'
import {shaAtom} from './graph.js'
import {loadColumnValues, type OverviewState} from './overview.js'
import {policyAtom} from './user.js'

const rowSelect = {
  id: Entry.id,
  status: Entry.status,
  title: Entry.title,
  path: Entry.path,
  url: Entry.url,
  type: Entry.type,
  workspace: Entry.workspace,
  root: Entry.root,
  locale: Entry.locale,
  parentId: Entry.parentId,
  parents: Entry.parents,
  index: Entry.index,
  data: Entry.data
}

/**
 * Loads the rows of an EntryTable with the values of the overview columns
 * and the entries they link to
 */
export async function loadEntryTableRows(
  get: Getter,
  query: GraphQuery<undefined, Type | Array<Type> | undefined, undefined>,
  overview: OverviewState
): Promise<Array<ExplorerItemData>> {
  get(shaAtom)
  const config = get(configAtom)
  const graph = get(graphAtom)
  const policy = get(policyAtom)
  const found = await graph.find({
    ...query,
    groupBy: Entry.id,
    select: rowSelect
  })
  const readable = found
    .filter(row => policy.canRead(row))
    .map(row => ({...row, hasChildren: false}))
  const rows = await loadColumnValues(config, graph, overview, readable)
  // The table shows no thumbnails
  return withLinkedEntries(get, overview, rows, false)
}
