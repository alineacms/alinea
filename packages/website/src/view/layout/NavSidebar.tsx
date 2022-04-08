import {fromModule} from '@alineacms/ui'
import {PropsWithChildren} from 'react'
import css from './NavSidebar.module.scss'

const styles = fromModule(css)

//export const NavSidebar = styles.root.toElement('aside')

export function NavSidebar({children}: PropsWithChildren<{}>) {
  return (
    <aside className={styles.root()}>
      <div className={styles.root.inner()}>{children}</div>
    </aside>
  )
}
