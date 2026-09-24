import {
  Table,
  TableCell,
  type TableColumn,
  TableRow,
  TableTitle,
  type DragDropProps,
  type IconType,
  type Selection
} from '#/components.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValueRaw, useSetAtom} from 'jotai'
import type {ReactNode} from 'react'
import {startTransition, useMemo} from 'react'
import {configAtom} from '../atoms/core.js'
import type {
  DashboardEntry,
  DashboardEntryData,
  DashboardExplorer,
  ExplorerItemData,
  ExplorerLinkedEntry,
  ExplorerReadyPage
} from '../atoms/explorer.js'
import {titleColumn as overviewTitle} from '../atoms/overview.js'
import {LucideFile, LucideFolder} from '../icons.js'
import css from './ExplorerTable.module.css'
import {
  OverviewCell,
  overviewCellText,
  overviewTableColumn
} from './OverviewCell.js'

const styles = styler(css)

const titleColumn: TableColumn = {
  id: overviewTitle.key,
  header: overviewTitle.header,
  width: '2fr',
  minWidth: 200,
  sortable: true
}

const compactTitleColumn: TableColumn = {
  id: 'title',
  header: 'Title',
  width: '1fr',
  minWidth: 0
}

const compactColumns = [compactTitleColumn]

interface ExplorerTableRowProps {
  entry: DashboardEntry
  breadcrumbs: boolean
  compact: boolean
  explorer: DashboardExplorer
  locale: string | null
  page: ExplorerReadyPage
}

interface ExplorerTableDisplayRowProps extends ExplorerTableRowProps {
  item?: ExplorerItemData
  links?: ReadonlyMap<string, ExplorerLinkedEntry>
  hasChildren: boolean
  icon: IconType
  isSelectable: boolean
  label: string
  parents: Array<DashboardEntry>
  rootLabel?: string
}

interface ExplorerTableBreadcrumbsProps {
  entries: Array<DashboardEntry>
  rootLabel?: string
}

function ExplorerTableBreadcrumbs({
  entries,
  rootLabel
}: ExplorerTableBreadcrumbsProps) {
  return (
    <span className={styles.ExplorerTable.breadcrumbs()}>
      {entries.length === 0 && rootLabel && (
        <span
          className={styles.ExplorerTable.breadcrumb.root()}
          title={rootLabel}
        >
          {rootLabel}
        </span>
      )}
      {entries.map((entry, index) => (
        <span key={entry.id} className={styles.ExplorerTable.breadcrumb()}>
          <ExplorerTableBreadcrumb entry={entry} index={index} />
        </span>
      ))}
    </span>
  )
}

interface ExplorerTableBreadcrumbProps {
  entry: DashboardEntry
  index: number
}

function ExplorerTableBreadcrumb({entry, index}: ExplorerTableBreadcrumbProps) {
  const {data} = useAtomValueRaw(entry.data)
  if (!data) return null
  return <ExplorerTableLoadedBreadcrumb data={data} index={index} />
}

interface ExplorerTableLoadedBreadcrumbProps {
  data: DashboardEntryData
  index: number
}

function ExplorerTableLoadedBreadcrumb({
  data,
  index
}: ExplorerTableLoadedBreadcrumbProps) {
  const label = useAtomValueRaw(data.label)
  const root = useAtomValueRaw(data.root)
  const rootLabel = useAtomValueRaw(root.label)
  return (
    <>
      {index === 0 && (
        <span
          className={styles.ExplorerTable.breadcrumb.root()}
          title={rootLabel}
        >
          {rootLabel}
        </span>
      )}
      <span
        className={styles.ExplorerTable.breadcrumb.label()}
        title={label}
      >{`/ ${label}`}</span>
    </>
  )
}

function ExplorerTableDisplayRow(props: ExplorerTableDisplayRowProps) {
  const {
    breadcrumbs,
    item,
    compact,
    entry,
    explorer,
    hasChildren,
    icon,
    isSelectable,
    label,
    links,
    parents,
    rootLabel
  } = props
  const config = useAtomValueRaw(configAtom)
  const columns = props.page.overview.columns
  const isExpanded = useAtomValueRaw(
    useMemo(() => explorer.isExpanded(entry), [explorer, entry])
  )
  const onAction = useSetAtom(explorer.onAction)
  const openLocation = useSetAtom(explorer.openLocation)
  const setExpandedKeys = useSetAtom(explorer.expandedKeys)
  const canExpandOnAction =
    !isSelectable && hasChildren && explorer.supportsInlineExpansion
  const hasAction = explorer.hasRowAction || canExpandOnAction
  function performAction() {
    if (canExpandOnAction) {
      setExpandedKeys(current => new Set(current).add(entry.id))
      return
    }
    onAction(entry, props.locale)
  }
  function enterParent() {
    startTransition(() => openLocation(entry))
  }
  const cellTexts = useMemo(
    () =>
      item
        ? columns.map(column => overviewCellText(config, column, item, links))
        : [],
    [columns, config, item, links]
  )
  const textValue = [label, ...cellTexts].filter(Boolean).join(' ')
  return (
    <TableRow
      id={entry.id}
      textValue={textValue}
      hasChildren={hasChildren}
      selectable={isSelectable}
      highlighted={explorer.linkedKeys.has(entry.id)}
      onAction={
        hasAction && explorer.mode !== 'search' ? performAction : undefined
      }
      onClick={
        hasAction && explorer.mode === 'search' ? performAction : undefined
      }
      onDoubleClick={hasChildren ? enterParent : undefined}
      rows={
        hasChildren && isExpanded ? (
          <ExplorerTableChildren {...props} />
        ) : undefined
      }
    >
      <TableTitle
        icon={icon}
        title={label}
        label={
          breadcrumbs ? (
            <ExplorerTableBreadcrumbs entries={parents} rootLabel={rootLabel} />
          ) : undefined
        }
      />
      {!compact &&
        columns.map((column, index) => (
          <TableCell
            key={column.key}
            align={column.align}
            title={cellTexts[index] || undefined}
          >
            {item && <OverviewCell column={column} row={item} links={links} />}
          </TableCell>
        ))}
    </TableRow>
  )
}

function ExplorerTableChildren(props: ExplorerTableDisplayRowProps) {
  const children = useAtomValueRaw(
    useMemo(
      () => props.explorer.children(props.entry, props.locale),
      [props.entry, props.explorer, props.locale]
    )
  )
  return children.map(child => (
    <ExplorerTableRow
      key={child.id}
      breadcrumbs={props.breadcrumbs}
      compact={props.compact}
      entry={child}
      explorer={props.explorer}
      locale={props.locale}
      page={props.page}
    />
  ))
}

function ExplorerTableLoadingRow(props: ExplorerTableRowProps) {
  return (
    <ExplorerTableDisplayRow
      {...props}
      hasChildren={false}
      icon={LucideFile}
      isSelectable={false}
      label="Loading entry"
      parents={[]}
    />
  )
}

interface ExplorerTableLoadedRowProps extends ExplorerTableRowProps {
  data: DashboardEntryData
}

function ExplorerTableLoadedRow({
  data,
  explorer,
  ...props
}: ExplorerTableLoadedRowProps) {
  const root = useAtomValueRaw(data.root)
  const rootLabel = useAtomValueRaw(root.label)
  const label = useAtomValueRaw(data.label)
  const configuredIcon = useAtomValueRaw(data.icon)
  const hasChildren = useAtomValueRaw(data.hasChildren)
  const item = useAtomValueRaw(data.item)
  const links = useAtomValueRaw(data.linked)
  const parents = useAtomValueRaw(data.parents)
  const isSelectable = useAtomValueRaw(
    useMemo(() => explorer.isSelectable(props.entry), [explorer, props.entry])
  )
  return (
    <ExplorerTableDisplayRow
      {...props}
      item={item}
      explorer={explorer}
      hasChildren={
        props.page.resultMode === 'browse' &&
        explorer.supportsInlineExpansion &&
        hasChildren
      }
      icon={configuredIcon ?? (hasChildren ? LucideFolder : LucideFile)}
      isSelectable={isSelectable}
      label={label}
      links={links}
      parents={parents}
      rootLabel={rootLabel}
    />
  )
}

function ExplorerTableRow(props: ExplorerTableRowProps) {
  const {data, pending} = useAtomValueRaw(props.entry.data)
  if (pending || !data) return <ExplorerTableLoadingRow {...props} />
  return <ExplorerTableLoadedRow {...props} data={data} />
}

export interface ExplorerTableProps {
  compact?: boolean
  dragDrop: DragDropProps
  explorer: DashboardExplorer
  items: Array<DashboardEntry>
  onSelectionChange?: (selection: Selection) => void
  page: ExplorerReadyPage
  renderEmptyState: () => ReactNode
  locale: string | null
}

export function ExplorerTable({
  compact = false,
  dragDrop,
  explorer,
  items,
  onSelectionChange,
  page,
  renderEmptyState,
  locale
}: ExplorerTableProps) {
  const [selected, setSelected] = useAtom(explorer.selection)
  const [expandedKeys, setExpandedKeys] = useAtom(explorer.expandedKeys)
  const sort = useSetAtom(explorer.sort)
  const columns = useMemo(
    () => [titleColumn, ...page.overview.columns.map(overviewTableColumn)],
    [page.overview]
  )
  const sortDescriptor = page.sort.column
    ? {column: page.sort.column.column, direction: page.sort.column.direction}
    : undefined
  const selectionMode = explorer.selectionMode
  const search = useAtomValueRaw(explorer.search)
  const isSearching = Boolean(search.trim())
  const breadcrumbs =
    explorer.breadcrumbs ||
    page.resultMode === 'matches' ||
    isSearching ||
    page.searchesEverything
  const hasSelection = selectionMode !== 'none'
  const showSelectionControls =
    hasSelection &&
    explorer.showSelectionControls &&
    (!compact || selectionMode === 'multiple')

  function changeSelection(selection: Selection) {
    setSelected(selection === 'all' ? 'all' : new Set(selection))
    onSelectionChange?.(selection)
  }

  return (
    <div
      id={explorer.resultsId}
      className={styles.ExplorerTable.viewport({compact})}
    >
      <Table
        {...dragDrop}
        aria-label="Explorer entries"
        className={styles.ExplorerTable()}
        variant={compact ? 'plain' : 'surface'}
        columns={compact ? compactColumns : columns}
        showHeader={!compact}
        sortDescriptor={sortDescriptor}
        onSortChange={
          isSearching
            ? undefined
            : descriptor =>
                startTransition(() =>
                  sort({
                    column: String(descriptor.column),
                    direction: descriptor.direction
                  })
                )
        }
        expandable={explorer.supportsInlineExpansion}
        dependencies={[breadcrumbs, compact, locale, page]}
        items={items}
        selectionMode={selectionMode}
        selectionBehavior={explorer.selectionBehavior}
        showSelectionControls={showSelectionControls}
        selectedKeys={hasSelection ? selected : undefined}
        onSelectionChange={hasSelection ? changeSelection : undefined}
        expandedKeys={expandedKeys}
        onExpandedChange={setExpandedKeys}
        renderEmptyState={renderEmptyState}
      >
        {item => (
          <ExplorerTableRow
            breadcrumbs={breadcrumbs}
            compact={compact}
            entry={item}
            explorer={explorer}
            locale={locale}
            page={page}
          />
        )}
      </Table>
    </div>
  )
}
