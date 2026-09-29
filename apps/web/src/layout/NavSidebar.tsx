import styler from '@alinea/styler'
import type {PropsWithChildren} from 'react'
import css from './NavSidebar.module.scss'

const styles = styler(css)

export interface NavSidebarProps {
  fluid?: boolean
}

export function NavSidebar({
  children,
  fluid
}: PropsWithChildren<NavSidebarProps>) {
  return (
    <aside className={styles.root({fluid})}>
      <div className={styles.root.inner()}>{children}</div>
    </aside>
  )
}
