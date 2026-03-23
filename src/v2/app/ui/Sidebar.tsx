import styler from '@alinea/styler'
import type {HTMLAttributes, PropsWithChildren} from 'react'
import css from './Sidebar.module.css'

const styles = styler(css)

type SidebarDivider = 'left' | 'right'

export interface SidebarProps
  extends PropsWithChildren,
    HTMLAttributes<HTMLElement> {
  className?: string
  divider?: SidebarDivider
  layout?: boolean
}

export function Sidebar({
  className,
  children,
  divider,
  layout = false,
  ...props
}: SidebarProps) {
  return (
    <aside
      {...props}
      className={styles.root(
        {
          layout,
          dividerLeft: divider === 'left',
          dividerRight: divider === 'right'
        },
        styler.merge({className})
      )}
    >
      {children}
    </aside>
  )
}

export interface SidebarHeaderProps
  extends PropsWithChildren,
    HTMLAttributes<HTMLElement> {}

export function SidebarHeader({
  children,
  className,
  ...props
}: SidebarHeaderProps) {
  return (
    <header
      {...props}
      className={styles.header(styler.merge({className}))}
    >
      {children}
    </header>
  )
}

export interface SidebarBodyProps
  extends PropsWithChildren,
    HTMLAttributes<HTMLDivElement> {
  scroll?: boolean
}

export function SidebarBody({
  children,
  className,
  scroll = false,
  ...props
}: SidebarBodyProps) {
  return (
    <div
      {...props}
      className={styles.body({scroll}, styler.merge({className}))}
    >
      {children}
    </div>
  )
}

export interface SidebarFooterProps
  extends PropsWithChildren,
    HTMLAttributes<HTMLElement> {}

export function SidebarFooter({
  children,
  className,
  ...props
}: SidebarFooterProps) {
  return (
    <footer
      {...props}
      className={styles.footer(styler.merge({className}))}
    >
      {children}
    </footer>
  )
}
