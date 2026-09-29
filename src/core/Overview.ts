import type {EntryStatus} from './Entry.js'
import type {EntryFields} from './EntryFields.js'
import {Expr} from './Expr.js'
import type {OpenFilter} from './Filter.js'
import type {
  EdgeQuery,
  GraphQuery,
  InferProjection,
  Projection
} from './Graph.js'
import {getExpr, hasExpr} from './Internal.js'
import type {OrderBy} from './OrderBy.js'
import type {Type} from './Type.js'
import {isRecord, values} from './util/Objects.js'
import type {View} from './View.js'

/** Horizontal alignment of a column's header and cells */
export type OverviewColumnAlign = 'start' | 'end' | 'center'

/** Where a column goes relative to the built-in columns */
export type OverviewColumnPosition = 'start' | 'end'

/** A fixed width in pixels or a fraction of the remaining space */
export type OverviewColumnWidth = number | `${number}fr`

/**
 * A value to sort entries by: an expression such as a field, or a query of a
 * linked entry that selects a single expression, eg.
 * `Product.brand.first({select: Entry.title})`
 */
export type OverviewSortValue = Expr<any> | EdgeQuery<Expr<any>>

/** One projection per entry type, keyed by the type names of the schema */
export interface OverviewSelectByType {
  [typeName: string]: Projection
}

/** One sort value per entry type, keyed by the type names of the schema */
export interface OverviewSortByType {
  [typeName: string]: OverviewSortValue
}

/** What a column selects: a query projection or one per entry type */
export type OverviewColumnSelect = Projection | OverviewSelectByType

type StringKeys<T> = Exclude<keyof T, number | symbol>

/** Per type selects are keyed by type names, which start with a capital */
type IsSelectByType<Select> =
  Select extends Expr<any>
    ? false
    : Select extends {edge: string}
      ? false
      : Select extends object
        ? StringKeys<Select> extends Capitalize<StringKeys<Select>>
          ? true
          : false
        : false

/** The value a column's `format` and `view` receive for its `select` */
export type OverviewColumnValue<Select> = [Select] extends [undefined]
  ? undefined
  : IsSelectByType<Select> extends true
    ? {[K in keyof Select]: InferProjection<Select[K]>}[keyof Select]
    : InferProjection<Select>

/** The entry a cell or action renders for */
export interface OverviewEntry {
  id: string
  type: string
  title: string
  path: string
  url: string
  status: EntryStatus
  locale: string | null
  workspace: string
  root: string
  parentId: string | null
}

/** Context passed to a column's `format` function */
export interface OverviewFormatContext {
  /** The locale of the listed entry, null for unlocalised roots */
  locale: string | null
}

/** Props of a column `view` component */
export interface OverviewCellProps<Value = unknown> {
  /** The selected value */
  value: Value
  /** The entry of the row */
  entry: OverviewEntry
  /** The key of the column in `overview.columns` */
  column: string
  locale: string | null
}

/** The direction of an order: ascending or descending */
export type OverviewSortDirection = 'asc' | 'desc'

/** The order the editor picked for the overview */
export interface OverviewSort {
  /**
   * A key of `overview.sorts`, of `overview.columns`, or a built-in column:
   * `title`, `type`, `status`, `updated`, `author`
   */
  column: string
  direction: OverviewSortDirection
}

/** One value an overview sort option orders by */
export type OverviewSortBy = OverviewSortValue | OverviewSortByType

/** An order editors can pick in the "Filter and sort" menu of an overview */
export interface OverviewSortOption {
  /** Shown in the menu, eg. `Title A–Z` */
  label: string
  /**
   * The value to order by, or several: later values order the entries that
   * share the earlier ones. Values are the same as a column's `sortBy`.
   */
  by: OverviewSortBy | Array<OverviewSortBy>
  /** The direction the option orders in when picked, defaults to `asc` */
  direction?: OverviewSortDirection
  /**
   * Picking the option again reverses its direction, defaults to true. Set to
   * false for options that name their direction, eg. `Title Z–A`.
   */
  reversible?: boolean
  /**
   * List the children in this order until the editor picks another. Like
   * `overview.sort`, which takes precedence, children can then not be
   * reordered by hand.
   */
  default?: boolean
}

/** One choice of an overview filter */
export interface OverviewFilterOption {
  /** Shown in the menu, eg. `PDF` */
  label: string
  /** The condition entries match when the option is picked */
  filter: OpenFilter<EntryFields>
}

/** A filter editors can apply in the "Filter and sort" menu of an overview */
export interface OverviewFilter {
  /** The heading of the options in the menu, eg. `File type` */
  label: string
  /** The choices, keyed by a name that is unique within the filter */
  options: Record<string, OverviewFilterOption>
  /**
   * Editors can pick several options, entries then match any of them.
   * Defaults to false: picking an option replaces the picked one.
   */
  multiple?: boolean
}

/** Props of an `overview.actions` view */
export interface OverviewActionProps {
  workspace: string
  root: string
  /** The entry whose children are listed, null for the root */
  parentId: string | null
  locale: string | null
  /** The search terms entered in the overview */
  search: string
  /** The column the overview is sorted by, if the editor sorted it */
  sort: OverviewSort | undefined
  /**
   * A query for the listed entries in their current order, without paging.
   * Pass it to `useGraph().find({...query, select})`, eg. to export them.
   */
  query: GraphQuery<undefined, Type | Array<Type> | undefined, undefined>
}

interface OverviewColumnBase<Value> {
  /** The column header */
  header: string
  /**
   * Order by this value when the column is sorted. Needed to sort columns
   * that select linked entries, which are not sortable otherwise.
   */
  sortBy?: OverviewSortValue | OverviewSortByType
  /**
   * Columns that select a field or expression, and columns with `sortBy`, are
   * sortable. Set to false to opt out.
   */
  sortable?: boolean
  /** Format the selected value as text */
  format?: (value: Value, context: OverviewFormatContext) => string
  /** A React component that renders the cell */
  view?: View<OverviewCellProps<Value>>
  /** A fixed width in pixels or a fraction of the remaining space */
  width?: OverviewColumnWidth
  /** Minimum width in pixels of a fractional column */
  minWidth?: number
  align?: OverviewColumnAlign
  /** Hide the column on narrow screens, defaults to true */
  collapsible?: boolean
  /**
   * Where the column goes: `start` places it right after the title, before
   * the built-in columns (eg. a thumbnail), `end` after them. Defaults to
   * `end`. Columns keep their order within each position.
   */
  position?: OverviewColumnPosition
}

export interface OverviewColumnOptions<
  Select,
  Value
> extends OverviewColumnBase<Value> {
  /**
   * What the column shows: a query projection (a field, an expression, a
   * linked entry query or an object of those) or one projection per entry
   * type, eg. `{BlogPost: BlogPost.author, Event: Event.organiser}`. Entries
   * whose type has no projection show an empty cell.
   */
  select?: Select
}

/** A column of an overview, create one with `Config.column` */
export interface OverviewColumn<Value = any> extends OverviewColumnBase<Value> {
  select?: OverviewColumnSelect
}

/**
 * Which built-in columns an overview shows. By default a built-in column
 * only shows when it tells the listed entries apart. Set one to true to
 * always show it, or false to never show it.
 */
export interface OverviewBuiltins {
  /** The entry type, shown by default when the children have several types */
  type?: boolean
  /** The publication status, shown by default when the statuses differ */
  status?: boolean
  /** When the entry was last edited, shown by default when recorded */
  updated?: boolean
  /** Who last edited the entry, shown by default when recorded */
  author?: boolean
}

/** Configures how the dashboard lists the children of a root or entry */
export interface OverviewOptions {
  /**
   * Columns shown after the title and the built-in columns, or before the
   * built-in columns with `position: 'start'`. A column keyed `type`,
   * `status`, `updated` or `author` replaces that built-in column.
   */
  columns?: Record<string, OverviewColumn>
  /** Show or hide the built-in columns */
  builtins?: OverviewBuiltins
  /**
   * The default order of the children, in the overview and the sidebar tree.
   * Children can not be reordered by hand when set.
   */
  sort?: OrderBy | Array<OrderBy>
  /**
   * The orders editors can pick, keyed by a name kept in the url. A key that
   * matches a column also orders that column when its header is clicked.
   * Defaults to the title and the sortable columns.
   */
  sorts?: Record<string, OverviewSortOption>
  /**
   * Filters editors can apply to the listed children. Entries match every
   * applied filter, and the search terms.
   */
  filters?: Record<string, OverviewFilter>
  /** The default layout, editors can still switch */
  layout?: 'table' | 'cards'
  /**
   * The image shown on cards: an image field, or one per entry type.
   * Defaults to the first image found in the entry's fields.
   */
  thumbnail?: Expr<any> | Record<string, Expr<any>>
  /** Components rendered in the overview toolbar, eg. an export button */
  actions?: Array<View<OverviewActionProps>>
}

/** Create a column for an overview */
export function column<
  const Select extends OverviewColumnSelect | undefined = undefined
>(
  options: OverviewColumnOptions<Select, OverviewColumnValue<Select>>
): OverviewColumn<OverviewColumnValue<Select>> {
  return options as OverviewColumn<OverviewColumnValue<Select>>
}

export namespace Overview {
  /** The views referenced by an overview, bundled with the dashboard */
  export function referencedViews(
    overview: OverviewOptions | undefined
  ): Array<string> {
    if (!overview) return []
    const views: Array<unknown> = [
      ...(overview.actions ?? []),
      ...values(overview.columns ?? {}).map(column => column.view)
    ]
    return views.filter((view): view is string => typeof view === 'string')
  }

  /** Whether a column select holds one projection per entry type */
  export function isSelectByType(
    select: unknown,
    typeNames: ReadonlySet<string>
  ): select is OverviewSelectByType {
    if (!isRecord(select) || hasExpr(select) || 'edge' in select) return false
    const keys = Object.keys(select)
    return keys.length > 0 && keys.every(key => typeNames.has(key))
  }

  /**
   * An expression to order by: expressions are used as is, linked entry
   * queries become a subquery and per type values a switch on the entry type
   */
  export function sortExpr(
    value: OverviewSortValue | OverviewSortByType
  ): Expr<any> {
    if (hasExpr(value)) return value as Expr<any>
    if ('edge' in value)
      return new Expr({type: 'relation', query: value as EdgeQuery})
    const cases: Record<string, Expr> = {}
    for (const [typeName, inner] of Object.entries(value as OverviewSortByType))
      cases[typeName] = sortExpr(inner)
    return new Expr({type: 'typeSwitch', cases})
  }

  /** The values a sort option orders by, in order */
  export function sortValues(option: OverviewSortOption): Array<Expr<any>> {
    const by = Array.isArray(option.by) ? option.by : [option.by]
    return by.map(sortExpr)
  }

  /** The order of a sort option in a direction, defaults to its own */
  export function sortOrder(
    option: OverviewSortOption,
    direction: OverviewSortDirection = option.direction ?? 'asc'
  ): Array<OrderBy> {
    return sortValues(option).map(expr =>
      direction === 'asc' ? {asc: expr} : {desc: expr}
    )
  }

  /**
   * The default order of the children: `overview.sort`, or the sort option
   * marked as default
   */
  export function defaultOrder(
    overview: OverviewOptions | undefined
  ): OrderBy | Array<OrderBy> | undefined {
    if (!overview) return undefined
    if (overview.sort) return overview.sort
    const option = values(overview.sorts ?? {}).find(option => option.default)
    return option ? sortOrder(option) : undefined
  }

  /** Whether an expression reads the entry, rather than a linked entry */
  export function isPlainExpr(value: unknown): value is Expr<any> {
    if (!isRecord(value) || !hasExpr(value)) return false
    const internal = getExpr(value as Expr)
    return internal.type === 'field' || internal.type === 'entryField'
  }
}
