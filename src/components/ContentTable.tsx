import styler from '@alinea/styler'
import {
  Children,
  createContext,
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
import type {
  AriaProps,
  DataProps,
  IconType,
  Key,
  SelectionProps,
  SortDescriptor,
  StyleProps
} from './types.js'

const styles = styler(css)

export interface ContentTableColumn {
  id: Key
  header: ReactNode
  /** A fixed width in pixels or a fraction of the remaining space */
  width?: number | `${number}fr`
  /** Minimum width in pixels of a fractional column */
  minWidth?: number
  align?: 'start' | 'end'
  sortable?: boolean
}

export interface ContentTableProps<T extends object>
  extends StyleProps, AriaProps, SelectionProps {
  items: Iterable<T>
  columns: ReadonlyArray<ContentTableColumn>
  /** Show the column headers, defaults to true */
  showHeader?: boolean
  /** Reserve space for expand toggles so titles line up, set when rows nest */
  expandable?: boolean
  rowHeight?: number
  expandedKeys?: ReadonlySet<Key>
  defaultExpandedKeys?: ReadonlySet<Key>
  onExpandedChange?: (keys: Set<Key>) => void
  sortDescriptor?: SortDescriptor
  onSortChange?: (descriptor: SortDescriptor) => void
  /**
   * Called when a row is clicked or Enter is pressed. While rows are selected
   * with checkboxes, clicking a row toggles its selection instead.
   */
  onRowAction?: (key: Key) => void
  renderEmptyState?: () => ReactNode
  children: (item: T) => ReactElement<ContentTableRowProps>
}

interface ContentTableContextValue {
  columns: ReadonlyArray<ContentTableColumn>
  gridTemplateColumns: string
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

function gridTemplate(
  columns: ReadonlyArray<ContentTableColumn>,
  selectable: boolean
) {
  const tracks = columns.map(({width = '1fr', minWidth = 0}) =>
    typeof width === 'number' ? `${width}px` : `minmax(${minWidth}px, ${width})`
  )
  return (selectable ? ['44px', ...tracks] : tracks).join(' ')
}

function minimumWidth(
  columns: ReadonlyArray<ContentTableColumn>,
  selectable: boolean
) {
  let total = selectable ? 44 : 0
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
  className,
  style,
  children,
  ...props
}: ContentTableProps<T>) {
  const selectable = selectionMode === 'multiple'
  const context = useMemo(
    () => ({
      columns,
      gridTemplateColumns: gridTemplate(columns, selectable),
      expandable,
      selectable
    }),
    [columns, selectable, expandable]
  )
  const isEmpty = Array.from(items).length === 0
  return (
    <ContentTableContext.Provider value={context}>
      <div
        data-slot="content-table"
        className={styles.ContentTable(styler.merge({className}))}
        style={{
          ...style,
          ['--alinea-content-table-min-width' as string]: `${minimumWidth(columns, selectable)}px`
        }}
      >
        {showHeader && (
          <ContentTableHeader
            sortDescriptor={sortDescriptor}
            onSortChange={onSortChange}
          />
        )}
        <Virtualizer layout={ListLayout} layoutOptions={{rowHeight}}>
          <Tree
            {...props}
            items={items}
            selectionMode={selectionMode}
            selectionBehavior="toggle"
            selectedKeys={selectedKeys}
            defaultSelectedKeys={defaultSelectedKeys}
            onSelectionChange={onSelectionChange}
            disabledKeys={disabledKeys}
            disabledBehavior="selection"
            expandedKeys={expandedKeys}
            defaultExpandedKeys={defaultExpandedKeys}
            onExpandedChange={onExpandedChange}
            onAction={onRowAction}
            className={styles.ContentTable.body()}
          >
            {children}
          </Tree>
        </Virtualizer>
        {isEmpty && renderEmptyState && (
          <div className={styles.ContentTable.empty()}>
            {renderEmptyState()}
          </div>
        )}
      </div>
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
  const {columns, gridTemplateColumns, expandable, selectable} =
    useContentTable()
  return (
    <div
      data-slot="content-table-header"
      className={styles.ContentTableHeader()}
      style={{gridTemplateColumns}}
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
  hasChildren?: boolean
  /** Nested ContentTableRows, rendered when the row is expanded */
  rows?: ReactNode
  /** One ContentTableCell per column, in column order */
  children: ReactNode
}

export function ContentTableRow({
  id,
  textValue,
  hasChildren,
  rows,
  children,
  ...props
}: ContentTableRowProps) {
  const {gridTemplateColumns, expandable, selectable} = useContentTable()
  const cells = Children.toArray(children)
  return (
    <TreeItem
      data-slot="content-table-row"
      {...props}
      id={id}
      textValue={textValue}
      hasChildItems={hasChildren}
      className={styles.ContentTableRow()}
    >
      <TreeItemContent>
        {({isExpanded, level}) => (
          <div
            role="presentation"
            className={styles.ContentTableRow.grid()}
            style={{gridTemplateColumns}}
          >
            {selectable && (
              <div className={styles.ContentTableRow.selection()}>
                <SelectionCheckbox aria-label={`Select ${textValue}`} />
              </div>
            )}
            {cells.map((cell, index) =>
              index === 0 ? (
                <div
                  key="first"
                  className={styles.ContentTableRow.first()}
                  style={{paddingInlineStart: (level - 1) * 20}}
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
              )
            )}
          </div>
        )}
      </TreeItemContent>
      {rows}
    </TreeItem>
  )
}

export interface ContentTableCellProps extends StyleProps {
  align?: 'start' | 'end'
  children?: ReactNode
}

export function ContentTableCell({
  align,
  className,
  ...props
}: ContentTableCellProps) {
  return (
    <div
      data-slot="content-table-cell"
      role="gridcell"
      data-align={align}
      {...props}
      className={styles.ContentTableCell(styler.merge({className}))}
    />
  )
}

export interface ContentTableTitleProps extends StyleProps {
  /** Thumbnail url, rendered instead of the icon */
  image?: string
  icon?: IconType
  title: ReactNode
  /** A second, muted line such as a path or type */
  description?: ReactNode
}

export function ContentTableTitle({
  image,
  icon,
  title,
  description,
  className,
  style
}: ContentTableTitleProps) {
  return (
    <div
      data-slot="content-table-title"
      role="gridcell"
      className={styles.ContentTableTitle(styler.merge({className}))}
      style={style}
    >
      {image ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          className={styles.ContentTableTitle.image()}
        />
      ) : (
        icon && <Icon icon={icon} className={styles.ContentTableTitle.icon()} />
      )}
      <span className={styles.ContentTableTitle.text()}>
        <span className={styles.ContentTableTitle.title()}>{title}</span>
        {description && (
          <span className={styles.ContentTableTitle.description()}>
            {description}
          </span>
        )}
      </span>
    </div>
  )
}
