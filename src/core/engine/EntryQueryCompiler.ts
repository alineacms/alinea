import type {EntryStatus} from '../Entry.js'
import type {GraphQuery, Projection, Status} from '../Graph.js'
import {querySource} from '../Graph.js'
import type {EntryQueryConstraints} from './EntryPlanner.js'
import {unsupportedEntryGroupReason} from './EntryGroup.js'
import {unsupportedEntryOrderReason} from './EntryOrder.js'
import {unsupportedEntryProjectionReason} from './EntryProjection.js'

export function compileEntryQueryConstraints(
  query: GraphQuery
): EntryQueryConstraints | undefined {
  const unsupported = unsupportedEntryQueryReason(query)
  if (unsupported) throw new Error(`Unsupported engine query: ${unsupported}`)

  const constraints: EntryQueryConstraints = {}
  const id = stringValues(query.id)
  if (id) constraints.id = id
  const parentId = nullableStringValues(query.parentId)
  if (parentId) constraints.parentId = parentId
  const path = stringValues(query.path)
  if (path) constraints.path = path
  const url = stringValues(query.url)
  if (url) constraints.url = url
  const level = numberValues(query.level)
  if (level !== undefined) constraints.level = level
  const workspace = stringValues(query.workspace)
  if (workspace) constraints.workspace = workspace
  const root = stringValues(query.root)
  if (root) constraints.root = root
  if (query.locale !== undefined) {
    constraints.locale = query.locale
  } else if (query.preferredLocale) {
    constraints.locale = [query.preferredLocale.toLowerCase(), null]
  }
  const type = stringValues(query.type)
  if (type) constraints.type = type
  applyStatusConstraint(constraints, query.status)

  return Object.keys(constraints).length > 0 ? constraints : undefined
}

export function unsupportedEntryQueryReason(
  query: GraphQuery
): string | undefined {
  if (querySource(query)) return 'edges'
  if (query.select) {
    const reason = unsupportedEntryProjectionReason(query.select as Projection)
    if (reason) return `projection ${reason}`
  }
  if (query.include) return 'include'
  if (query.filter) return 'field filters'
  if (query.search) return 'search'
  if (query.location) return 'location'
  if (query.orderBy) {
    const reason = unsupportedEntryOrderReason(query.orderBy)
    if (reason) return `orderBy ${reason}`
  }
  if (query.groupBy) {
    const reason = unsupportedEntryGroupReason(query.groupBy)
    if (reason) return `groupBy ${reason}`
  }
  if (query.preview) return 'preview'
  if (query.type && !stringValues(query.type)) return 'non-string type'
  if (query.workspace && !stringValues(query.workspace))
    return 'non-string workspace'
  if (query.root && !stringValues(query.root)) return 'non-string root'
  if (
    query.status &&
    query.status !== 'all' &&
    query.status !== 'preferDraft' &&
    query.status !== 'preferPublished' &&
    !statusValues(query.status)
  )
    return `status "${query.status}"`
}

function stringValues(input: unknown): string | Array<string> | undefined {
  if (typeof input === 'string') return input
  if (isRecord(input) && Array.isArray(input.in)) {
    const values = input.in.filter(value => typeof value === 'string')
    if (values.length > 0) return values
  }
}

function nullableStringValues(
  input: unknown
): string | null | Array<string | null> | undefined {
  if (input === null || typeof input === 'string') return input
  if (isRecord(input) && Array.isArray(input.in)) {
    const values = input.in.filter(
      value => value === null || typeof value === 'string'
    )
    if (values.length > 0) return values
  }
}

function numberValues(input: unknown): number | Array<number> | undefined {
  if (typeof input === 'number') return input
  if (isRecord(input) && Array.isArray(input.in)) {
    const values = input.in.filter(value => typeof value === 'number')
    if (values.length > 0) return values
  }
}

function statusValues(
  input: Status | undefined
): EntryStatus | Array<EntryStatus> | undefined {
  if (!input) return undefined
  if (Array.isArray(input)) {
    const values = input.filter(isExactStatus)
    if (values.length === input.length) return values
    return
  }
  if (isExactStatus(input)) return input
}

function applyStatusConstraint(
  constraints: EntryQueryConstraints,
  input: Status | undefined
) {
  switch (input) {
    case 'all':
      return
    case 'preferDraft':
      constraints.active = true
      return
    case 'preferPublished':
      constraints.main = true
      return
    default: {
      const status = statusValues(input ?? 'published')
      if (status) constraints.status = status
    }
  }
}

function isExactStatus(input: unknown): input is EntryStatus {
  return input === 'published' || input === 'draft' || input === 'archived'
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input && typeof input === 'object')
}
