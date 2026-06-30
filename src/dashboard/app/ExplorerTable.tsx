import {Checkbox, Icon, Surface} from '#/components.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import type {ComponentType, ReactNode} from 'react'
import {useMemo} from 'react'
import {
  Button as AriaButton,
  Cell,
  Column,
  Row,
  Table,
  TableBody,
  TableHeader,
  TableLayout,
  Virtualizer,
  type DragAndDropHooks,
  type Key
} from 'react-aria-components'
import type {TableLayoutProps} from 'react-stately/useVirtualizerState'
import {LucideFile, LucideFolder} from '../icons.js'
import type {
  DashboardEntry,
  DashboardEntryData,
  DashboardEntryOverviewCell,
  DashboardExplorer
} from '../store.js'
import {dashboardEntryOverviewColumnCount} from '../store.js'
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
  columnById: Map<Key, ExplorerTableColumn>
  columns: Array<ExplorerTableColumn>
  entry: DashboardEntry
  breadcrumbs: boolean
}

interface ExplorerTableDisplayRowProps {
  columnById: Map<Key, ExplorerTableColumn>
  columns: Array<ExplorerTableColumn>
  entry: DashboardEntry
  label: string
  icon: ComponentType
  cells: Array<DashboardEntryOverviewCell>
  breadcrumbs?: boolean | undefined
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

function ExplorerTableDisplayRow({
  columnById,
  columns,
  entry,
  label,
  icon,
  cells,
  breadcrumbs,
  parents,
  rootLabel
}: ExplorerTableDisplayRowProps) {
  function renderCell(columnOrId: ExplorerTableColumn | Key) {
    const column =
      typeof columnOrId === 'object' ? columnOrId : columnById.get(columnOrId)
    if (!column) return <Cell />
    if (column.kind === 'selection') {
      return (
        <Cell className={styles.ExplorerTable.cell.selection()}>
          <Checkbox
            slot="selection"
            className={styles.ExplorerTable.checkbox()}
            aria-label={`Select ${label}`}
          />
        </Cell>
      )
    }
    if (column.kind === 'title') {
      return (
        <Cell className={styles.ExplorerTable.cell.title()} textValue={label}>
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
        </Cell>
      )
    }
    if (column.kind === 'filler') {
      return <Cell className={styles.ExplorerTable.cell.filler()} />
    }
    const cell =
      typeof column.index === 'number' ? cells[column.index] : undefined
    return (
      <Cell
        className={styles.ExplorerTable.cell()}
        textValue={
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
      </Cell>
    )
  }
  return (
    <Row
      id={entry.id}
      textValue={label}
      className={styles.ExplorerTable.row()}
      columns={columns}
      dependencies={[columns, label, icon, cells, breadcrumbs, parents]}
      style={{width: '100%', minWidth: '100%', height: 'inherit'}}
    >
      {renderCell}
    </Row>
  )
}

function ExplorerTableLoadingRow({
  columnById,
  columns,
  entry,
  breadcrumbs
}: ExplorerTableRowProps) {
  return (
    <ExplorerTableDisplayRow
      columnById={columnById}
      columns={columns}
      entry={entry}
      label="Loading entry"
      icon={LucideFile}
      cells={[]}
      breadcrumbs={breadcrumbs}
      parents={[]}
    />
  )
}

interface ExplorerTableLoadedRowProps extends ExplorerTableRowProps {
  data: DashboardEntryData
}

function ExplorerTableLoadedRow({
  columnById,
  columns,
  data,
  entry,
  breadcrumbs
}: ExplorerTableLoadedRowProps) {
  const root = useAtomValue(data.root)
  const rootLabel = useAtomValue(root.label)
  const label = useAtomValue(data.label)
  const configuredIcon = useAtomValue(data.icon)
  const hasChildren = useAtomValue(data.hasChildren)
  const cells = useAtomValue(data.overviewCells)
  const parents = useAtomValue(data.parents)
  const icon = configuredIcon ?? (hasChildren ? LucideFolder : LucideFile)
  return (
    <ExplorerTableDisplayRow
      columnById={columnById}
      columns={columns}
      entry={entry}
      label={label}
      icon={icon}
      cells={cells}
      breadcrumbs={breadcrumbs}
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
  const onAction = useSetAtom(explorer.onAction)
  const selectionMode = explorer.selectionMode
  const breadcrumbs = explorer.breadcrumbs
  const hasSelection = selectionMode !== 'none'
  const showSelectionControls = hasSelection && explorer.showSelectionControls
  function onItemAction(key: Key) {
    const entry = items.find(item => item.id === String(key))
    if (entry) onAction(entry)
  }
  const onRowAction = explorer.hasRowAction ? onItemAction : undefined
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
  const columnById = useMemo(
    () => new Map(columns.map(column => [column.id, column] as const)),
    [columns]
  )
  const layoutOptions = useMemo<TableLayoutProps>(
    () => ({
      rowHeight: 44,
      headingHeight: 0,
      padding: 0,
      gap: 0
    }),
    []
  )
  return (
    <div className={styles.ExplorerTable.viewport()}>
      <Surface className={styles.ExplorerTable.surface()}>
        <Virtualizer layout={TableLayout} layoutOptions={layoutOptions}>
          <Table
            aria-label="Explorer entries"
            className={styles.ExplorerTable({
              noSelectionControls: !showSelectionControls
            })}
            dragAndDropHooks={dragAndDropHooks}
            selectedKeys={hasSelection ? selected : undefined}
            selectionBehavior={explorer.selectionBehavior}
            selectionMode={hasSelection ? selectionMode : undefined}
            onSelectionChange={hasSelection ? setSelected : undefined}
            onRowAction={onRowAction}
            style={{display: 'block', width: '100%', height: '100%'}}
          >
            <TableHeader
              className={styles.ExplorerTable.header()}
              columns={columns}
            >
              {column => (
                <Column
                  id={column.id}
                  isRowHeader={column.kind === 'title'}
                  maxWidth={column.kind === 'selection' ? 30 : undefined}
                  minWidth={column.kind === 'selection' ? 30 : column.minWidth}
                  width={column.width}
                  className={
                    column.kind === 'selection'
                      ? styles.ExplorerTable.column.selection()
                      : column.kind === 'filler'
                        ? styles.ExplorerTable.column.filler()
                        : styles.ExplorerTable.column()
                  }
                />
              )}
            </TableHeader>
            <TableBody
              className={styles.ExplorerTable.body()}
              dependencies={[columns]}
              items={items}
              renderEmptyState={() => null}
            >
              {item => (
                <ExplorerTableRow
                  breadcrumbs={breadcrumbs}
                  columnById={columnById}
                  columns={columns}
                  entry={item}
                />
              )}
            </TableBody>
          </Table>
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
