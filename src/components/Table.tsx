import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import {
  Cell,
  Column,
  Row,
  Table as AriaTable,
  TableBody as AriaTableBody,
  TableHeader as AriaTableHeader,
  useTableOptions
} from 'react-aria-components'
import {
  IcRoundKeyboardArrowDown,
  IcRoundKeyboardArrowUp
} from '../dashboard/icons.js'
import {SelectionCheckbox} from './internal/SelectionCheckbox.js'
import {Surface} from './Surface.js'
import css from './Table.module.css'
import type {
  AriaProps,
  DataProps,
  Key,
  SelectionProps,
  SortDescriptor,
  StyleProps
} from './types.js'

const styles = styler(css)

export interface TableProps
  extends StyleProps, AriaProps, DataProps, SelectionProps {
  sortDescriptor?: SortDescriptor
  onSortChange?: (descriptor: SortDescriptor) => void
  /** Called when a row is activated (clicked or Enter) */
  onRowAction?: (key: Key) => void
  /** Alternate row backgrounds */
  striped?: boolean
  children: ReactNode
}

export function Table({
  className,
  style,
  striped,
  selectionMode = 'none',
  sortDescriptor,
  onSortChange,
  onRowAction,
  children,
  ...props
}: TableProps) {
  return (
    <Surface
      data-slot="table-container"
      className={styles.Table(styler.merge({className}))}
      style={style}
      data-striped={striped || undefined}
    >
      <AriaTable
        {...props}
        data-slot="table"
        className={styles.Table.table()}
        selectionMode={selectionMode}
        selectionBehavior={selectionMode === 'multiple' ? 'toggle' : 'replace'}
        sortDescriptor={
          sortDescriptor && {
            column: sortDescriptor.column,
            direction:
              sortDescriptor.direction === 'asc' ? 'ascending' : 'descending'
          }
        }
        onSortChange={
          onSortChange &&
          (descriptor =>
            onSortChange({
              column: descriptor.column,
              direction: descriptor.direction === 'ascending' ? 'asc' : 'desc'
            }))
        }
        onRowAction={onRowAction}
      >
        {children}
      </AriaTable>
    </Surface>
  )
}

export interface TableHeaderProps extends StyleProps {
  children: ReactNode
}

export function TableHeader({className, style, children}: TableHeaderProps) {
  const {selectionMode} = useTableOptions()
  return (
    <AriaTableHeader
      data-slot="table-header"
      className={styles.TableHeader(styler.merge({className}))}
      style={style}
    >
      {selectionMode === 'multiple' && (
        <Column
          data-slot="table-head"
          className={styles.TableHead({selection: true})}
        >
          <SelectionCheckbox />
        </Column>
      )}
      {children}
    </AriaTableHeader>
  )
}

export interface TableHeadProps extends StyleProps {
  /** Column key, used in `sortDescriptor` */
  id?: Key
  /** Clicking the header sorts by this column */
  sortable?: boolean
  /** Cells in this column label their row */
  rowHeader?: boolean
  width?: number | string
  children: ReactNode
}

export function TableHead({
  id,
  sortable,
  rowHeader,
  width,
  className,
  style,
  children
}: TableHeadProps) {
  return (
    <Column
      id={id}
      allowsSorting={sortable}
      isRowHeader={rowHeader}
      data-slot="table-head"
      className={styles.TableHead(styler.merge({className}))}
      style={width === undefined ? style : {width, ...style}}
    >
      {({sortDirection}) => {
        if (!sortable) return children
        return (
          <span className={styles.TableHead.label()}>
            {children}
            <span
              aria-hidden
              data-slot="table-sort-indicator"
              className={styles.TableHead.sortIndicator()}
            >
              {sortDirection === 'ascending' ? (
                <IcRoundKeyboardArrowUp />
              ) : (
                <IcRoundKeyboardArrowDown />
              )}
            </span>
          </span>
        )
      }}
    </Column>
  )
}

export interface TableBodyProps<T extends object> extends StyleProps {
  /** Rows to render with the `children` function */
  items?: Iterable<T>
  renderEmptyState?: () => ReactNode
  children: ReactNode | ((item: T) => ReactNode)
}

export function TableBody<T extends object>({
  items,
  renderEmptyState,
  className,
  style,
  children
}: TableBodyProps<T>) {
  return (
    <AriaTableBody<T>
      data-slot="table-body"
      className={styles.TableBody(styler.merge({className}))}
      style={style}
      items={items}
      renderEmptyState={
        renderEmptyState
          ? () => (
              <div data-slot="table-empty" className={styles.TableBody.empty()}>
                {renderEmptyState()}
              </div>
            )
          : undefined
      }
    >
      {children}
    </AriaTableBody>
  )
}

export interface TableRowProps extends StyleProps, DataProps {
  id?: Key
  children: ReactNode
}

export function TableRow({
  id,
  className,
  style,
  children,
  ...props
}: TableRowProps) {
  const {selectionMode} = useTableOptions()
  return (
    <Row
      {...props}
      id={id}
      data-slot="table-row"
      className={styles.TableRow(styler.merge({className}))}
      style={style}
    >
      {selectionMode === 'multiple' && (
        <Cell data-slot="table-cell" className={styles.TableCell()}>
          <SelectionCheckbox />
        </Cell>
      )}
      {children}
    </Row>
  )
}

export interface TableCellProps extends StyleProps {
  /** Keep the content on a single line */
  nowrap?: boolean
  children?: ReactNode
}

export function TableCell({
  nowrap,
  className,
  style,
  children
}: TableCellProps) {
  return (
    <Cell
      data-slot="table-cell"
      className={styles.TableCell({nowrap}, styler.merge({className}))}
      style={style}
    >
      {children}
    </Cell>
  )
}
