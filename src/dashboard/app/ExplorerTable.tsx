import {Checkbox, FoldIcon, Icon, Surface} from '#/components.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import type {ComponentType, ReactNode} from 'react'
import {startTransition, useMemo} from 'react'
import {
  Button as AriaButton,
  Collection,
  ListLayout,
  Tree,
  TreeItem,
  TreeItemContent,
  Virtualizer,
  type DragAndDropHooks,
  type Selection
} from 'react-aria-components'
import type {ListLayoutOptions} from 'react-stately/useVirtualizerState'
import type {
  DashboardEntry,
  DashboardEntryData,
  DashboardEntryOverviewCell,
  DashboardExplorer,
  ExplorerReadyPage
} from '../atoms/explorer.js'
import {dashboardEntryOverviewColumnCount} from '../atoms/explorer.js'
import {LucideFile, LucideFolder} from '../icons.js'
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

interface ExplorerTableColumnsOptions {
  compact: boolean
  showSelectionControls: boolean
}

const explorerTableSelectionColumn: ExplorerTableColumn = {
  id: 'selection',
  kind: 'selection',
  width: 30
}

const explorerTableTitleColumn: ExplorerTableColumn = {
  id: 'title',
  kind: 'title',
  width: 300
}

const compactExplorerTableTitleColumn: ExplorerTableColumn = {
  id: 'title',
  kind: 'title',
  minWidth: 0,
  width: '1fr'
}

const explorerTableOverviewColumns: Array<ExplorerTableColumn> = Array.from(
  {length: dashboardEntryOverviewColumnCount},
  (_, index) => ({
    id: `overview-${index}`,
    index,
    kind: 'overview',
    minWidth: 120,
    width: '1fr'
  })
)

const explorerTableLayoutOptions: ListLayoutOptions = {
  rowHeight: 44,
  padding: 0,
  gap: 0
}

function createExplorerTableColumns({
  compact,
  showSelectionControls
}: ExplorerTableColumnsOptions): Array<ExplorerTableColumn> {
  const columns = new Array<ExplorerTableColumn>()
  if (showSelectionControls) columns.push(explorerTableSelectionColumn)
  columns.push(
    compact ? compactExplorerTableTitleColumn : explorerTableTitleColumn
  )
  if (!compact) columns.push(...explorerTableOverviewColumns)
  return columns
}

function explorerTableGridTemplate(columns: Array<ExplorerTableColumn>) {
  return columns
    .map(column => {
      if (column.width !== '1fr') return `${column.width}px`
      return `minmax(${column.minWidth ?? 0}px, 1fr)`
    })
    .join(' ')
}

interface ExplorerTableRowProps {
  columns: Array<ExplorerTableColumn>
  entry: DashboardEntry
  breadcrumbs: boolean
  isLinked: boolean
  explorer: DashboardExplorer
  gridTemplateColumns: string
  locale: string | null
  page: ExplorerReadyPage
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
        {isSelectable && (
          <Checkbox
            slot="selection"
            className={styles.ExplorerTable.checkbox()}
            aria-label={`Select ${label}`}
          />
        )}
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
          <span className={styles.ExplorerTable.field.value()} title={label}>
            <span className={styles.ExplorerTable.title()}>{label}</span>
          </span>
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
  const openLocation = useSetAtom(explorer.openLocation)
  const setExpandedKeys = useSetAtom(explorer.expandedKeys)
  const canExpandOnAction =
    !props.isSelectable && hasChildren && explorer.supportsInlineExpansion
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
      className={styles.ExplorerTable.row({
        unselectable: !props.isSelectable,
        linked: props.isLinked
      })}
      data-unselectable={!props.isSelectable || undefined}
      isDisabled={!props.isSelectable}
      onAction={
        hasAction && explorer.mode !== 'search' ? performAction : undefined
      }
      onPress={
        hasAction && explorer.mode === 'search' ? performAction : undefined
      }
      onDoubleClick={hasChildren ? enterParent : undefined}
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
      () => props.explorer.children(props.entry, props.locale),
      [props.entry, props.explorer, props.locale]
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
          isLinked={props.explorer.linkedKeys.has(child.id)}
          locale={props.locale}
          page={props.page}
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
      hasChildren={
        props.page.resultMode === 'browse' &&
        explorer.supportsInlineExpansion &&
        hasChildren
      }
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
  compact?: boolean
  dragAndDropHooks: DragAndDropHooks<DashboardEntry>
  explorer: DashboardExplorer
  items: Array<DashboardEntry>
  onSelectionChange?: (selection: Selection) => void
  page: ExplorerReadyPage
  renderEmptyState: () => ReactNode
  locale: string | null
}

export function ExplorerTable({
  compact = false,
  dragAndDropHooks,
  explorer,
  items,
  onSelectionChange,
  page,
  renderEmptyState,
  locale
}: ExplorerTableProps) {
  const [selected, setSelected] = useAtom(explorer.selection)
  const [expandedKeys, setExpandedKeys] = useAtom(explorer.expandedKeys)
  const selectionMode = explorer.selectionMode
  const search = useAtomValue(explorer.search)
  const isSearching = Boolean(search.trim())
  const breadcrumbs =
    explorer.breadcrumbs ||
    page.resultMode === 'matches' ||
    isSearching ||
    page.searchesEverything
  const hasSelection = selectionMode !== 'none'
  const showSelectionControls =
    hasSelection && !compact && explorer.showSelectionControls
  const columns = useMemo<Array<ExplorerTableColumn>>(
    () => createExplorerTableColumns({compact, showSelectionControls}),
    [compact, showSelectionControls]
  )
  const gridTemplateColumns = useMemo(
    () => explorerTableGridTemplate(columns),
    [columns]
  )

  function changeSelection(selection: Selection) {
    setSelected(selection)
    onSelectionChange?.(selection)
  }

  return (
    <div className={styles.ExplorerTable.viewport({compact})}>
      <Surface className={styles.ExplorerTable.surface()}>
        <Virtualizer
          layout={ListLayout}
          layoutOptions={explorerTableLayoutOptions}
        >
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
            onSelectionChange={hasSelection ? changeSelection : undefined}
            style={{display: 'block', width: '100%', height: '100%'}}
          >
            {item => (
              <ExplorerTableRow
                breadcrumbs={breadcrumbs}
                columns={columns}
                entry={item}
                explorer={explorer}
                gridTemplateColumns={gridTemplateColumns}
                isLinked={explorer.linkedKeys.has(item.id)}
                locale={locale}
                page={page}
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
