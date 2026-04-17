import styler from '@alinea/styler'
import {type ReactNode, useContext} from 'react'
import {
  MenuContext,
  type MenuItemProps,
  type MenuProps as MenuPrimitiveProps,
  MenuTrigger,
  Header as PrimitiveHeader,
  Menu as PrimitiveMenu,
  MenuItem as PrimitiveMenuItem,
  Separator as PrimitiveSeparator,
  SubmenuTrigger
} from 'react-aria-components'
import {IcRoundKeyboardArrowRight} from '../stories/icons/IcRoundKeyboardArrowRight.tsx'
import {Button} from './Button.tsx'
import {Icon} from './Icon.tsx'
import {Popover, type PopoverProps} from './Popover.tsx'
import {IcRoundCheck} from '../stories/icons/IcRoundCheck.tsx'
import css from './Menu.module.css'

const styles = styler(css)

export function MenuItem(props: MenuItemProps) {
  const textValue =
    props.textValue ||
    (typeof props.children === 'string' ? props.children : undefined)

  return (
    <PrimitiveMenuItem
      {...props}
      className={styles.MenuItem()}
      textValue={textValue}
    >
      {({hasSubmenu, isSelected, selectionMode}) => (
        <>
          {props.children}
          {isSelected && selectionMode && (
            <IcRoundCheck className={styles.MenuItem.check()} />
          )}
          {hasSubmenu && (
            <Icon className={styles.MenuItem.icon()} icon={IcRoundKeyboardArrowRight} />
          )}
        </>
      )}
    </PrimitiveMenuItem>
  )
}

export function MenuHeader(
  props: React.ComponentProps<typeof PrimitiveHeader>
) {
  return <PrimitiveHeader {...props} className={styles.MenuHeader()} />
}

export function MenuSeparator() {
  return <PrimitiveSeparator className={styles.MenuSeparator()} />
}

export interface MenuProps<T> extends MenuPrimitiveProps<T> {
  label: ReactNode
  children: ReactNode
  popoverProps?: Omit<PopoverProps, 'children'>
}

export function Menu<T extends object>({
  label,
  children,
  popoverProps,
  ...props
}: MenuProps<T>) {
  const isInMenu = useContext(MenuContext)
  const Trigger = isInMenu ? SubmenuTrigger : MenuTrigger
  return (
    <Trigger>
      {typeof label === 'string' ? <Button>{label}</Button> : <>{label}</>}
      <Popover {...popoverProps}>
        <PrimitiveMenu {...props} className={styles.Menu()}>
          {children}
        </PrimitiveMenu>
      </Popover>
    </Trigger>
  )
}
