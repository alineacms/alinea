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
import css from './ContentTable.module.css'
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

export interface ContentTableColumn {
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

export interface ContentTableProps<T extends object>
  extends StyleProps, AriaProps, SelectionProps, DragDropProps {
  items: Iterable<T>
  columns: ReadonlyArray<ContentTableColumn>
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

interface ContentTableContextValue {
  columns: ReadonlyArray<ContentTableColumn>
  expandable: boolean
  selectable: boolean
}

const ContentTableContext = createContext<ContentTableContextValue | null>(null)

function useContentTable() {
  const context = useContext(ContentTableContext)
  if (!context)
    throw new Error('ContentTableRow must be rendered inside a ContentTable')
  return context
}

interface ContentTableRowContextValue {
  textValue: string
  allowsDragging: boolean
}

const ContentTableRowContext =
  createContext<ContentTableRowContextValue | null>(null)

/** The column a cell renders in, used to hide collapsible columns */
const ContentTableColumnContext = createContext<ContentTableColumn | null>(null)

function useCollapsible() {
  return useContext(ContentTableColumnContext)?.collapsible || undefined
}

function track({width = '1fr', minWidth = 0}: ContentTableColumn) {
  return typeof width === 'number'
    ? `${width}px`
    : `minmax(${minWidth}px, ${width})`
}

function gridTemplate(
  columns: ReadonlyArray<ContentTableColumn>,
  selectable: boolean,
  narrow: boolean
) {
  const visible = narrow
    ? columns.filter(column => !column.collapsible)
    : columns
  const tracks = visible.map(track)
  // Let the last column fill the row when only fixed columns remain
  const fills = visible.some(column => typeof column.width !== 'number')
  if (narrow && !fills && tracks.length > 0)
    tracks[tracks.length - 1] = 'minmax(0, 1fr)'
  return (selectable ? [`${selectionWidth}px`, ...tracks] : tracks).join(' ')
}

function minimumWidth(
  columns: ReadonlyArray<ContentTableColumn>,
  selectable: boolean
) {
  let total = selectable ? selectionWidth : 0
  for (const {width, minWidth = 0} of columns)
    total += typeof width === 'number' ? width : minWidth
  return total
}

export function ContentTable<T extends object>({
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
}: ContentTableProps<T>) {
  const selectable =
    selectionMode !== 'none' &&
    (showSelectionControls ?? selectionMode === 'multiple')
  const context = useMemo(
    () => ({columns, expandable, selectable}),
    [columns, selectable, expandable]
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
    dropIndicatorSlot: 'content-table-drop-indicator',
    dropIndicatorClassName: active => styles.ContentTableDropIndicator({active})
  })
  const isEmpty = Array.from(items).length === 0
  return (
    <ContentTableContext.Provider value={context}>
      <Surface
        data-slot="content-table"
        data-variant={variant}
        data-selectable={selectable || undefined}
        className={styles.ContentTable(styler.merge({className}))}
        style={
          {
            ...style,
            '--alinea-content-table-columns': gridTemplate(
              columns,
              selectable,
              false
            ),
            '--alinea-content-table-columns-narrow': gridTemplate(
              columns,
              selectable,
              true
            ),
            '--alinea-content-table-min-width': `${minimumWidth(columns, selectable)}px`,
            '--alinea-content-table-row-height': `${rowHeight}px`
          } as CSSProperties
        }
      >
        {showHeader && (
          <ContentTableHeader
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
            className={styles.ContentTable.body()}
          >
            {children}
          </Tree>
        </Virtualizer>
        {isEmpty && renderEmptyState && (
          <div
            data-slot="content-table-empty"
            className={styles.ContentTable.empty()}
          >
            {renderEmptyState()}
          </div>
        )}
      </Surface>
    </ContentTableContext.Provider>
  )
}

interface ContentTableHeaderProps {
  sortDescriptor?: SortDescriptor
  onSortChange?: (descriptor: SortDescriptor) => void
}

function ContentTableHeader({
  sortDescriptor,
  onSortChange
}: ContentTableHeaderProps) {
  const {columns, expandable, selectable} = useContentTable()
  return (
    <div
      data-slot="content-table-header"
      className={styles.ContentTableHeader()}
    >
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
                className={styles.ContentTableHeader.sortIcon()}
              />
            )}
          </>
        )
        return (
          <div
            key={column.id}
            data-slot="content-table-head"
            data-align={column.align}
            data-collapsible={column.collapsible || undefined}
            className={styles.ContentTableHeader.head({
              indented: expandable && index === 0
            })}
          >
            {column.sortable && onSortChange ? (
              <button
                type="button"
                className={styles.ContentTableHeader.sort()}
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

export interface ContentTableRowProps extends DataProps {
  id: Key
  /** Text used for typeahead and as the accessible row name */
  textValue: string
  /** Shows the expand toggle, also before the nested rows are loaded */
  hasChildren?: boolean
  /**
   * Nested ContentTableRows, rendered when the row is expanded. Pass them
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
   * selection behavior.
   */
  onPress?: () => void
  onDoubleClick?: () => void
  /** One cell per column, in column order */
  children: ReactNode
}

export function ContentTableRow({
  id,
  textValue,
  hasChildren,
  rows,
  selectable = true,
  highlighted,
  onAction,
  onPress,
  onDoubleClick,
  children,
  ...props
}: ContentTableRowProps) {
  const {columns, expandable, selectable: showSelection} = useContentTable()
  const cells = Children.toArray(children)
  return (
    <TreeItem
      data-slot="content-table-row"
      {...props}
      id={id}
      textValue={textValue}
      hasChildItems={hasChildren}
      isDisabled={!selectable}
      data-unselectable={!selectable || undefined}
      onAction={onAction}
      onPress={onPress}
      onDoubleClick={onDoubleClick}
      className={({isDropTarget, isDragging}) =>
        styles.ContentTableRow({
          highlighted,
          dropTarget: isDropTarget,
          dragging: isDragging
        })
      }
    >
      <TreeItemContent>
        {({isExpanded, level, allowsDragging}) => (
          <ContentTableRowContext.Provider
            value={{textValue, allowsDragging: Boolean(allowsDragging)}}
          >
            <div role="presentation" className={styles.ContentTableRow.grid()}>
              {showSelection && (
                <div
                  role="gridcell"
                  className={styles.ContentTableRow.selection()}
                >
                  {selectable && (
                    <SelectionCheckbox aria-label={`Select ${textValue}`} />
                  )}
                </div>
              )}
              {cells.map((cell, index) => (
                <ContentTableColumnContext.Provider
                  key={index}
                  value={columns[index] ?? null}
                >
                  {index === 0 ? (
                    <div
                      className={styles.ContentTableRow.first()}
                      style={{
                        paddingInlineStart: `calc(var(--alinea-content-table-indent) + ${(level - 1) * 20}px)`
                      }}
                    >
                      {(expandable || level > 1) && (
                        <span className={styles.ContentTableRow.chevron()}>
                          {hasChildren && (
                            <ButtonPrimitive
                              slot="chevron"
                              className={styles.ContentTableRow.chevron.button()}
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
                </ContentTableColumnContext.Provider>
              ))}
            </div>
          </ContentTableRowContext.Provider>
        )}
      </TreeItemContent>
      {rows}
    </TreeItem>
  )
}

export interface ContentTableCellProps extends StyleProps {
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

export function ContentTableCell({
  label,
  align,
  title,
  className,
  style,
  children
}: ContentTableCellProps) {
  return (
    <div
      data-slot="content-table-cell"
      role="gridcell"
      data-align={align}
      data-collapsible={useCollapsible()}
      title={title}
      className={styles.ContentTableCell(styler.merge({className}))}
      style={style}
    >
      {label && (
        <span className={styles.ContentTableCell.label()}>{label}</span>
      )}
      <span className={styles.ContentTableCell.value()}>{children}</span>
    </div>
  )
}

export interface ContentTableThumbnailProps extends StyleProps {
  src?: string
  alt?: string
}

/** An image cell, sized to the row height */
export function ContentTableThumbnail({
  src,
  alt = '',
  className,
  style
}: ContentTableThumbnailProps) {
  return (
    <div
      data-slot="content-table-thumbnail"
      role="gridcell"
      data-collapsible={useCollapsible()}
      className={styles.ContentTableThumbnail(styler.merge({className}))}
      style={style}
    >
      {src && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={styles.ContentTableThumbnail.image()}
        />
      )}
    </div>
  )
}

export interface ContentTableTitleProps extends StyleProps {
  /** Doubles as the drag handle of the row when rows can be dragged */
  icon?: IconType
  title: ReactNode
  /** A small caption above the title, eg. the parent path */
  label?: ReactNode
}

export function ContentTableTitle({
  icon,
  title,
  label,
  className,
  style
}: ContentTableTitleProps) {
  const row = useContext(ContentTableRowContext)
  const name = typeof title === 'string' ? title : row?.textValue
  return (
    <div
      data-slot="content-table-title"
      role="gridcell"
      data-collapsible={useCollapsible()}
      className={styles.ContentTableTitle(styler.merge({className}))}
      style={style}
    >
      {icon &&
        (row?.allowsDragging ? (
          <ButtonPrimitive
            slot="drag"
            data-slot="content-table-drag-handle"
            aria-label={`Drag ${name}`}
            className={styles.ContentTableTitle.drag()}
          >
            <Icon
              aria-hidden
              icon={icon}
              className={styles.ContentTableTitle.icon()}
            />
          </ButtonPrimitive>
        ) : (
          <Icon
            aria-hidden
            icon={icon}
            className={styles.ContentTableTitle.icon()}
          />
        ))}
      <span className={styles.ContentTableTitle.text()}>
        {label && (
          <span className={styles.ContentTableTitle.label()}>{label}</span>
        )}
        <span
          className={styles.ContentTableTitle.title()}
          title={typeof title === 'string' ? title : undefined}
        >
          {title}
        </span>
      </span>
    </div>
  )
}
