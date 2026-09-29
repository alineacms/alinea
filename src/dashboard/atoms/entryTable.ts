import {Entry} from '#/core/Entry.js'
import type {GraphQuery} from '#/core/Graph.js'
import {getScope} from '#/core/Scope.js'
import type {Type} from '#/core/Type.js'
import {atom} from 'jotai'
import {configAtom, graphAtom} from './core.js'
import {type ExplorerItemData, withLinkedEntries} from './explorer.js'
import {shaAtom} from './graph.js'
import {
  loadColumnValues,
  type OverviewSelection,
  type OverviewState
} from './overview.js'
import {policyAtom} from './user.js'
import {dispense} from './utils.js'

/** What an EntryTable loads, serialized with the config's scope */
export interface EntryTableRequest {
  query: GraphQuery<undefined, Type | Array<Type> | undefined, undefined>
  /** The columns whose values are loaded, `formatted` columns are queried */
  columns: Array<{key: string; select?: OverviewSelection; formatted: boolean}>
}

/** A key for the rows of an EntryTable, stable across renders */
export function entryTableKey(
  scope: ReturnType<typeof getScope>,
  request: EntryTableRequest
): string {
  return scope.stringify(request)
}

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
 * The rows of an EntryTable, keyed by the serialized query and columns so a
 * table keeps its data between renders and shares it with equal tables
 */
export const entryTableRowsAtom = dispense((key: string) =>
  atom(async (get): Promise<Array<ExplorerItemData>> => {
    get(shaAtom)
    const config = get(configAtom)
    const graph = get(graphAtom)
    const policy = get(policyAtom)
    const request = getScope(config).parse<EntryTableRequest>(key)
    const found = await graph.find({
      ...request.query,
      groupBy: Entry.id,
      select: rowSelect
    })
    const readable = found
      .filter(row => policy.canRead(row))
      .map(row => ({...row, hasChildren: false}))
    // Columns rendered with format or view are always queried
    const overview: OverviewState = {
      columns: request.columns.map(column => ({
        key: column.key,
        header: column.key,
        width: '1fr',
        collapsible: true,
        select: column.select,
        format: column.formatted ? String : undefined
      })),
      actions: [],
      types: []
    }
    const rows = await loadColumnValues(config, graph, overview, readable)
    return withLinkedEntries(get, overview, rows)
  })
)
