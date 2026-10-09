import type {Config} from '#/core/Config.js'
import {Entry, type EntryStatus} from '#/core/Entry.js'
import {Expr} from '#/core/Expr.js'
import {Field, type FieldOptions} from '#/core/Field.js'
import type {Graph, Order, Projection} from '#/core/Graph.js'
import {getWorkspace, hasField} from '#/core/Internal.js'
import type {OrderBy} from '#/core/OrderBy.js'
import type {EntryFields} from '#/core/EntryFields.js'
import type {OpenFilter} from '#/core/Filter.js'
import {
  Overview,
  type OverviewActionProps,
  type OverviewCellProps,
  type OverviewColumn,
  type OverviewColumnAlign,
  type OverviewColumnWidth,
  type OverviewEntry,
  type OverviewFilter,
  type OverviewFormatContext,
  type OverviewOptions,
  type OverviewSort,
  type OverviewSortDirection,
  type OverviewSortOption
} from '#/core/Overview.js'
import {Root, type RootData} from '#/core/Root.js'
import {Schema} from '#/core/Schema.js'
import {getScope} from '#/core/Scope.js'
import {Type} from '#/core/Type.js'
import {isRecord} from '#/core/util/Objects.js'
import type {View} from '#/core/View.js'
import {ScalarField} from '#/core/field/ScalarField.js'
import {JsonField} from '#/field/json/JsonField.js'
import {hasAuditMetadata} from '#/field/metadata/MetadataAudit.js'
import {atom} from 'jotai'
import {graphAtom} from './core.js'
import {routeAtom} from './nav.js'

/** The columns every overview can show next to its configured columns */
export type OverviewBuiltinColumn = 'type' | 'updated' | 'author'

const builtinColumns: ReadonlyArray<OverviewBuiltinColumn> = [
  'type',
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
  format?: (value: unknown, context: OverviewFormatContext) => string
  view?: View<OverviewCellProps<unknown>>
  /** The expression to order by, undefined if the column is not sortable */
  sortBy?: Expr
}

export interface OverviewSelection {
  all?: Projection
  byType?: Record<string, Projection>
}

/** An order editors can pick, resolved against the schema */
export interface OverviewSortState {
  key: string
  label: string
  /** The values to order by, in order */
  by: Array<Expr<any>>
  /** The direction the order is first picked in */
  direction: OverviewSortDirection
}

/** A choice of an overview filter */
export interface OverviewFilterOptionState {
  key: string
  label: string
  filter: OpenFilter<EntryFields>
}

/** A filter editors can apply, resolved against the schema */
export interface OverviewFilterState {
  key: string
  label: string
  multiple: boolean
  options: Array<OverviewFilterOptionState>
}

/** The keys of the options editors picked, by the key of their filter */
export interface OverviewFilterSelection {
  [filter: string]: ReadonlyArray<string>
}

/** An overview resolved against the schema */
export interface OverviewState {
  /** The columns after the title, in order */
  columns: Array<OverviewColumnState>
  /**
   * The orders editors can pick: the declared `overview.sorts`, or the title
   * and the sortable columns
   */
  sorts: Array<OverviewSortState>
  /** The filters editors can apply */
  filters: Array<OverviewFilterState>
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

export interface OverviewResolveOptions {
  /**
   * The list can hold entries of any type, eg. search results: shows the
   * type column while the children are unknown
   */
  mixed?: boolean
  /**
   * The listed children grouped by type, see `summarizeRows`.
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
    type: children
      ? new Set(children.map(group => group.type)).size > 1
      : Boolean(options.mixed) || listed.length > 1,
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
    sorts: overview?.sorts
      ? Object.entries(overview.sorts).map(([key, option]) =>
          sortOptionState(key, option)
        )
      : columnSorts(columns),
    filters: Object.entries(overview?.filters ?? {}).map(([key, filter]) =>
      filterState(key, filter)
    ),
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

function sortOptionState(
  key: string,
  option: OverviewSortOption
): OverviewSortState {
  return {
    key,
    label: option.label,
    by: (Array.isArray(option.by) ? option.by : [option.by]).map(
      Overview.sortExpr
    ),
    direction: option.direction ?? 'asc'
  }
}

/** The orders of an overview without declared sorts: its sortable columns */
function columnSorts(
  columns: Array<OverviewColumnState>
): Array<OverviewSortState> {
  return [titleColumn, ...columns].flatMap(column =>
    column.sortBy
      ? [
          {
            key: column.key,
            label: column.header,
            by: [column.sortBy],
            direction: 'asc' as const
          }
        ]
      : []
  )
}

function filterState(key: string, filter: OverviewFilter): OverviewFilterState {
  return {
    key,
    label: filter.label,
    multiple: filter.multiple ?? false,
    options: Object.entries(filter.options).map(([key, option]) => ({
      key,
      label: option.label,
      filter: option.filter
    }))
  }
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
function isSortable(value: unknown): value is Expr {
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
): Expr | undefined {
  if (column.sortable === false) return undefined
  if (column.sortBy) return Overview.sortExpr(column.sortBy)
  if (!select) return undefined
  if (select.all !== undefined)
    return isSortable(select.all) ? select.all : undefined
  const cases = Object.entries(select.byType ?? {})
  if (!cases.every(([, value]) => isSortable(value))) return undefined
  return Overview.sortExpr(Object.fromEntries(cases) as Record<string, Expr>)
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
          ? Overview.sortExpr(column.byType as unknown as Record<string, Expr>)
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

/**
 * The order the editor picked: an option of the overview, or a sortable
 * column whose header was clicked. Undefined if it can not be ordered by.
 */
export function pickedSort(
  overview: OverviewState,
  sort: OverviewSort | undefined
): OverviewSortState | undefined {
  if (!sort) return undefined
  const option = overview.sorts.find(option => option.key === sort.column)
  if (option) return option
  return columnSorts(overview.columns).find(
    option => option.key === sort.column
  )
}

/**
 * The order of a list: the order the editor picked, or the parent's default
 * order, or undefined for the stored (manual) order
 */
export function overviewOrder(
  overview: OverviewState,
  sort: OverviewSort | undefined
): Order | Array<Order> | undefined {
  const picked = pickedSort(overview, sort)
  if (!picked || !sort) return overview.sort
  const orders = picked.by.map(expr =>
    sort.direction === 'asc' ? {asc: expr} : {desc: expr}
  )
  return orders.length === 1 ? orders[0] : orders
}

/** The column shown as sorted: the requested one or the default order */
export function sortedColumn(
  overview: OverviewState,
  sort: OverviewSort | undefined
): OverviewSort | undefined {
  // A picked option keyed like a sortable column shows on its header
  if (sort && pickedSort(overview, sort)) {
    const columns = [titleColumn, ...overview.columns]
    const sortable = columns.some(
      column => column.key === sort.column && column.sortBy
    )
    return sortable ? sort : undefined
  }
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

/**
 * The options the editor picked that apply to an overview: options of its
 * filters, at most one for filters that do not allow several
 */
export function pickedFilters(
  overview: OverviewState,
  selection: OverviewFilterSelection
): OverviewFilterSelection {
  const picked: Record<string, Array<string>> = {}
  for (const filter of overview.filters) {
    const keys = filter.options
      .filter(option => selection[filter.key]?.includes(option.key))
      .map(option => option.key)
    if (keys.length === 0) continue
    picked[filter.key] = filter.multiple ? keys : keys.slice(0, 1)
  }
  return picked
}

/**
 * The condition of the picked filters: entries match every filter, and any
 * of the options picked of a filter. Undefined when nothing is picked.
 */
export function overviewFilter(
  overview: OverviewState,
  selection: OverviewFilterSelection
): OpenFilter<EntryFields> | undefined {
  const picked = pickedFilters(overview, selection)
  const conditions = overview.filters.flatMap(filter => {
    const options = filter.options.filter(option =>
      picked[filter.key]?.includes(option.key)
    )
    if (options.length === 0) return []
    if (options.length === 1) return [options[0].filter]
    return [{or: options.map(option => option.filter)}]
  })
  if (conditions.length === 0) return undefined
  if (conditions.length === 1) return conditions[0]
  return {and: conditions}
}

/** The rows an overview renders, as loaded by the explorer or an EntryTable */
export interface OverviewRow {
  id: string
  type: string
  title: string
  path: string
  url?: string
  status?: EntryStatus
  /** The version is the main one, a draft then was never published */
  main?: boolean
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
    const label = Field.label(field)
    return Field.references(field, row.data[name], {
      path: [name],
      label,
      labels: [label]
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

/** The listed children that share a type */
export interface OverviewChildren {
  type: string
  /** Some of these children store when they were last edited */
  updatedAt: boolean
  /** Some of these children store who last edited them */
  updatedBy: boolean
}

/**
 * Groups rows by type, noting whether they store audit
 * metadata. Lists load every child of their parent and searches their
 * shown results, so this covers every row and the columns stay put.
 */
export function summarizeRows(
  rows: ReadonlyArray<OverviewRow>
): Array<OverviewChildren> {
  const groups = new Map<string, OverviewChildren>()
  for (const row of rows) {
    const group = groups.get(row.type) ?? {
      type: row.type,
      updatedAt: false,
      updatedBy: false
    }
    group.updatedAt ||= hasAuditValue(row, 'updatedAt')
    group.updatedBy ||= hasAuditValue(row, 'updatedBy')
    groups.set(row.type, group)
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
