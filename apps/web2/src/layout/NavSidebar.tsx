import {fromModule} from 'alinea/ui'
import {PropsWithChildren} from 'react'
import css from './NavSidebar.module.scss'

const styles = fromModule(css)

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
