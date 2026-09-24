import type {Config} from '#/core/Config.js'
import {Entry, type EntryStatus} from '#/core/Entry.js'
import {Expr} from '#/core/Expr.js'
import {Field, type FieldOptions} from '#/core/Field.js'
import type {Graph, Order, Projection} from '#/core/Graph.js'
import {getWorkspace, hasField} from '#/core/Internal.js'
import type {OrderBy} from '#/core/OrderBy.js'
import {
  Overview,
  type OverviewActionProps,
  type OverviewCellProps,
  type OverviewColumn,
  type OverviewColumnAlign,
  type OverviewColumnWidth,
  type OverviewEntry,
  type OverviewFormatContext,
  type OverviewOptions,
  type OverviewSort
} from '#/core/Overview.js'
import {Root, type RootData} from '#/core/Root.js'
import {Schema} from '#/core/Schema.js'
import {getScope} from '#/core/Scope.js'
import {Type} from '#/core/Type.js'
import {isRecord} from '#/core/util/Objects.js'
import type {View} from '#/core/View.js'
import {ScalarField} from '#/core/field/ScalarField.js'
import {JsonField} from '#/field/json/JsonField.js'
import {MetadataField} from '#/field/metadata/MetadataField.js'
import {atom} from 'jotai'
import {graphAtom} from './core.js'
import {routeAtom} from './nav.js'

/** The columns every overview can show next to its configured columns */
export type OverviewBuiltinColumn = 'type' | 'status' | 'updated' | 'author'

const builtinColumns: ReadonlyArray<OverviewBuiltinColumn> = [
  'type',
  'status',
  'updated',
  'author'
]

/** The number of `overview: true` fields shown when a parent has no columns */
export const overviewFieldColumnLimit = 5

/** Where a list of entries lives, its overview is configured there */
export type OverviewParent =
  | {kind: 'root'; data: RootData}
  | {kind: 'type'; name: string; type: Type}
  | {kind: 'none'}

/** A column of an overview, resolved against the schema */
export interface OverviewColumnState {
  key: string
  header: string
  builtin?: OverviewBuiltinColumn
  width: OverviewColumnWidth
  minWidth?: number
  align?: OverviewColumnAlign
  collapsible: boolean
  /** The projection per type name, `all` applies to entries of any type */
  select?: OverviewSelection
  format?: (value: any, context: OverviewFormatContext) => string
  view?: View<OverviewCellProps<any>>
  /** The expression to order by, undefined if the column is not sortable */
  sortBy?: Expr<any>
}

export interface OverviewSelection {
  all?: Projection
  byType?: Record<string, Projection>
}

/** An overview resolved against the schema */
export interface OverviewState {
  /** The columns after the title, in order */
  columns: Array<OverviewColumnState>
  /** The order children are listed in when the editor did not sort */
  sort?: OrderBy | Array<OrderBy>
  layout?: 'table' | 'cards'
  thumbnail?: OverviewSelection
  actions: Array<View<OverviewActionProps>>
  /** The names of the types the parent contains */
  types: Array<string>
}

/** The title column, always shown first */
export const titleColumn = {
  key: 'title',
  header: 'Title',
  sortBy: Entry.title
} as const

/** The name of the entry updating an entry, stored in its metadata */
const updatedByName = new Expr<string>({
  type: 'entryField',
  name: 'name',
  path: ['metadata', 'updatedBy']
})

function builtinColumn(key: OverviewBuiltinColumn): OverviewColumnState {
  switch (key) {
    case 'type':
      return {
        key,
        builtin: key,
        header: 'Type',
        width: 140,
        collapsible: true,
        sortBy: Entry.type
      }
    case 'status':
      return {
        key,
        builtin: key,
        header: 'Status',
        width: 120,
        collapsible: true,
        sortBy: Entry.status
      }
    case 'updated':
      return {
        key,
        builtin: key,
        header: 'Updated',
        width: 140,
        collapsible: true,
        sortBy: Entry.updatedAt
      }
    case 'author':
      return {
        key,
        builtin: key,
        header: 'Author',
        width: '1fr',
        minWidth: 120,
        collapsible: true,
        sortBy: updatedByName
      }
  }
}

/** The overview configured on a parent */
export function parentOverview(
  parent: OverviewParent
): OverviewOptions | undefined {
  if (parent.kind === 'root') return parent.data.overview
  if (parent.kind === 'type') return Type.overview(parent.type)
  return undefined
}

/** The default order of the children of a parent */
export function parentOrder(
  parent: OverviewParent
): OrderBy | Array<OrderBy> | undefined {
  if (parent.kind === 'root') return Root.childrenOrder(parent.data)
  if (parent.kind === 'type') return Type.childrenOrder(parent.type)
  return undefined
}

/** The names of the types a parent accepts as children */
export function parentTypes(config: Config, parent: OverviewParent) {
  const contains =
    parent.kind === 'root'
      ? (parent.data.contains ?? [])
      : parent.kind === 'type'
        ? Type.contains(parent.type)
        : []
  return Schema.contained(config.schema, contains).filter(name =>
    Boolean(config.schema[name])
  )
}

/** Whether entries of a type store who edited them and when */
function hasAuditMetadata(type: Type) {
  return Type.field(type, 'metadata') instanceof MetadataField
}

export interface OverviewResolveOptions {
  /** The list holds entries of several parents, eg. search results */
  mixed?: boolean
  /**
   * The listed children grouped by type and status, see `summarizeRows`.
   * The columns then follow the children: the types present, and built-in
   * columns only when they tell the children apart.
   */
  children?: ReadonlyArray<OverviewChildren>
}

/** Resolves the columns and settings of the overview of a parent */
export function resolveOverview(
  config: Config,
  parent: OverviewParent,
  options: OverviewResolveOptions = {}
): OverviewState {
  return resolveOverviewOptions(
    config,
    parentOverview(parent),
    parentTypes(config, parent),
    parentOrder(parent),
    options
  )
}

/**
 * The types of a list: the types of its children when they are known,
 * otherwise the types the parent accepts, or any type
 */
function listedTypes(
  config: Config,
  types: Array<string>,
  children: ReadonlyArray<OverviewChildren> | undefined
): Array<string> {
  const schemaTypes = Object.keys(config.schema)
  if (children?.length) {
    const present = new Set(children.map(group => group.type))
    return schemaTypes.filter(name => present.has(name))
  }
  if (types.length > 0 || children) return types
  return schemaTypes
}

/** Resolves an overview for a list of entries of the given types */
export function resolveOverviewOptions(
  config: Config,
  overview: OverviewOptions | undefined,
  types: Array<string>,
  sort: OrderBy | Array<OrderBy> | undefined,
  options: OverviewResolveOptions = {}
): OverviewState {
  const typeNames = new Set(Object.keys(config.schema))
  const {children} = options
  const listed = listedTypes(config, types, children)
  const childTypes = listed.flatMap(name =>
    config.schema[name] ? [config.schema[name]] : []
  )
  const configured = overview?.columns
    ? Object.entries(overview.columns).filter(
        ([key]) => key !== titleColumn.key
      )
    : undefined
  const custom = configured
    ? configured.map(([key, column]) => customColumn(key, column, typeNames))
    : fieldColumns(config, listed)
  const byKey = new Map(custom.map(column => [column.key, column]))
  const builtins = overview?.builtins ?? {}
  const audited = childTypes.some(hasAuditMetadata)
  // With the children known, built-in columns show when they differ
  const defaults: Record<OverviewBuiltinColumn, boolean> = {
    type: Boolean(options.mixed) || listed.length > 1,
    status: children
      ? new Set(children.map(group => group.status)).size > 1
      : true,
    updated: children ? children.some(group => group.updatedAt) : audited,
    author: children ? children.some(group => group.updatedBy) : audited
  }
  const atStart = new Set(
    (configured ?? [])
      .filter(([, column]) => column.position === 'start')
      .map(([key]) => key)
  )
  const isBuiltinKey = (key: string) =>
    builtinColumns.includes(key as OverviewBuiltinColumn)
  const columns = custom.filter(
    column => atStart.has(column.key) && !isBuiltinKey(column.key)
  )
  for (const key of builtinColumns) {
    const replacement = byKey.get(key)
    if (replacement) {
      columns.push(replacement)
      continue
    }
    if (builtins[key] ?? defaults[key]) columns.push(builtinColumn(key))
  }
  for (const column of custom)
    if (!atStart.has(column.key) && !isBuiltinKey(column.key))
      columns.push(column)
  return {
    columns,
    sort,
    layout: overview?.layout,
    thumbnail: overview?.thumbnail
      ? selection(overview.thumbnail, typeNames)
      : undefined,
    actions: overview?.actions ?? [],
    types: listed
  }
}

function selection(
  select: unknown,
  typeNames: ReadonlySet<string>
): OverviewSelection {
  if (Overview.isSelectByType(select, typeNames)) return {byType: select}
  return {all: select as Projection}
}

function customColumn(
  key: string,
  column: OverviewColumn,
  typeNames: ReadonlySet<string>
): OverviewColumnState {
  const select =
    column.select === undefined
      ? undefined
      : selection(column.select, typeNames)
  return {
    key,
    header: column.header,
    width: column.width ?? '1fr',
    minWidth: column.minWidth ?? (column.width === undefined ? 120 : undefined),
    align: column.align,
    collapsible: column.collapsible ?? true,
    select,
    format: column.format,
    view: column.view,
    sortBy: columnSortBy(column, select)
  }
}

/**
 * Whether values of an expression can be ordered: expressions on the entry
 * and fields holding a single value, not links, lists or rich text
 */
function isSortable(value: unknown): value is Expr<any> {
  if (!Overview.isPlainExpr(value)) return false
  if (!hasField(value)) return true
  const field = value as Field
  return (
    field instanceof ScalarField &&
    !(field instanceof JsonField) &&
    !Array.isArray(Field.initialValue(field))
  )
}

/**
 * Columns that select fields or expressions of the entry sort by them,
 * columns of linked entries only sort with `sortBy`
 */
function columnSortBy(
  column: OverviewColumn,
  select: OverviewSelection | undefined
): Expr<any> | undefined {
  if (column.sortable === false) return undefined
  if (column.sortBy) return Overview.sortExpr(column.sortBy)
  if (!select) return undefined
  if (select.all !== undefined)
    return isSortable(select.all) ? select.all : undefined
  const cases = Object.entries(select.byType ?? {})
  if (!cases.every(([, value]) => isSortable(value))) return undefined
  return Overview.sortExpr(
    Object.fromEntries(cases) as Record<string, Expr<any>>
  )
}

/**
 * The deprecated `overview: true` field option: when a parent has no
 * columns, the marked fields of the types it contains become columns. A
 * field shared by name across types is one column, types without it show
 * an empty cell.
 */
function fieldColumns(
  config: Config,
  types: Array<string>
): Array<OverviewColumnState> {
  const columns = new Map<
    string,
    {header: string; byType: Record<string, Field>}
  >()
  for (const typeName of types) {
    const type = config.schema[typeName]
    if (!type) continue
    for (const [key, field] of Object.entries(Type.fields(type))) {
      const options = Field.options(field) as FieldOptions<unknown>
      if (options.hidden || options.overview !== true || key === 'title')
        continue
      const column = columns.get(key) ?? {
        header: Field.label(field),
        byType: {}
      }
      column.byType[typeName] = field
      columns.set(key, column)
    }
  }
  return [...columns.entries()]
    .slice(0, overviewFieldColumnLimit)
    .map(([key, column]) => {
      const byType = column.byType as Record<string, Projection>
      const select: OverviewSelection =
        Object.keys(byType).length === types.length &&
        new Set(Object.values(byType)).size === 1
          ? {all: Object.values(byType)[0]}
          : {byType}
      return {
        key,
        header: column.header,
        width: '1fr',
        minWidth: 120,
        collapsible: true,
        select,
        sortBy: Object.values(column.byType).every(isSortable)
          ? Overview.sortExpr(
              column.byType as unknown as Record<string, Expr<any>>
            )
          : undefined
      }
    })
}

/** The projection a column selects for entries of a type */
export function columnProjection(
  select: OverviewSelection | undefined,
  typeName: string
): Projection | undefined {
  if (!select) return undefined
  if (select.all !== undefined) return select.all
  return select.byType?.[typeName]
}

/**
 * The field a column shows with the compact field rendering, read from the
 * entry data: the column selects a field and neither formats nor renders it
 */
export function columnField(
  config: Config,
  column: OverviewColumnState,
  typeName: string
): [name: string, field: Field] | undefined {
  if (column.format || column.view) return undefined
  const projection = columnProjection(column.select, typeName)
  if (!projection || !isRecord(projection) || !hasField(projection))
    return undefined
  const name = getScope(config).nameOf(projection as Field)
  if (!name) return undefined
  const type = config.schema[typeName]
  const field = type ? Type.field(type, name) : undefined
  return field ? [name, field] : undefined
}

/** The image field an overview's cards show for entries of a type */
export function thumbnailField(
  config: Config,
  overview: OverviewState,
  typeName: string
): [name: string, field: Field] | undefined {
  const projection = columnProjection(overview.thumbnail, typeName)
  if (!projection || !isRecord(projection) || !hasField(projection))
    return undefined
  const name = getScope(config).nameOf(projection as Field)
  const type = config.schema[typeName]
  const field = name && type ? Type.field(type, name) : undefined
  return name && field ? [name, field] : undefined
}

/** The column the editor sorted by, or undefined if it is not sortable */
export function sortColumn(
  overview: OverviewState,
  sort: OverviewSort | undefined
): {header: string; sortBy: Expr<any>} | undefined {
  if (!sort) return undefined
  if (sort.column === titleColumn.key) return titleColumn
  const column = overview.columns.find(column => column.key === sort.column)
  if (!column?.sortBy) return undefined
  return {header: column.header, sortBy: column.sortBy}
}

/**
 * The order of a list: the column the editor sorted by, or the parent's
 * default order, or undefined for the stored (manual) order
 */
export function overviewOrder(
  overview: OverviewState,
  sort: OverviewSort | undefined
): Order | Array<Order> | undefined {
  const column = sortColumn(overview, sort)
  if (column && sort)
    return sort.direction === 'asc'
      ? {asc: column.sortBy}
      : {desc: column.sortBy}
  return overview.sort
}

/** The column shown as sorted: the requested one or the default order */
export function sortedColumn(
  overview: OverviewState,
  sort: OverviewSort | undefined
): OverviewSort | undefined {
  if (sortColumn(overview, sort)) return sort
  const [first] = Array.isArray(overview.sort)
    ? overview.sort
    : overview.sort
      ? [overview.sort]
      : []
  if (!first) return undefined
  const expr = first.asc ?? first.desc
  const direction = first.asc ? 'asc' : 'desc'
  if (expr === titleColumn.sortBy) return {column: titleColumn.key, direction}
  const column = overview.columns.find(column => column.sortBy === expr)
  return column ? {column: column.key, direction} : undefined
}

/** The rows an overview renders, as loaded by the explorer or an EntryTable */
export interface OverviewRow {
  id: string
  type: string
  title: string
  path: string
  url?: string
  status?: EntryStatus
  locale: string | null
  workspace: string
  root: string
  parentId: string | null
  data: Record<string, unknown>
  /** The values of the columns that are queried, by column key */
  columns?: Record<string, unknown>
}

export function overviewEntry(row: OverviewRow): OverviewEntry {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    path: row.path,
    url: row.url ?? '',
    status: row.status ?? 'published',
    locale: row.locale,
    workspace: row.workspace,
    root: row.root,
    parentId: row.parentId
  }
}

/** The ids of the entries linked from the compact field columns of a row */
export function columnLinkIds(
  config: Config,
  overview: OverviewState,
  row: OverviewRow
): Array<string> {
  return overview.columns.flatMap(column => {
    const resolved = columnField(config, column, row.type)
    if (!resolved) return []
    const [name, field] = resolved
    return Field.references(field, row.data[name], {
      path: [name],
      label: Field.label(field)
    }).map(reference => reference.targetId)
  })
}

/**
 * Loads the values of the columns that are not read from the entry data,
 * one query per type and locale
 */
export async function loadColumnValues<Row extends OverviewRow>(
  config: Config,
  graph: Graph,
  overview: OverviewState,
  rows: Array<Row>
): Promise<Array<Row>> {
  const groups = new Map<string, Array<Row>>()
  for (const row of rows) {
    const key = `${row.type}\u0000${row.locale ?? ''}`
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }
  const values = new Map<string, Record<string, unknown>>()
  await Promise.all(
    [...groups.values()].map(async group => {
      const [{type, locale}] = group
      const select: Record<string, Projection> = {}
      for (const column of overview.columns) {
        if (column.builtin || columnField(config, column, type)) continue
        const projection = columnProjection(column.select, type)
        if (projection !== undefined) select[column.key] = projection
      }
      if (Object.keys(select).length === 0) return
      const found = (await graph.find({
        id: {in: group.map(row => row.id)},
        locale,
        status: 'preferDraft',
        select: {id: Entry.id, values: select}
      })) as Array<{id: string; values: Record<string, unknown>}>
      for (const {id, values: row} of found)
        values.set(`${id}\u0000${locale ?? ''}`, row)
    })
  )
  if (values.size === 0) return rows
  return rows.map(row => {
    const columns = values.get(`${row.id}\u0000${row.locale ?? ''}`)
    return columns ? {...row, columns} : row
  })
}

/** The parent of a list of entries, where its overview is configured */
export async function loadOverviewParent(
  config: Config,
  graph: Graph,
  location: {workspace: string; root?: string; parentId?: string | null}
): Promise<OverviewParent> {
  if (location.parentId) {
    const typeName = (await graph.first({
      id: location.parentId,
      status: 'preferDraft',
      select: Entry.type
    })) as string | null
    const type = typeName ? config.schema[typeName] : undefined
    return type && typeName
      ? {kind: 'type', name: typeName, type}
      : {kind: 'none'}
  }
  if (!location.root) return {kind: 'none'}
  const workspace = config.workspaces[location.workspace]
  const root = workspace
    ? getWorkspace(workspace).roots[location.root]
    : undefined
  return root && Root.isRoot(root)
    ? {kind: 'root', data: Root.data(root)}
    : {kind: 'none'}
}

/** Whether a value can be rendered as an entry link */
export function linkedEntryId(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined
  if (typeof value._entry === 'string') return value._entry
  if (typeof value.entryId === 'string') return value.entryId
  if (typeof value.id === 'string' && typeof value.title === 'string')
    return value.id
  return undefined
}

/** Opens an entry in the dashboard, eg. an entry linked from a cell */
export const openEntryAtom = atom(
  null,
  async (get, set, id: string, locale: string | null) => {
    const found = await get(graphAtom).find({
      id,
      status: 'preferDraft',
      select: {
        workspace: Entry.workspace,
        root: Entry.root,
        locale: Entry.locale
      }
    })
    const entry =
      found.find(candidate => candidate.locale === locale) ??
      found.find(candidate => candidate.locale === null) ??
      found[0]
    if (!entry) return
    set(routeAtom, {
      workspace: entry.workspace,
      root: entry.root,
      entry: id,
      locale: entry.locale ?? undefined
    })
  }
)

/** The listed children that share a type and status */
export interface OverviewChildren {
  type: string
  status: EntryStatus
  /** Some of these children store when they were last edited */
  updatedAt: boolean
  /** Some of these children store who last edited them */
  updatedBy: boolean
}

/**
 * Groups rows by type and status, noting whether they store audit
 * metadata. Lists load every child of their parent, so this covers all of
 * them and the columns stay put.
 */
export function summarizeRows(
  rows: ReadonlyArray<OverviewRow>
): Array<OverviewChildren> {
  const groups = new Map<string, OverviewChildren>()
  for (const row of rows) {
    const status = row.status ?? 'published'
    const key = `${row.type}\u0000${status}`
    const group = groups.get(key) ?? {
      type: row.type,
      status,
      updatedAt: false,
      updatedBy: false
    }
    group.updatedAt ||= hasAuditValue(row, 'updatedAt')
    group.updatedBy ||= hasAuditValue(row, 'updatedBy')
    groups.set(key, group)
  }
  return [...groups.values()]
}

/** Whether a row stores when or by whom it was last edited */
function hasAuditValue(row: OverviewRow, key: 'updatedAt' | 'updatedBy') {
  const metadata = row.data.metadata
  if (!isRecord(metadata)) return false
  const value = metadata[key]
  if (key === 'updatedAt') return typeof value === 'number'
  return isRecord(value) && typeof value.name === 'string' && value.name !== ''
}
