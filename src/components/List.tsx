import styler from '@alinea/styler'
import type {HTMLAttributes, ReactNode} from 'react'
import css from './List.module.css'

const styles = styler(css)

export interface ListProps extends HTMLAttributes<HTMLDivElement> {}

export function List(props: ListProps) {
  return (
    <div
      role="list"
      {...props}
      className={styles.List(styler.merge(props))}
    />
  )
}

export interface ListItemProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  leading?: ReactNode
  trailing?: ReactNode
  inner?: ReactNode
}

export function ListItem({
  leading,
  trailing,
  inner,
  children,
  ...props
}: ListItemProps) {
  return (
    <div {...props} className={styles.ListItem(styler.merge(props))}>
      <header className={styles.ListItem.header()}>
        {leading && <div className={styles.ListItem.leading()}>{leading}</div>}
        {children && <div className={styles.ListItem.content()}>{children}</div>}
        {trailing && (
          <div className={styles.ListItem.trailing()}>{trailing}</div>
        )}
      </header>
      {inner && <div className={styles.ListItem.inner()}>{inner}</div>}
    </div>
  )
}
