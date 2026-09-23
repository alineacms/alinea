import styler from '@alinea/styler'
import {type ReactElement, type ReactNode, useId} from 'react'
import {
  Header,
  Keyboard,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Separator,
  SubmenuTrigger
} from 'react-aria-components'
import {IcRoundCheck, IcRoundKeyboardArrowRight} from '../dashboard/icons.js'
import css from './DropdownMenu.module.css'
import {Icon} from './Icon.js'
import {placement} from './internal/Placement.js'
import {PopoverSurface} from './internal/PopoverSurface.js'
import {Trigger, type TriggerProps} from './internal/Trigger.js'
import type {
  AriaProps,
  DataProps,
  IconType,
  OpenStateProps,
  PositionProps,
  StyleProps
} from './types.js'

const styles = styler(css)

export interface DropdownMenuProps extends OpenStateProps {
  children: ReactNode
}

export function DropdownMenu({
  open,
  defaultOpen,
  onOpenChange,
  children
}: DropdownMenuProps) {
  return (
    <MenuTrigger
      isOpen={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
    >
      {children}
    </MenuTrigger>
  )
}

export interface DropdownMenuTriggerProps extends TriggerProps {}

export function DropdownMenuTrigger(props: DropdownMenuTriggerProps) {
  return <Trigger data-slot="dropdown-menu-trigger" {...props} />
}

export interface DropdownMenuContentProps
  extends StyleProps, AriaProps, DataProps, PositionProps {
  children: ReactNode
}

export function DropdownMenuContent({
  side,
  align,
  sideOffset,
  alignOffset,
  className,
  style,
  children,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  'aria-describedby': ariaDescribedby,
  ...props
}: DropdownMenuContentProps) {
  return (
    <PopoverSurface
      data-slot="dropdown-menu-content"
      {...props}
      className={className}
      style={style}
      placement={placement(side, align)}
      offset={sideOffset}
      crossOffset={alignOffset}
    >
      <Menu
        id={id}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        aria-describedby={ariaDescribedby}
        className={styles.DropdownMenuContent()}
      >
        {children}
      </Menu>
    </PopoverSurface>
  )
}

interface DropdownMenuItemBaseProps extends StyleProps, DataProps {
  icon?: IconType | ReactElement
  disabled?: boolean
  /** Adds leading space so the item lines up with items that have an icon */
  inset?: boolean
  /** Text used for typeahead, defaults to the children if they are a string */
  textValue?: string
  children: ReactNode
}

export interface DropdownMenuItemProps extends DropdownMenuItemBaseProps {
  variant?: 'default' | 'destructive'
  href?: string
  target?: string
  /** Defaults to true */
  closeOnSelect?: boolean
  onSelect?: () => void
}

export function DropdownMenuItem({
  variant = 'default',
  href,
  target,
  closeOnSelect,
  onSelect,
  ...props
}: DropdownMenuItemProps) {
  return (
    <DropdownMenuItemView
      {...props}
      data-variant={variant}
      href={href}
      target={target}
      shouldCloseOnSelect={closeOnSelect}
      onAction={onSelect}
    />
  )
}

export interface DropdownMenuCheckboxItemProps extends DropdownMenuItemBaseProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Defaults to false */
  closeOnSelect?: boolean
}

export function DropdownMenuCheckboxItem({
  checked,
  onCheckedChange,
  closeOnSelect = false,
  ...props
}: DropdownMenuCheckboxItemProps) {
  const id = useId()
  return (
    <MenuSection
      aria-label={props.textValue}
      selectionMode="multiple"
      selectedKeys={checked ? [id] : []}
      onSelectionChange={keys =>
        onCheckedChange(keys === 'all' || keys.has(id))
      }
      shouldCloseOnSelect={closeOnSelect}
    >
      <DropdownMenuItemView {...props} id={id} />
    </MenuSection>
  )
}

export interface DropdownMenuRadioGroupProps extends AriaProps {
  value: string | null
  onValueChange: (value: string) => void
  /** Defaults to true */
  closeOnSelect?: boolean
  children: ReactNode
}

export function DropdownMenuRadioGroup({
  value,
  onValueChange,
  closeOnSelect,
  children,
  ...props
}: DropdownMenuRadioGroupProps) {
  return (
    <MenuSection
      {...props}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={value === null ? [] : [value]}
      onSelectionChange={keys => {
        if (keys === 'all') return
        const [key] = keys
        if (key !== undefined) onValueChange(String(key))
      }}
      shouldCloseOnSelect={closeOnSelect}
      className={styles.DropdownMenuGroup()}
    >
      {children}
    </MenuSection>
  )
}

export interface DropdownMenuRadioItemProps extends DropdownMenuItemBaseProps {
  value: string
}

export function DropdownMenuRadioItem({
  value,
  ...props
}: DropdownMenuRadioItemProps) {
  return <DropdownMenuItemView {...props} id={value} />
}

export interface DropdownMenuGroupProps extends AriaProps {
  children: ReactNode
}

export function DropdownMenuGroup(props: DropdownMenuGroupProps) {
  return <MenuSection {...props} className={styles.DropdownMenuGroup()} />
}

export interface DropdownMenuLabelProps extends StyleProps {
  inset?: boolean
  children: ReactNode
}

export function DropdownMenuLabel({
  inset,
  className,
  ...props
}: DropdownMenuLabelProps) {
  return (
    <Header
      {...props}
      data-inset={inset || undefined}
      className={styles.DropdownMenuLabel(styler.merge({className}))}
    />
  )
}

export function DropdownMenuSeparator() {
  return <Separator className={styles.DropdownMenuSeparator()} />
}

export interface DropdownMenuShortcutProps extends StyleProps {
  children: ReactNode
}

export function DropdownMenuShortcut({
  className,
  ...props
}: DropdownMenuShortcutProps) {
  return (
    <Keyboard
      {...props}
      className={styles.DropdownMenuShortcut(styler.merge({className}))}
    />
  )
}

export interface DropdownMenuSubProps {
  /** A DropdownMenuSubTrigger followed by a DropdownMenuSubContent */
  children: [ReactElement, ReactElement]
}

export function DropdownMenuSub({children}: DropdownMenuSubProps) {
  return <SubmenuTrigger>{children}</SubmenuTrigger>
}

export interface DropdownMenuSubTriggerProps extends DropdownMenuItemBaseProps {}

export function DropdownMenuSubTrigger(props: DropdownMenuSubTriggerProps) {
  return <DropdownMenuItemView {...props} />
}

export interface DropdownMenuSubContentProps
  extends StyleProps, AriaProps, DataProps {
  children: ReactNode
}

export function DropdownMenuSubContent(props: DropdownMenuSubContentProps) {
  return <DropdownMenuContent {...props} />
}

interface DropdownMenuItemViewProps extends DropdownMenuItemBaseProps {
  id?: string
  href?: string
  target?: string
  shouldCloseOnSelect?: boolean
  onAction?: () => void
}

function DropdownMenuItemView({
  icon,
  disabled,
  inset,
  textValue,
  className,
  children,
  ...props
}: DropdownMenuItemViewProps) {
  return (
    <MenuItem
      data-slot="dropdown-menu-item"
      {...props}
      isDisabled={disabled}
      data-inset={inset || undefined}
      textValue={
        textValue ?? (typeof children === 'string' ? children : undefined)
      }
      className={styles.DropdownMenuItem(styler.merge({className}))}
    >
      {({hasSubmenu, isSelected}) => (
        <>
          {icon && (
            <Icon icon={icon} className={styles.DropdownMenuItem.icon()} />
          )}
          {children}
          {isSelected && (
            <Icon
              icon={IcRoundCheck}
              className={styles.DropdownMenuItem.indicator()}
            />
          )}
          {hasSubmenu && (
            <Icon
              icon={IcRoundKeyboardArrowRight}
              className={styles.DropdownMenuItem.indicator()}
            />
          )}
        </>
      )}
    </MenuItem>
  )
}
