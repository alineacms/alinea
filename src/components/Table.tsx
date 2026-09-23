import styler from '@alinea/styler'
import {
  Children,
  createContext,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  useContext,
  useMemo
} from 'react'
import {
  Button as ButtonPrimitive,
  ListLayout,
  Tree,
  TreeItem,
  TreeItemContent,
  Virtualizer
} from 'react-aria-components'
import {
  IcRoundKeyboardArrowDown,
  IcRoundKeyboardArrowUp
} from '../dashboard/icons.js'
import css from './Table.module.css'
import {FoldIcon} from './FoldIcon.js'
import {Icon} from './Icon.js'
import {SelectionCheckbox} from './internal/SelectionCheckbox.js'
import {useDragDrop} from './internal/useDragDrop.js'
import {Surface} from './Surface.js'
import type {
  AriaProps,
  DataProps,
  DragDropProps,
  IconType,
  Key,
  SelectionProps,
  SortDescriptor,
  StyleProps
} from './types.js'

const styles = styler(css)

/** Width of the selection checkbox column in pixels */
const selectionWidth = 30

export interface TableColumn {
  id: Key
  header: ReactNode
  /** A fixed width in pixels or a fraction of the remaining space */
  width?: number | `${number}fr`
  /** Minimum width in pixels of a fractional column */
  minWidth?: number
  align?: 'start' | 'end'
  sortable?: boolean
  /** Hide the column on narrow screens (below 768px) */
  collapsible?: boolean
}

export interface TableProps<T extends object>
  extends StyleProps, AriaProps, SelectionProps, DragDropProps {
  items: Iterable<T>
  columns: ReadonlyArray<TableColumn>
  /** Show the column headers, defaults to true */
  showHeader?: boolean
  /** Reserve space for expand toggles so titles line up, set when rows nest */
  expandable?: boolean
  rowHeight?: number
  /**
   * How pointer clicks select rows. With `toggle` (the default) a click runs
   * the row action, or toggles its selection while rows are selected. With
   * `replace` a click selects only that row and a double click or Enter runs
   * the row action.
   */
  selectionBehavior?: 'toggle' | 'replace'
  /** Show a selection checkbox per row, defaults to multiple selection */
  showSelectionControls?: boolean
  /** `plain` drops the rounded surface, eg. when the table fills a panel */
  variant?: 'surface' | 'plain'
  expandedKeys?: ReadonlySet<Key>
  defaultExpandedKeys?: ReadonlySet<Key>
  onExpandedChange?: (keys: Set<Key>) => void
  sortDescriptor?: SortDescriptor
  onSortChange?: (descriptor: SortDescriptor) => void
  /**
   * Called when a row is activated (see `selectionBehavior`), rows can
   * override it with their own `onAction`
   */
  onRowAction?: (key: Key) => void
  renderEmptyState?: () => ReactNode
  /**
   * Rows are cached per item, list the values `children` reads besides the
   * item to render them again when those change
   */
  dependencies?: ReadonlyArray<unknown>
  children: (item: T) => ReactElement
}

interface TableContextValue {
  columns: ReadonlyArray<TableColumn>
  expandable: boolean
  selectable: boolean
  /** Rows can be selected or activated */
  interactive: boolean
}

const TableContext = createContext<TableContextValue | null>(null)

function useTable() {
  const context = useContext(TableContext)
  if (!context) throw new Error('TableRow must be rendered inside a Table')
  return context
}

interface TableRowContextValue {
  textValue: string
  allowsDragging: boolean
}

const TableRowContext = createContext<TableRowContextValue | null>(null)

/** The column a cell renders in, used to hide collapsible columns */
const TableColumnContext = createContext<TableColumn | null>(null)

function useCollapsible() {
  return useContext(TableColumnContext)?.collapsible || undefined
}

function track({width = '1fr', minWidth = 0}: TableColumn, narrow: boolean) {
  if (typeof width === 'number') return `${width}px`
  // Narrow tables do not scroll sideways, so fractional columns give up their
  // minimum width to keep fixed columns such as row actions in view
  return `minmax(${narrow ? 0 : minWidth}px, ${width})`
}

function gridTemplate(
  columns: ReadonlyArray<TableColumn>,
  selectable: boolean,
  narrow: boolean
) {
  const visible = narrow
    ? columns.filter(column => !column.collapsible)
    : columns
  const tracks = visible.map(column => track(column, narrow))
  // Let the last column fill the row when only fixed columns remain
  const fills = visible.some(column => typeof column.width !== 'number')
  if (narrow && !fills && tracks.length > 0)
    tracks[tracks.length - 1] = 'minmax(0, 1fr)'
  return (selectable ? [`${selectionWidth}px`, ...tracks] : tracks).join(' ')
}

function minimumWidth(
  columns: ReadonlyArray<TableColumn>,
  selectable: boolean
) {
  let total = selectable ? selectionWidth : 0
  for (const {width, minWidth = 0} of columns)
    total += typeof width === 'number' ? width : minWidth
  return total
}

export function Table<T extends object>({
  items,
  columns,
  showHeader = true,
  expandable = false,
  rowHeight = 44,
  selectionMode = 'none',
  selectionBehavior = 'toggle',
  showSelectionControls,
  variant = 'surface',
  selectedKeys,
  defaultSelectedKeys,
  onSelectionChange,
  disabledKeys,
  expandedKeys,
  defaultExpandedKeys,
  onExpandedChange,
  sortDescriptor,
  onSortChange,
  onRowAction,
  renderEmptyState,
  dependencies = [],
  getDragData,
  acceptedDragTypes,
  canDrop,
  onReorder,
  onMove,
  onDropItems,
  onDropFiles,
  renderDragPreview,
  className,
  style,
  children,
  ...props
}: TableProps<T>) {
  const selectable =
    selectionMode !== 'none' &&
    (showSelectionControls ?? selectionMode === 'multiple')
  const interactive = selectionMode !== 'none' || Boolean(onRowAction)
  const context = useMemo(
    () => ({columns, expandable, selectable, interactive}),
    [columns, selectable, expandable, interactive]
  )
  const dnd = useDragDrop<T>({
    getDragData,
    acceptedDragTypes,
    canDrop,
    onReorder,
    onMove,
    onDropItems,
    onDropFiles,
    renderDragPreview,
    dropIndicatorSlot: 'table-drop-indicator',
    dropIndicatorClassName: active => styles.TableDropIndicator({active})
  })
  const isEmpty = Array.from(items).length === 0
  return (
    <TableContext.Provider value={context}>
      <Surface
        data-slot="table"
        data-variant={variant}
        data-selectable={selectable || undefined}
        className={styles.Table(styler.merge({className}))}
        style={
          {
            ...style,
            '--alinea-table-columns': gridTemplate(columns, selectable, false),
            '--alinea-table-columns-narrow': gridTemplate(
              columns,
              selectable,
              true
            ),
            '--alinea-table-min-width': `${minimumWidth(columns, selectable)}px`,
            '--alinea-table-row-height': `${rowHeight}px`
          } as CSSProperties
        }
      >
        {showHeader && (
          <TableHeader
            sortDescriptor={sortDescriptor}
            onSortChange={onSortChange}
          />
        )}
        <Virtualizer
          layout={ListLayout}
          layoutOptions={{rowHeight, padding: 0, gap: 0}}
        >
          <Tree
            {...props}
            key={dnd.key}
            items={items}
            dependencies={[context, ...dependencies]}
            selectionMode={selectionMode}
            selectionBehavior={selectionBehavior}
            selectedKeys={selectedKeys}
            defaultSelectedKeys={defaultSelectedKeys}
            onSelectionChange={onSelectionChange}
            disabledKeys={disabledKeys}
            disabledBehavior="selection"
            expandedKeys={expandedKeys}
            defaultExpandedKeys={defaultExpandedKeys}
            onExpandedChange={onExpandedChange}
            onAction={onRowAction}
            dragAndDropHooks={dnd.dragAndDropHooks}
            className={styles.Table.body()}
          >
            {children}
          </Tree>
        </Virtualizer>
        {isEmpty && renderEmptyState && (
          <div data-slot="table-empty" className={styles.Table.empty()}>
            {renderEmptyState()}
          </div>
        )}
      </Surface>
    </TableContext.Provider>
  )
}

interface TableHeaderProps {
  sortDescriptor?: SortDescriptor
  onSortChange?: (descriptor: SortDescriptor) => void
}

function TableHeader({sortDescriptor, onSortChange}: TableHeaderProps) {
  const {columns, expandable, selectable} = useTable()
  return (
    <div data-slot="table-header" className={styles.TableHeader()}>
      {selectable && <span />}
      {columns.map((column, index) => {
        const sorted =
          sortDescriptor?.column === column.id
            ? sortDescriptor.direction
            : undefined
        const label = (
          <>
            {column.header}
            {sorted && (
              <Icon
                icon={
                  sorted === 'asc'
                    ? IcRoundKeyboardArrowUp
                    : IcRoundKeyboardArrowDown
                }
                className={styles.TableHeader.sortIcon()}
              />
            )}
          </>
        )
        return (
          <div
            key={column.id}
            data-slot="table-head"
            data-align={column.align}
            data-collapsible={column.collapsible || undefined}
            className={styles.TableHeader.head({
              indented: expandable && index === 0
            })}
          >
            {column.sortable && onSortChange ? (
              <button
                type="button"
                className={styles.TableHeader.sort()}
                aria-pressed={Boolean(sorted)}
                onClick={() =>
                  onSortChange({
                    column: column.id,
                    direction: sorted === 'asc' ? 'desc' : 'asc'
                  })
                }
              >
                {label}
              </button>
            ) : (
              label
            )}
          </div>
        )
      })}
    </div>
  )
}

export interface TableRowProps extends DataProps {
  id: Key
  /** Text used for typeahead and as the accessible row name */
  textValue: string
  /** Shows the expand toggle, also before the nested rows are loaded */
  hasChildren?: boolean
  /**
   * Nested TableRows, rendered when the row is expanded. Pass them
   * only once expanded to load them lazily, eg. from a component that renders
   * the rows of already loaded data.
   */
  rows?: ReactNode
  /** Set to false to disable selecting the row, its action still runs */
  selectable?: boolean
  /** Highlights the row, eg. to mark items that are already in use */
  highlighted?: boolean
  /** Called when the row is activated, overrides `onRowAction` */
  onAction?: () => void
  /**
   * Called on every click or tap of the row, next to its selection. Use it
   * instead of `onAction` to act on a single click with the `replace`
   * selection behavior, where `onAction` needs a double click.
   */
  onClick?: () => void
  onDoubleClick?: () => void
  /** One cell per column, in column order */
  children: ReactNode
}

export function TableRow({
  id,
  textValue,
  hasChildren,
  rows,
  selectable = true,
  highlighted,
  onAction,
  onClick,
  onDoubleClick,
  children,
  ...props
}: TableRowProps) {
  const {
    columns,
    expandable,
    selectable: showSelection,
    interactive
  } = useTable()
  const cells = Children.toArray(children)
  return (
    <TreeItem
      data-slot="table-row"
      {...props}
      id={id}
      textValue={textValue}
      hasChildItems={hasChildren}
      isDisabled={!selectable}
      data-unselectable={!selectable || undefined}
      data-highlighted={highlighted || undefined}
      onAction={onAction}
      onPress={onClick}
      onDoubleClick={onDoubleClick}
      className={({isDropTarget, isDragging}) =>
        styles.TableRow({
          highlighted,
          static: !interactive && !onAction && !onClick && !onDoubleClick,
          dropTarget: isDropTarget,
          dragging: isDragging
        })
      }
    >
      <TreeItemContent>
        {({isExpanded, level, allowsDragging}) => (
          <TableRowContext.Provider
            value={{textValue, allowsDragging: Boolean(allowsDragging)}}
          >
            <div role="presentation" className={styles.TableRow.grid()}>
              {showSelection && (
                <div role="gridcell" className={styles.TableRow.selection()}>
                  {selectable && (
                    <SelectionCheckbox aria-label={`Select ${textValue}`} />
                  )}
                </div>
              )}
              {cells.map((cell, index) => (
                <TableColumnContext.Provider
                  key={index}
                  value={columns[index] ?? null}
                >
                  {index === 0 ? (
                    <div
                      className={styles.TableRow.first()}
                      style={{
                        paddingInlineStart: `calc(var(--alinea-table-indent) + ${(level - 1) * 20}px)`
                      }}
                    >
                      {(expandable || level > 1) && (
                        <span className={styles.TableRow.chevron()}>
                          {hasChildren && (
                            <ButtonPrimitive
                              slot="chevron"
                              className={styles.TableRow.chevron.button()}
                              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${textValue}`}
                            >
                              <FoldIcon aria-hidden expanded={isExpanded} />
                            </ButtonPrimitive>
                          )}
                        </span>
                      )}
                      {cell}
                    </div>
                  ) : (
                    cell
                  )}
                </TableColumnContext.Provider>
              ))}
            </div>
          </TableRowContext.Provider>
        )}
      </TreeItemContent>
      {rows}
    </TreeItem>
  )
}

export interface TableCellProps extends StyleProps {
  /**
   * A small caption above the value, like the dashboard explorer shows its
   * columns when the header is hidden
   */
  label?: ReactNode
  align?: 'start' | 'end'
  /** Tooltip text */
  title?: string
  children?: ReactNode
}

export function TableCell({
  label,
  align,
  title,
  className,
  style,
  children
}: TableCellProps) {
  return (
    <div
      data-slot="table-cell"
      role="gridcell"
      data-align={align}
      data-collapsible={useCollapsible()}
      title={title}
      className={styles.TableCell(styler.merge({className}))}
      style={style}
    >
      {label && <span className={styles.TableCell.label()}>{label}</span>}
      <span className={styles.TableCell.value()}>{children}</span>
    </div>
  )
}

export interface TableThumbnailProps extends StyleProps {
  src?: string
  alt?: string
}

/** An image cell, sized to the row height */
export function TableThumbnail({
  src,
  alt = '',
  className,
  style
}: TableThumbnailProps) {
  return (
    <div
      data-slot="table-thumbnail"
      role="gridcell"
      data-collapsible={useCollapsible()}
      className={styles.TableThumbnail(styler.merge({className}))}
      style={style}
    >
      {src && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={styles.TableThumbnail.image()}
        />
      )}
    </div>
  )
}

export interface TableTitleProps extends StyleProps {
  /** Doubles as the drag handle of the row when rows can be dragged */
  icon?: IconType
  title: ReactNode
  /** A small caption above the title, eg. the parent path */
  label?: ReactNode
}

export function TableTitle({
  icon,
  title,
  label,
  className,
  style
}: TableTitleProps) {
  const row = useContext(TableRowContext)
  const name = typeof title === 'string' ? title : row?.textValue
  return (
    <div
      data-slot="table-title"
      role="gridcell"
      data-collapsible={useCollapsible()}
      className={styles.TableTitle(styler.merge({className}))}
      style={style}
    >
      {icon &&
        (row?.allowsDragging ? (
          <ButtonPrimitive
            slot="drag"
            data-slot="table-drag-handle"
            aria-label={`Drag ${name}`}
            className={styles.TableTitle.drag()}
          >
            <Icon
              aria-hidden
              icon={icon}
              className={styles.TableTitle.icon()}
            />
          </ButtonPrimitive>
        ) : (
          <Icon aria-hidden icon={icon} className={styles.TableTitle.icon()} />
        ))}
      <span className={styles.TableTitle.text()}>
        {label && <span className={styles.TableTitle.label()}>{label}</span>}
        <span
          className={styles.TableTitle.title()}
          title={typeof title === 'string' ? title : undefined}
        >
          {title}
        </span>
      </span>
    </div>
  )
}
