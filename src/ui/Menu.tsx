import styler from '@alinea/styler'
import {ReactNode} from 'react'
import * as rac from 'react-aria-components'
import css from './Menu.module.scss'

const styles = styler(css)

export interface MenuProps<T>
  extends rac.MenuProps<T>,
    Omit<rac.MenuTriggerProps, 'children'> {
  placement?: rac.PopoverProps['placement']
  label?: ReactNode
}

export function Menu<T extends object>({
  label,
  children,
  placement,
  ...props
}: MenuProps<T>) {
  return (
    <rac.MenuTrigger {...props}>
      <rac.Button className={styles.menu.button()}>{label}</rac.Button>
      <rac.Popover placement={placement} className={styles.menu.popover()}>
        <rac.Menu {...props}>{children}</rac.Menu>
      </rac.Popover>
    </rac.MenuTrigger>
  )
}

export function MenuItem(props: rac.MenuItemProps) {
  return <rac.MenuItem {...props} className={styles.menuItem()} />
}
