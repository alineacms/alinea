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
  EntryDataAtoms,
  EntryAtoms,
  EntryOverviewCell
} from '../atoms/entry.js'
import {entryOverviewColumnCount} from '../atoms/entry.js'
import type {DashboardEntryTreeStatus} from '../atoms/entry/load.js'
import type {ExplorerAtoms} from '../atoms/explorer.js'
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
  entry: EntryAtoms
  explorer: ExplorerAtoms
  gridTemplateColumns: string
}

interface ExplorerTableDisplayRowProps extends ExplorerTableRowProps {
  cells: Array<EntryOverviewCell>
  icon: ComponentType
  isExpandable: boolean
  isSelectable: boolean
  label: string
  parents: Array<EntryAtoms>
  rootLabel?: string
  status?: DashboardEntryTreeStatus['status']
}

interface ExplorerTableCellProps extends ExplorerTableDisplayRowProps {
  column: ExplorerTableColumn
  columnIndex: number
  expanded: boolean
  level: number
}

interface ExplorerTableBreadcrumbsProps {
  entries: Array<EntryAtoms>
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
  entry: EntryAtoms
  index: number
}

function ExplorerTableBreadcrumb({entry, index}: ExplorerTableBreadcrumbProps) {
  const {data} = useAtomValue(entry.data)
  if (!data) return null
  return <ExplorerTableLoadedBreadcrumb data={data} index={index} />
}

interface ExplorerTableLoadedBreadcrumbProps {
  data: EntryDataAtoms
  index: number
}

function ExplorerTableLoadedBreadcrumb({
  data,
  index
}: ExplorerTableLoadedBreadcrumbProps) {
  const label = useAtomValue(data.label)
  const root = useAtomValue(data.root)
  const rootLabel = useAtomValue(root.settings).label
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
    columnIndex,
    expanded,
    explorer,
    icon,
    isExpandable,
    isSelectable,
    label,
    level,
    parents,
    rootLabel,
    status
  } = props
  if (column.kind === 'selection') {
    return (
      <div
        className={styles.ExplorerTable.cell.selection()}
        role="gridcell"
        aria-colindex={columnIndex + 1}
      >
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
        aria-colindex={columnIndex + 1}
        style={{paddingLeft: 10 + Math.max(0, level - 1) * 20}}
      >
        {explorer.supportsInlineExpansion && (
          <span className={styles.ExplorerTable.chevron()}>
            {isExpandable && (
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
  if (column.kind === 'status') {
    return (
      <div
        className={styles.ExplorerTable.cell.status()}
        role="gridcell"
        aria-colindex={columnIndex + 1}
      >
        {status && status !== 'published' && <StatusBadge status={status} />}
      </div>
    )
  }
  if (column.kind === 'filler') {
    return (
      <div
        className={styles.ExplorerTable.cell.filler()}
        role="gridcell"
        aria-colindex={columnIndex + 1}
      />
    )
  }
  const cell =
    typeof column.index === 'number' ? cells[column.index] : undefined
  return (
    <div
      className={styles.ExplorerTable.cell()}
      role="gridcell"
      aria-colindex={columnIndex + 1}
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
    isExpandable,
    isSelectable,
    label
  } = props
  const isExpanded = useAtomValue(
    useMemo(() => explorer.isExpanded(entry), [explorer, entry])
  )
  const onAction = useSetAtom(explorer.onAction)
  const performAction = explorer.hasRowAction
    ? () => onAction(entry)
    : undefined
  const textValue = useMemo(
    () =>
      [label, ...cells.map(cell => compactFieldText(cell.field, cell.value))]
        .filter(Boolean)
        .join(' '),
    [label, cells]
  )
  return (
    <TreeItem
      id={entry.id}
      textValue={textValue}
      hasChildItems={isExpandable}
      isDisabled={!isSelectable}
      onAction={explorer.actionOnPress ? undefined : performAction}
      onPress={explorer.actionOnPress ? performAction : undefined}
      className={styles.ExplorerTable.row({notSelectable: !isSelectable})}
    >
      <TreeItemContent>
        {({isExpanded: renderExpanded, level}) => (
          <div
            className={styles.ExplorerTable.row.grid()}
            role="presentation"
            style={{gridTemplateColumns}}
          >
            {columns.map((column, i) => (
              <ExplorerTableCell
                {...props}
                column={column}
                columnIndex={i}
                expanded={renderExpanded}
                key={column.id}
                level={level}
              />
            ))}
          </div>
        )}
      </TreeItemContent>
      {isExpandable && isExpanded && <ExplorerTableChildren {...props} />}
    </TreeItem>
  )
}

function ExplorerTableChildren(props: ExplorerTableDisplayRowProps) {
  const {entry, explorer} = props
  const children = useAtomValue(
    useMemo(() => explorer.children(entry), [explorer, entry])
  )
  if (children instanceof Promise || children.length === 0) return null
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
      icon={LucideFile}
      isExpandable={false}
      isSelectable={false}
      label="Loading entry"
      parents={[]}
    />
  )
}

interface ExplorerTableLoadedRowProps extends ExplorerTableRowProps {
  data: EntryDataAtoms
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
  const rootLabel = useAtomValue(root.settings).label
  const label = useAtomValue(data.label)
  const configuredIcon = useAtomValue(data.icon)
  const hasChildren = useAtomValue(data.entryData).hasChildren
  const cells = useAtomValue(data.overviewCells)
  const treeStatus = useAtomValue(data.treeStatus)
  const status = treeStatus.status
  const parents = useAtomValue(data.parents)
  const icon = configuredIcon ?? (hasChildren ? LucideFolder : LucideFile)
  const isExpandable = explorer.supportsInlineExpansion && hasChildren
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
      icon={icon}
      isExpandable={isExpandable}
      isSelectable={isSelectable}
      label={label}
      parents={parents}
      rootLabel={rootLabel}
      status={status}
    />
  )
}

function ExplorerTableRow(props: ExplorerTableRowProps) {
  const {data} = useAtomValue(props.entry.data)
  if (!data) return <ExplorerTableLoadingRow {...props} />
  return <ExplorerTableLoadedRow {...props} data={data} />
}

export interface ExplorerTableProps {
  dragAndDropHooks: DragAndDropHooks<EntryAtoms>
  explorer: ExplorerAtoms
  items: Array<EntryAtoms>
  renderEmptyState: () => ReactNode
}

// Tree items do not share table column sizing, so every nested row receives the
// same grid definition to keep its cells aligned with the root rows.
function explorerTableGridTemplate(columns: Array<ExplorerTableColumn>) {
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
      ...Array.from({length: entryOverviewColumnCount}, (_, index) => ({
        id: `overview-${index}`,
        index,
        kind: 'overview' as const,
        minWidth: 120,
        width: '1fr' as const
      }))
    ],
    [showSelectionControls]
  )
  const gridTemplateColumns = useMemo(
    () => explorerTableGridTemplate(columns),
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
