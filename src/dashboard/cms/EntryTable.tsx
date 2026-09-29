import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  Spinner,
  Table,
  TableCell,
  type TableColumn,
  TableRow,
  TableTitle
} from '#/components.js'
import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import type {EntryFields} from '#/core/EntryFields.js'
import type {OpenFilter} from '#/core/Filter.js'
import {
  getRoot,
  getType,
  getWorkspace,
  hasRoot,
  hasType
} from '#/core/Internal.js'
import type {OrderBy} from '#/core/OrderBy.js'
import type {
  OverviewColumn,
  OverviewOptions,
  OverviewSort
} from '#/core/Overview.js'
import type {Root} from '#/core/Root.js'
import {Schema} from '#/core/Schema.js'
import {getScope} from '#/core/Scope.js'
import {Type} from '#/core/Type.js'
import {configAtom} from '#/dashboard/atoms/core.js'
import {
  entryTableKey,
  entryTableRowsAtom,
  type EntryTableRequest
} from '#/dashboard/atoms/entryTable.js'
import type {ExplorerItemData} from '#/dashboard/atoms/explorer.js'
import {
  openEntryAtom,
  overviewOrder,
  type OverviewState,
  resolveOverviewOptions,
  sortedColumn,
  titleColumn,
  summarizeRows
} from '#/dashboard/atoms/overview.js'
import {
  OverviewCell,
  overviewCellText,
  overviewTableColumn
} from '#/dashboard/app/OverviewCell.js'
import {useLocale} from '#/dashboard/hooks.js'
import {LucideFile} from '#/dashboard/icons.js'
import styler from '@alinea/styler'
import {
  atom,
  useAtomValueRaw,
  useAtomValueRawSync,
  useSetAtom,
  useStore
} from 'jotai'
import {unwrap} from 'jotai/utils'
import {
  type CSSProperties,
  Suspense,
  startTransition,
  use,
  useMemo
} from 'react'
import css from './EntryTable.module.css'

const styles = styler(css)

/** Height of the header and of a row of the table in pixels */
const headerHeight = 34
const rowHeight = 44
/** Rows shown before the table scrolls */
const visibleRows = 10

/** Props of the EntryTable component */
export interface EntryTableProps {
  /** List entries of this type, or of these types */
  type?: Type | Array<Type>
  /**
   * Only list entries matching this filter, like the `filter` of a query,
   * eg. `{brand: {has: {_entry: entryId}}}`
   */
  filter?: OpenFilter<EntryFields>
  /** Only list entries of this workspace */
  workspace?: string
  /** Only list entries of this root */
  root?: string
  /** Only list the children of this entry, null for the top level */
  parentId?: string | null
  /**
   * Show the columns and default order of this overview, or of the root or
   * type that configures it. Defaults to the overview of the root or type
   * that contains `type`.
   */
  overview?: OverviewOptions | Type | Root
  /** Show these columns instead of those of the overview */
  columns?: Record<string, OverviewColumn>
  /** The default order, defaults to the overview's `sort`, then the title */
  sort?: OrderBy | Array<OrderBy>
  /** The locale of the entries, defaults to the locale in the dashboard */
  locale?: string | null
  /** The maximum number of rows */
  limit?: number
  /** Shown when no entries match */
  emptyMessage?: string
  'aria-label'?: string
  className?: string
  style?: CSSProperties
}

/**
 * A table of entries with the columns of an overview: sortable headers and
 * rows that open the entry. Use it in custom views, eg. to list the products
 * of a brand on the brand's entry.
 *
 * @example
 * <EntryTable
 *   type={Product}
 *   overview={productsOverview}
 *   filter={{brand: {has: {_entry: entry.id}}}}
 * />
 */
export function EntryTable(props: EntryTableProps) {
  return (
    <Suspense fallback={<EntryTableLoading {...props} />}>
      <EntryTableContent {...props} />
    </Suspense>
  )
}

function EntryTableLoading({className, style}: EntryTableProps) {
  return (
    <div
      data-slot="entry-table"
      className={styles.EntryTable(styler.merge({className}))}
      style={style}
    >
      <div className={styles.EntryTable.loading()}>
        <Spinner aria-label="Loading entries" />
      </div>
    </div>
  )
}

function typeNames(config: Config, type: EntryTableProps['type']) {
  if (!type) return []
  const names = Schema.typeNames(config.schema)
  return (Array.isArray(type) ? type : [type]).flatMap(inner => {
    const name = names.get(inner)
    return name ? [name] : []
  })
}

/** The overview of the root or type that contains the given types */
function containingOverview(
  config: Config,
  types: Array<string>
): OverviewOptions | undefined {
  if (types.length === 0) return undefined
  const contains = (list: Array<string | Type> | undefined) => {
    const names = Schema.contained(config.schema, list ?? [])
    return types.every(type => names.includes(type))
  }
  for (const workspace of Object.values(config.workspaces))
    for (const root of Object.values(getWorkspace(workspace).roots)) {
      const data = getRoot(root)
      if (data.overview?.columns && contains(data.contains))
        return data.overview
    }
  for (const type of Object.values(config.schema)) {
    const overview = Type.overview(type)
    if (overview?.columns && contains(Type.contains(type))) return overview
  }
  return undefined
}

function overviewOf(
  config: Config,
  props: EntryTableProps,
  types: Array<string>
): OverviewOptions | undefined {
  const {overview} = props
  if (!overview) return containingOverview(config, types)
  if (hasType(overview)) return getType(overview).overview
  if (hasRoot(overview)) return getRoot(overview).overview
  return overview as OverviewOptions
}

function EntryTableContent(props: EntryTableProps) {
  const config = useAtomValueRaw(configAtom)
  const store = useStore()
  const openEntry = useSetAtom(openEntryAtom)
  const contextLocale = useLocale()
  const locale = props.locale === undefined ? contextLocale : props.locale
  const types = typeNames(config, props.type)
  const configured = overviewOf(config, props, types)
  const overview: OverviewState = resolveOverviewOptions(
    config,
    props.columns ? {...configured, columns: props.columns} : configured,
    types,
    props.sort ?? configured?.sort ?? {asc: Entry.title},
    {mixed: types.length !== 1}
  )
  const scope = getScope(config)
  const request: EntryTableRequest = {
    query: {
      type: props.type,
      filter: props.filter,
      workspace: props.workspace,
      root: props.root,
      parentId: props.parentId,
      preferredLocale: locale ?? undefined,
      take: props.limit,
      status: 'preferDraft'
    },
    columns: overview.columns
      .filter(column => !column.builtin)
      .map(column => ({
        key: column.key,
        select: column.select,
        formatted: Boolean(column.format || column.view)
      }))
  }
  const sorts = [overview.sort, ...overview.columns.map(c => c.sortBy)]
  const key = scope.stringify({request, sorts})
  const atoms = useMemo(() => {
    const requested = atom<OverviewSort | undefined>(undefined)
    const ready = atom(get => {
      const sort = get(requested)
      return get(
        entryTableRowsAtom(
          entryTableKey(scope, {
            ...request,
            query: {...request.query, orderBy: overviewOrder(overview, sort)}
          })
        )
      )
    })
    return {requested, ready, rows: unwrap(ready, previous => previous)}
    // The key holds everything the request depends on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const requested = useAtomValueRaw(atoms.requested)
  const setRequested = useSetAtom(atoms.requested)
  const loaded = useAtomValueRawSync(atoms.rows)
  const rows = loaded ?? use(store.get(atoms.ready))
  const shown = resolveOverviewOptions(
    config,
    props.columns ? {...configured, columns: props.columns} : configured,
    types,
    overview.sort,
    // All rows are loaded, so they tell which columns set them apart
    {children: summarizeRows(rows)}
  )
  const sorted = sortedColumn(shown, requested)
  const columns: Array<TableColumn> = [
    {
      id: titleColumn.key,
      header: titleColumn.header,
      width: '2fr',
      minWidth: 200,
      sortable: true
    },
    ...shown.columns.map(overviewTableColumn)
  ]
  // The table virtualizes its rows, so it needs a height
  const height =
    headerHeight +
    Math.min(Math.max(rows.length, 2), visibleRows) * rowHeight +
    2
  return (
    <div
      data-slot="entry-table"
      className={styles.EntryTable(styler.merge({className: props.className}))}
      style={{height, ...props.style}}
    >
      <Table
        aria-label={props['aria-label'] ?? 'Entries'}
        className={styles.EntryTable.table()}
        rowHeight={rowHeight}
        items={rows}
        columns={columns}
        dependencies={[shown]}
        sortDescriptor={sorted}
        onSortChange={descriptor =>
          startTransition(() =>
            setRequested({
              column: String(descriptor.column),
              direction: descriptor.direction
            })
          )
        }
        onRowAction={key => {
          const row = rows.find(row => row.id === key)
          void openEntry(String(key), row?.locale ?? locale)
        }}
        renderEmptyState={() => (
          <Empty>
            <EmptyHeader>
              <EmptyDescription>
                {props.emptyMessage ?? 'No entries found'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      >
        {row => <EntryTableRow config={config} overview={shown} row={row} />}
      </Table>
    </div>
  )
}

interface EntryTableRowProps {
  config: Config
  overview: OverviewState
  row: ExplorerItemData
}

function EntryTableRow({config, overview, row}: EntryTableRowProps) {
  const type = config.schema[row.type]
  const links = useMemo(
    () => new Map(Object.entries(row.linked ?? {})),
    [row.linked]
  )
  const texts = overview.columns.map(column =>
    overviewCellText(config, column, row, links)
  )
  return (
    <TableRow
      id={row.id}
      textValue={[row.title, ...texts].filter(Boolean).join(' ')}
    >
      <TableTitle
        icon={(type && getType(type).icon) || LucideFile}
        title={row.title}
      />
      {overview.columns.map((column, index) => (
        <TableCell
          key={column.key}
          align={column.align}
          title={texts[index] || undefined}
        >
          <OverviewCell column={column} row={row} links={links} />
        </TableCell>
      ))}
    </TableRow>
  )
}
