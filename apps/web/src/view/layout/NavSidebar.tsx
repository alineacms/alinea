import {fromModule} from '@alinea/ui'
import {PropsWithChildren} from 'react'
import css from './NavSidebar.module.scss'

const styles = fromModule(css)

//export const NavSidebar = styles.root.toElement('aside')

export function NavSidebar({children}: PropsWithChildren<{}>) {
  return <aside className={styles.root()}>{children}</aside>
}
