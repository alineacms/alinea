import {fromModule} from 'alinea/ui'
import {ReactNode} from 'react'
import * as rac from 'react-aria-components'
import css from './Menu.module.scss'

const styles = fromModule(css)

export interface MenuProps<T>
  extends rac.MenuProps<T>,
    Omit<rac.MenuTriggerProps, 'children'> {
  label?: ReactNode
}

export function Menu<T extends object>({
  label,
  children,
  ...props
}: MenuProps<T>) {
  return (
    <rac.MenuTrigger {...props}>
      <rac.Button className={styles.menu.button()}>{label}</rac.Button>
      <rac.Popover className={styles.menu.popover()}>
        <rac.Menu {...props}>{children}</rac.Menu>
      </rac.Popover>
    </rac.MenuTrigger>
  )
}

export function MenuItem(props: rac.MenuItemProps) {
  return <rac.MenuItem {...props} className={styles.menuItem()} />
}
