import type {GraphQuery} from '../Graph.js'
import type {EntryStatus} from '../Entry.js'
import type {EntryRowId} from './EntryRows.js'
import type {QueryTrace} from './QueryTrace.js'

export interface EntryQueryPlan<Query = GraphQuery> {
  query: Query
  constraints?: EntryQueryConstraints
  preFilter?: EntryCandidateFilter
}

export interface EntryQueryConstraints {
  id?: string | ReadonlyArray<string>
  type?: string | ReadonlyArray<string>
  workspace?: string | ReadonlyArray<string>
  root?: string | ReadonlyArray<string>
  locale?: string | null | ReadonlyArray<string | null>
  status?: EntryStatus | ReadonlyArray<EntryStatus>
  active?: true
  main?: true
  parentId?: string | null | ReadonlyArray<string | null>
  path?: string | ReadonlyArray<string>
  url?: string | ReadonlyArray<string>
  level?: number | ReadonlyArray<number>
  filePath?: string | ReadonlyArray<string>
  dir?: string | ReadonlyArray<string>
  search?: string
}

export interface EntryCandidateFilter {
  rowIds?: Iterable<EntryRowId>
  nodeIds?: Iterable<string>
  indexKeys?: Iterable<string>
}

export interface EntryQueryOptions {
  trace?: boolean
}

export interface TracedEntryQueryResult<Value> {
  value: Value
  trace: QueryTrace
}

export interface EntryCandidatePlan {
  rowIds: Array<EntryRowId>
  trace?: QueryTrace
}

export interface EntryPlanner {
  candidates(
    plan: EntryQueryPlan,
    options?: EntryQueryOptions
  ): EntryCandidatePlan
}
