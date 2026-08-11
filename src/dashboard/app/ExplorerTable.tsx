import {Checkbox, FoldIcon, Icon, Surface} from '#/components.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import type {ComponentType, ReactNode} from 'react'
import {useMemo} from 'react'
import {
  Button as AriaButton,
  Collection,
  ListLayout,
  Tree,
  TreeItem,
  TreeItemContent,
  Virtualizer,
  type DragAndDropHooks
} from 'react-aria-components'
import type {ListLayoutOptions} from 'react-stately/useVirtualizerState'
import {LucideFile, LucideFolder} from '../icons.js'
import type {
  DashboardEntry,
  DashboardEntryData,
  DashboardEntryOverviewCell,
  DashboardExplorer
} from '../atoms/explorer.js'
import {dashboardEntryOverviewColumnCount} from '../atoms/explorer.js'
import {CompactField, compactFieldText} from './CompactField.js'
import css from './ExplorerTable.module.css'

const styles = styler(css)

interface ExplorerTableColumn {
  id: string
  index?: number
  kind: 'selection' | 'title' | 'overview' | 'filler'
  minWidth?: number
  width: number | '1fr'
}

interface ExplorerTableRowProps {
  columns: Array<ExplorerTableColumn>
  entry: DashboardEntry
  breadcrumbs: boolean
  explorer: DashboardExplorer
  gridTemplateColumns: string
}

interface ExplorerTableDisplayRowProps extends ExplorerTableRowProps {
  cells: Array<DashboardEntryOverviewCell>
  hasChildren: boolean
  icon: ComponentType
  isSelectable: boolean
  label: string
  parents: Array<DashboardEntry>
  rootLabel?: string
}

interface ExplorerTableCellProps extends ExplorerTableDisplayRowProps {
  column: ExplorerTableColumn
  expanded: boolean
  level: number
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
        <span className={styles.ExplorerTable.breadcrumb.root()}>
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
  const {data} = useAtomValue(entry.data)
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
  const label = useAtomValue(data.label)
  const root = useAtomValue(data.root)
  const rootLabel = useAtomValue(root.label)
  return (
    <>
      {index === 0 && (
        <span className={styles.ExplorerTable.breadcrumb.root()}>
          {rootLabel}
        </span>
      )}
      <span
        className={styles.ExplorerTable.breadcrumb.label()}
      >{`/ ${label}`}</span>
    </>
  )
}

function ExplorerTableCell({
  breadcrumbs,
  cells,
  column,
  expanded,
  explorer,
  hasChildren,
  icon,
  isSelectable,
  label,
  level,
  parents,
  rootLabel
}: ExplorerTableCellProps) {
  if (column.kind === 'selection') {
    return (
      <div className={styles.ExplorerTable.cell.selection()} role="gridcell">
        <Checkbox
          slot="selection"
          className={styles.ExplorerTable.checkbox()}
          aria-label={`Select ${label}`}
          isDisabled={!isSelectable}
        />
      </div>
    )
  }
  if (column.kind === 'title') {
    return (
      <div
        className={styles.ExplorerTable.cell.title()}
        role="gridcell"
        style={{paddingLeft: 10 + Math.max(0, level - 1) * 20}}
      >
        {explorer.supportsInlineExpansion && (
          <span className={styles.ExplorerTable.chevron()}>
            {hasChildren && (
              <AriaButton
                slot="chevron"
                className={styles.ExplorerTable.chevron.button()}
                aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
              >
                <FoldIcon aria-hidden expanded={expanded} />
              </AriaButton>
            )}
          </span>
        )}
        <AriaButton
          slot="drag"
          className={styles.ExplorerTable.iconDrag()}
          aria-label={`Drag ${label}`}
        >
          <Icon
            aria-hidden
            icon={icon}
            className={styles.ExplorerTable.icon()}
          />
        </AriaButton>
        <span className={styles.ExplorerTable.field()}>
          {breadcrumbs && (
            <span className={styles.ExplorerTable.field.label()}>
              <ExplorerTableBreadcrumbs
                entries={parents}
                rootLabel={rootLabel}
              />
            </span>
          )}
          <span className={styles.ExplorerTable.field.value()}>{label}</span>
        </span>
      </div>
    )
  }
  if (column.kind === 'filler')
    return (
      <div className={styles.ExplorerTable.cell.filler()} role="gridcell" />
    )
  const cell =
    typeof column.index === 'number' ? cells[column.index] : undefined
  return (
    <div
      className={styles.ExplorerTable.cell()}
      role="gridcell"
      title={
        cell
          ? `${cell.label} ${compactFieldText(cell.field, cell.value)}`
          : undefined
      }
    >
      {cell && (
        <span className={styles.ExplorerTable.field()}>
          <span className={styles.ExplorerTable.field.label()}>
            {cell.label}
          </span>
          <span className={styles.ExplorerTable.field.value()}>
            <CompactField field={cell.field} value={cell.value} />
          </span>
        </span>
      )}
    </div>
  )
}

function ExplorerTableDisplayRow(props: ExplorerTableDisplayRowProps) {
  const {
    cells,
    columns,
    entry,
    explorer,
    gridTemplateColumns,
    hasChildren,
    label
  } = props
  const isExpanded = useAtomValue(
    useMemo(() => explorer.isExpanded(entry), [explorer, entry])
  )
  const onAction = useSetAtom(explorer.onAction)
  const textValue = useMemo(
    () =>
      [label, ...cells.map(cell => compactFieldText(cell.field, cell.value))]
        .filter(Boolean)
        .join(' '),
    [cells, label]
  )
  return (
    <TreeItem
      id={entry.id}
      textValue={textValue}
      hasChildItems={hasChildren}
      className={styles.ExplorerTable.row()}
      isDisabled={!props.isSelectable}
      onAction={
        explorer.hasRowAction && explorer.mode !== 'search'
          ? () => onAction(entry)
          : undefined
      }
      onPress={
        explorer.hasRowAction && explorer.mode === 'search'
          ? () => onAction(entry)
          : undefined
      }
    >
      <TreeItemContent>
        {({isExpanded: expanded, level}) => (
          <div
            className={styles.ExplorerTable.row.grid()}
            role="presentation"
            style={{gridTemplateColumns}}
          >
            {columns.map(column => (
              <ExplorerTableCell
                {...props}
                column={column}
                expanded={expanded}
                key={column.id}
                level={level}
              />
            ))}
          </div>
        )}
      </TreeItemContent>
      {hasChildren && isExpanded && <ExplorerTableChildren {...props} />}
    </TreeItem>
  )
}

function ExplorerTableChildren(props: ExplorerTableDisplayRowProps) {
  const children = useAtomValue(
    useMemo(
      () => props.explorer.children(props.entry),
      [props.entry, props.explorer]
    )
  )
  if (children.length === 0) return null
  return (
    <Collection items={children}>
      {child => (
        <ExplorerTableRow
          breadcrumbs={props.breadcrumbs}
          columns={props.columns}
          entry={child}
          explorer={props.explorer}
          gridTemplateColumns={props.gridTemplateColumns}
        />
      )}
    </Collection>
  )
}

function ExplorerTableLoadingRow(props: ExplorerTableRowProps) {
  return (
    <ExplorerTableDisplayRow
      {...props}
      cells={[]}
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
  const root = useAtomValue(data.root)
  const rootLabel = useAtomValue(root.label)
  const label = useAtomValue(data.label)
  const configuredIcon = useAtomValue(data.icon)
  const hasChildren = useAtomValue(data.hasChildren)
  const cells = useAtomValue(data.overviewCells)
  const parents = useAtomValue(data.parents)
  const isSelectable = useAtomValue(
    useMemo(() => explorer.isSelectable(props.entry), [explorer, props.entry])
  )
  return (
    <ExplorerTableDisplayRow
      {...props}
      cells={cells}
      explorer={explorer}
      hasChildren={explorer.supportsInlineExpansion && hasChildren}
      icon={configuredIcon ?? (hasChildren ? LucideFolder : LucideFile)}
      isSelectable={isSelectable}
      label={label}
      parents={parents}
      rootLabel={rootLabel}
    />
  )
}

function ExplorerTableRow(props: ExplorerTableRowProps) {
  const {data, pending} = useAtomValue(props.entry.data)
  if (pending || !data) return <ExplorerTableLoadingRow {...props} />
  return <ExplorerTableLoadedRow {...props} data={data} />
}

export interface ExplorerTableProps {
  dragAndDropHooks: DragAndDropHooks<DashboardEntry>
  explorer: DashboardExplorer
  items: Array<DashboardEntry>
  renderEmptyState: () => ReactNode
}

export function ExplorerTable({
  dragAndDropHooks,
  explorer,
  items,
  renderEmptyState
}: ExplorerTableProps) {
  const [selected, setSelected] = useAtom(explorer.selection)
  const [expandedKeys, setExpandedKeys] = useAtom(explorer.expandedKeys)
  const selectionMode = explorer.selectionMode
  const search = useAtomValue(explorer.search)
  const isSearching = Boolean(search.trim())
  const breadcrumbs = explorer.breadcrumbs || isSearching
  const hasSelection = selectionMode !== 'none'
  const showSelectionControls = hasSelection && explorer.showSelectionControls
  const columns = useMemo<Array<ExplorerTableColumn>>(
    () => [
      ...(showSelectionControls
        ? [{id: 'selection', kind: 'selection' as const, width: 30}]
        : []),
      {id: 'title', kind: 'title', width: 220},
      ...Array.from(
        {length: dashboardEntryOverviewColumnCount},
        (_, index) => ({
          id: `overview-${index}`,
          index,
          kind: 'overview' as const,
          minWidth: 120,
          width: '1fr' as const
        })
      )
    ],
    [showSelectionControls]
  )
  const gridTemplateColumns = useMemo(
    () =>
      columns
        .map(column =>
          column.width === '1fr'
            ? `minmax(${column.minWidth ?? 0}px, 1fr)`
            : `${column.width}px`
        )
        .join(' '),
    [columns]
  )
  const layoutOptions = useMemo<ListLayoutOptions>(
    () => ({
      rowHeight: 44,
      padding: 0,
      gap: 0
    }),
    []
  )
  return (
    <div className={styles.ExplorerTable.viewport()}>
      <Surface className={styles.ExplorerTable.surface()}>
        <Virtualizer layout={ListLayout} layoutOptions={layoutOptions}>
          <Tree
            aria-label="Explorer entries"
            className={styles.ExplorerTable({
              noSelectionControls: !showSelectionControls
            })}
            dependencies={[breadcrumbs]}
            disabledBehavior="selection"
            dragAndDropHooks={dragAndDropHooks}
            expandedKeys={expandedKeys}
            items={items}
            selectedKeys={hasSelection ? selected : undefined}
            selectionBehavior={explorer.selectionBehavior}
            selectionMode={hasSelection ? selectionMode : undefined}
            onExpandedChange={setExpandedKeys}
            onSelectionChange={hasSelection ? setSelected : undefined}
            style={{display: 'block', width: '100%', height: '100%'}}
          >
            {item => (
              <ExplorerTableRow
                breadcrumbs={breadcrumbs}
                columns={columns}
                entry={item}
                explorer={explorer}
                gridTemplateColumns={gridTemplateColumns}
              />
            )}
          </Tree>
        </Virtualizer>
        {items.length === 0 && (
          <div className={styles.ExplorerTable.empty()}>
            {renderEmptyState()}
          </div>
        )}
      </Surface>
    </div>
  )
}
