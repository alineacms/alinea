import styler from '@alinea/styler'
import {PropsWithChildren} from 'react'
import css from './NavSidebar.module.scss'

const styles = styler(css)

//export const NavSidebar = styles.root.toElement('aside')

export interface NavSidebarProps {
  fluid?: boolean
}

export function NavSidebar({
  children,
  fluid
}: PropsWithChildren<NavSidebarProps>) {
  return <aside className={styles.root({fluid})}>{children}</aside>
}
