import {Checkbox, FoldIcon, Icon, Surface} from '#/components.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {unwrap} from 'jotai/utils'
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
  DashboardEntryTreeStatus,
  DashboardExplorer
} from '../store.js'
import {dashboardEntryOverviewColumnCount} from '../store.js'
import {CompactField, compactFieldText} from './CompactField.js'
import css from './ExplorerTable.module.css'
import {StatusBadge} from './StatusBadge.js'

const styles = styler(css)

interface ExplorerTableColumn {
  id: string
  index?: number
  kind: 'selection' | 'title' | 'overview' | 'filler' | 'status'
  minWidth?: number
  width: number | '1fr'
}

interface ExplorerTableRowProps {
  breadcrumbs: boolean
  columns: Array<ExplorerTableColumn>
  entry: DashboardEntry
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
  status?: DashboardEntryTreeStatus['status']
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

function ExplorerTableCell(props: ExplorerTableCellProps) {
  const {
    breadcrumbs,
    cells,
    column,
    expanded,
    hasChildren,
    icon,
    label,
    level,
    parents,
    rootLabel,
    status
  } = props
  if (column.kind === 'selection') {
    return (
      <div className={styles.ExplorerTable.cell.selection()}>
        <Checkbox
          slot="selection"
          className={styles.ExplorerTable.checkbox()}
          aria-label={`Select ${label}`}
        />
      </div>
    )
  }
  if (column.kind === 'title') {
    return (
      <div
        className={styles.ExplorerTable.cell.title()}
        style={{paddingLeft: 10 + Math.max(0, level - 1) * 20}}
      >
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
        <AriaButton
          slot="drag"
          className={styles.ExplorerTable.iconDrag()}
          aria-label={`Drag ${label}`}
        >
          <Icon icon={icon} className={styles.ExplorerTable.icon()} />
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
  if (column.kind === 'status') {
    return (
      <div className={styles.ExplorerTable.cell.status()}>
        {status && <StatusBadge status={status} />}
      </div>
    )
  }
  if (column.kind === 'filler') {
    return <div className={styles.ExplorerTable.cell.filler()} />
  }
  const cell =
    typeof column.index === 'number' ? cells[column.index] : undefined
  return (
    <div
      className={styles.ExplorerTable.cell()}
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
    columns,
    entry,
    explorer,
    gridTemplateColumns,
    hasChildren,
    isSelectable,
    label
  } = props
  const isExpanded = useAtomValue(
    useMemo(() => explorer.isExpanded(entry), [explorer, entry])
  )
  const onAction = useSetAtom(explorer.onAction)
  return (
    <TreeItem
      id={entry.id}
      textValue={label}
      hasChildItems={hasChildren}
      isDisabled={!isSelectable}
      onAction={explorer.hasRowAction ? () => onAction(entry) : undefined}
      className={styles.ExplorerTable.row()}
    >
      <TreeItemContent>
        {({isExpanded: renderExpanded, level}) => (
          <div
            className={styles.ExplorerTable.row.grid()}
            style={{gridTemplateColumns}}
          >
            {columns.map(column => (
              <ExplorerTableCell
                {...props}
                column={column}
                expanded={renderExpanded}
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
  const {entry, explorer} = props
  const children = useAtomValue(
    useMemo(
      () => unwrap(explorer.children(entry), previous => previous ?? []),
      [explorer, entry]
    )
  )
  if (children.length === 0) {
    const loadingId = `${entry.id}:loading`
    return (
      <Collection items={[{id: loadingId}]}>
        {item => (
          <TreeItem
            id={item.id}
            textValue="Loading entries"
            isDisabled
            className={styles.ExplorerTable.row({loading: true})}
          >
            <TreeItemContent>
              {({level}) => (
                <div
                  className={styles.ExplorerTable.row.grid()}
                  style={{gridTemplateColumns: props.gridTemplateColumns}}
                >
                  <div
                    className={styles.ExplorerTable.cell.title()}
                    style={{paddingLeft: 10 + Math.max(0, level - 1) * 20}}
                  >
                    <span className={styles.ExplorerTable.chevron()} />
                    <span className={styles.ExplorerTable.loadingIcon()} />
                    <span className={styles.ExplorerTable.loadingText()} />
                  </div>
                </div>
              )}
            </TreeItemContent>
          </TreeItem>
        )}
      </Collection>
    )
  }
  return (
    <Collection items={children}>
      {child => (
        <ExplorerTableRow
          breadcrumbs={props.breadcrumbs}
          columns={props.columns}
          entry={child}
          explorer={explorer}
          gridTemplateColumns={props.gridTemplateColumns}
        />
      )}
    </Collection>
  )
}

function ExplorerTableLoadingRow({
  breadcrumbs,
  columns,
  entry,
  explorer,
  gridTemplateColumns
}: ExplorerTableRowProps) {
  return (
    <ExplorerTableDisplayRow
      breadcrumbs={breadcrumbs}
      cells={[]}
      columns={columns}
      entry={entry}
      explorer={explorer}
      gridTemplateColumns={gridTemplateColumns}
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
  breadcrumbs,
  columns,
  data,
  entry,
  explorer,
  gridTemplateColumns
}: ExplorerTableLoadedRowProps) {
  const root = useAtomValue(data.root)
  const rootLabel = useAtomValue(root.label)
  const label = useAtomValue(data.label)
  const configuredIcon = useAtomValue(data.icon)
  const hasChildren = useAtomValue(data.hasChildren)
  const cells = useAtomValue(data.overviewCells)
  const treeStatus = useAtomValue(data.treeStatus)
  const status = treeStatus.status
  const parents = useAtomValue(data.parents)
  const icon = configuredIcon ?? (hasChildren ? LucideFolder : LucideFile)
  const isSelectable = useAtomValue(
    useMemo(() => explorer.isSelectable(entry), [explorer, entry])
  )
  return (
    <ExplorerTableDisplayRow
      breadcrumbs={breadcrumbs}
      cells={cells}
      columns={columns}
      entry={entry}
      explorer={explorer}
      gridTemplateColumns={gridTemplateColumns}
      hasChildren={hasChildren}
      icon={icon}
      isSelectable={isSelectable}
      label={label}
      parents={parents}
      rootLabel={rootLabel}
      status={status}
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

function columnTemplate(columns: Array<ExplorerTableColumn>) {
  return columns
    .map(column => {
      if (column.width === '1fr') {
        return `minmax(${column.minWidth ?? 0}px, 1fr)`
      }
      return `${column.width}px`
    })
    .join(' ')
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
  const breadcrumbs = explorer.breadcrumbs
  const hasSelection = selectionMode !== 'none'
  const showSelectionControls = hasSelection && explorer.showSelectionControls
  const columns = useMemo<Array<ExplorerTableColumn>>(
    () => [
      ...(showSelectionControls
        ? [{id: 'selection', kind: 'selection' as const, width: 30}]
        : []),
      {id: 'title', kind: 'title', width: 220},
      {id: 'status', kind: 'status', width: 150},
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
  const gridTemplateColumns = useMemo(() => columnTemplate(columns), [columns])
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
            disabledBehavior="selection"
            dragAndDropHooks={dragAndDropHooks}
            expandedKeys={expandedKeys}
            items={items}
            selectedKeys={hasSelection ? selected : undefined}
            selectionBehavior={explorer.selectionBehavior}
            selectionMode={hasSelection ? selectionMode : undefined}
            onExpandedChange={setExpandedKeys}
            onSelectionChange={hasSelection ? setSelected : undefined}
            renderEmptyState={() => null}
            style={{
              display: 'block',
              width: '100%',
              height: '100%'
            }}
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
