import styler from '@alinea/styler'
import type {PropsWithChildren} from 'react'
import type {
  CellProps,
  ColumnProps,
  RowProps,
  TableBodyProps,
  TableHeaderProps,
  TableProps as TablePrimitiveProps
} from 'react-aria-components'
import {
  Cell as CellPrimitive,
  Collection,
  Column as ColumnPrimitive,
  Row as RowPrimitive,
  TableBody as TableBodyPrimitive,
  TableHeader as TableHeaderPrimitive,
  Table as TablePrimitive,
  useTableOptions
} from 'react-aria-components'
import {
  IcRoundKeyboardArrowDown,
  IcRoundKeyboardArrowUp
} from '../dashboard/icons.js'
import {Checkbox} from './Checkbox.js'
import {Surface} from './Surface.js'
import css from './Table.module.css'

const styles = styler(css)

export type {
  CellProps,
  ColumnProps,
  RowProps,
  TableBodyProps
} from 'react-aria-components'

export interface TableProps extends TablePrimitiveProps {
  striped?: boolean
}

export function Table(props: TableProps) {
  return (
    <Surface
      className={styles.Table(
        styler.merge({
          className:
            typeof props.className === 'string' ? props.className : undefined
        })
      )}
      data-striped={props.striped}
    >
      <TablePrimitive {...props} className={styles.Table.table()} />
    </Surface>
  )
}

export function TableHeader<T extends object>({
  columns,
  children
}: TableHeaderProps<T>) {
  const {selectionMode} = useTableOptions()

  return (
    <TableHeaderPrimitive className={styles.TableHeader()}>
      {selectionMode === 'multiple' && (
        <Column>
          <Checkbox slot="selection" />
        </Column>
      )}
      <Collection items={columns}>{children}</Collection>
    </TableHeaderPrimitive>
  )
}

export function Column(props: PropsWithChildren<ColumnProps>) {
  const {className, ...rest} = props
  return (
    <ColumnPrimitive
      {...rest}
      className={renderProps =>
        styles.Column(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    >
      {({allowsSorting, sortDirection}) => {
        if (!allowsSorting) return props.children
        return (
          <div className={styles.Column.label()} data-sortable={allowsSorting}>
            {props.children}
            {allowsSorting && (
              <span className={styles.Column.sortIndicator()}>
                {sortDirection === 'ascending' ? (
                  <IcRoundKeyboardArrowUp />
                ) : (
                  <IcRoundKeyboardArrowDown />
                )}
              </span>
            )}
          </div>
        )
      }}
    </ColumnPrimitive>
  )
}

export function TableBody<T extends object>(props: TableBodyProps<T>) {
  return <TableBodyPrimitive<T> {...props} className={styles.TableBody()} />
}

export function Row<T extends object>({
  id,
  columns,
  children,
  ...props
}: RowProps<T>) {
  const {selectionMode} = useTableOptions()
  const {className, ...rest} = props
  return (
    <RowPrimitive
      id={id}
      {...rest}
      className={renderProps =>
        styles.Row(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    >
      {selectionMode === 'multiple' && (
        <Cell>
          <Checkbox slot="selection" />
        </Cell>
      )}
      <Collection items={columns}>{children}</Collection>
    </RowPrimitive>
  )
}

export function Cell(props: CellProps & {nowrap?: boolean}) {
  const {className, nowrap, ...rest} = props
  return (
    <CellPrimitive
      {...rest}
      data-nowrap={nowrap}
      className={renderProps =>
        styles.Cell(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    />
  )
}
