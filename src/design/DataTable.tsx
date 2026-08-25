import styler from '@alinea/styler'
import type {CSSProperties, HTMLAttributes, PropsWithChildren} from 'react'
import {Surface} from './Surface.js'
import css from './DataTable.module.css'

const styles = styler(css)

export interface DataTableProps extends PropsWithChildren {
  columns?: string
  label: string
}

export function DataTable({children, columns, label}: DataTableProps) {
  return (
    <Surface>
      <div
        aria-label={label}
        className={styles['alinea-DataTable']()}
        role="table"
        style={{'--alinea-DataTable-columns': columns} as CSSProperties}
      >
        {children}
      </div>
    </Surface>
  )
}

export function DataTableHeader({children}: PropsWithChildren) {
  return (
    <div className={styles['alinea-DataTable-header']()} role="row">
      {children}
    </div>
  )
}

export interface DataTableRowProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'className'
> {
  disabled?: boolean
  selected?: boolean
}

export function DataTableRow({
  children,
  disabled,
  selected,
  ...props
}: DataTableRowProps) {
  return (
    <div
      {...props}
      className={styles['alinea-DataTable-row']()}
      data-disabled={disabled ? '' : undefined}
      data-selected={selected ? '' : undefined}
      role="row"
    >
      {children}
    </div>
  )
}

export interface DataTableCellProps extends PropsWithChildren {
  align?: 'start' | 'center' | 'end'
  header?: boolean
}

export function DataTableCell({
  align = 'start',
  children,
  header
}: DataTableCellProps) {
  return (
    <div
      className={styles['alinea-DataTable-cell']()}
      data-align={align}
      role={header ? 'columnheader' : 'cell'}
    >
      {children}
    </div>
  )
}

export function DataTableCellStack({children}: PropsWithChildren) {
  return (
    <span className={styles['alinea-DataTable-cellStack']()}>{children}</span>
  )
}

export function DataTableCellTitle({children}: PropsWithChildren) {
  return (
    <span className={styles['alinea-DataTable-cellTitle']()}>{children}</span>
  )
}

export function DataTableCellMeta({children}: PropsWithChildren) {
  return (
    <span className={styles['alinea-DataTable-cellMeta']()}>{children}</span>
  )
}

export function DataTableEmpty({children}: PropsWithChildren) {
  return <div className={styles['alinea-DataTable-empty']()}>{children}</div>
}
