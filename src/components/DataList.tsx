import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import css from './DataList.module.css'
import type {AriaProps, DataProps, Orientation, StyleProps} from './types.js'

const styles = styler(css)

export interface DataListProps extends StyleProps, AriaProps, DataProps {
  /**
   * `horizontal` lines labels up in a column next to their values,
   * `vertical` stacks each label above its value and flows the items into
   * as many columns as fit
   */
  orientation?: Orientation
  children: ReactNode
}

/** A description list of DataListItems with a label and a value */
export function DataList({
  orientation = 'horizontal',
  className,
  ...props
}: DataListProps) {
  return (
    <dl
      data-slot="data-list"
      {...props}
      data-orientation={orientation}
      className={styles.DataList(styler.merge({className}))}
    />
  )
}

export interface DataListItemProps extends StyleProps, DataProps {
  /** Spans every column of a vertical list */
  full?: boolean
  children: ReactNode
}

export function DataListItem({full, className, ...props}: DataListItemProps) {
  return (
    <div
      data-slot="data-list-item"
      {...props}
      data-full={full || undefined}
      className={styles.DataListItem(styler.merge({className}))}
    />
  )
}

export interface DataListLabelProps extends StyleProps, DataProps {
  children: ReactNode
}

export function DataListLabel({className, ...props}: DataListLabelProps) {
  return (
    <dt
      data-slot="data-list-label"
      {...props}
      className={styles.DataListLabel(styler.merge({className}))}
    />
  )
}

export interface DataListValueProps extends StyleProps, DataProps {
  children: ReactNode
}

export function DataListValue({className, ...props}: DataListValueProps) {
  return (
    <dd
      data-slot="data-list-value"
      {...props}
      className={styles.DataListValue(styler.merge({className}))}
    />
  )
}
